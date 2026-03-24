// context/AuthContext.jsx

import { createContext, useContext, useEffect, useState, useRef } from "react";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  deleteUser,
  GoogleAuthProvider,
  signInWithPopup,
} from "firebase/auth";
import { auth }                                    from "../firerbase";
import { checkUsernameAvailable, reserveUsername } from "../api/urlApi";

const AuthContext = createContext(null);

export function AuthProvider({ children, onAuthEvent }) {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);

  // Suppress onAuthStateChanged mid-signup to avoid partial state flashes
  const signingUpRef = useRef(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (signingUpRef.current) return;
      setUser(firebaseUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // ── Email/Password Signup ─────────────────────────────────────────────────
  const signup = async (email, password, username) => {
    const cleanUsername = username.trim().toLowerCase();

    let available;
    try {
      available = await checkUsernameAvailable(cleanUsername);
    } catch {
      throw new Error("Could not verify username. Is the server running?");
    }
    if (!available) throw new Error("USERNAME_TAKEN");

    signingUpRef.current = true;
    let userCredential;

    try {
      userCredential = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(userCredential.user, { displayName: username.trim() });
      await userCredential.user.reload();
      const token = await userCredential.user.getIdToken(true);
      await reserveUsername(cleanUsername, token);

      signingUpRef.current = false;
      setUser(auth.currentUser);
      setLoading(false);
      onAuthEvent?.("signup", username.trim());

    } catch (err) {
      signingUpRef.current = false;

      if (userCredential?.user) {
        console.error("[Auth] Signup step failed — rolling back:", err.message);
        try { await deleteUser(userCredential.user); } catch (e) { console.error("[Auth] Rollback failed:", e.message); }
        setUser(null);
        setLoading(false);
        if (err.message === "This username is already taken." || err.message === "USERNAME_TAKEN") {
          throw new Error("USERNAME_TAKEN");
        }
      }
      throw err;
    }
  };

  // ── Email/Password Login ──────────────────────────────────────────────────
  const login = async (email, password) => {
    const result = await signInWithEmailAndPassword(auth, email, password);
    onAuthEvent?.("login", result.user.displayName || result.user.email);
    return result;
  };

  // ── Google Sign-In (Login OR Signup) ─────────────────────────────────────
  //
  // Flow:
  //  1. Open Google popup
  //  2. Check if this Google account has already signed in before
  //     (isNewUser from additionalUserInfo)
  //  3a. Returning user → just log them in, done.
  //  3b. New user → they need a username. We return { needsUsername: true, user, token }
  //      so AuthForm can show the username-pick step.
  //  4. Once username is chosen, call googleFinishSignup(username, user, token).
  //
  const loginWithGoogle = async () => {
    signingUpRef.current = true;

    try {
      const provider = new GoogleAuthProvider();
      const result   = await signInWithPopup(auth, provider);
      const fbUser   = result.user;
      const token    = await fbUser.getIdToken(true);

      // Check if they already have a username reserved (returning user)
      const isReturning = await _hasUsername(fbUser.uid, token);

      if (isReturning) {
        // Existing Google user — just log in
        signingUpRef.current = false;
        setUser(fbUser);
        setLoading(false);
        onAuthEvent?.("login", fbUser.displayName || fbUser.email);
        return { needsUsername: false };
      } else {
        // New Google user — need to pick a username before finishing
        // Keep signingUpRef = true so onAuthStateChanged doesn't set user yet
        // We'll resolve this when googleFinishSignup is called
        return { needsUsername: true, googleUser: fbUser, token };
      }

    } catch (err) {
      signingUpRef.current = false;
      setLoading(false);
      throw err;
    }
  };

  // Called from AuthForm after the new Google user picks their username
  const googleFinishSignup = async (username, googleUser, token) => {
    const cleanUsername = username.trim().toLowerCase();

    // Verify availability one more time before reserving
    let available;
    try {
      available = await checkUsernameAvailable(cleanUsername);
    } catch {
      throw new Error("Could not verify username. Is the server running?");
    }
    if (!available) throw new Error("USERNAME_TAKEN");

    // Set displayName on the Google user (it may be their Google name; override with chosen username)
    await updateProfile(googleUser, { displayName: username.trim() });
    await googleUser.reload();
    const freshToken = await googleUser.getIdToken(true);

    try {
      await reserveUsername(cleanUsername, freshToken);
    } catch (err) {
      // Roll back — delete the Google account
      try { await deleteUser(googleUser); } catch (e) { console.error("[Auth] Google rollback failed:", e.message); }
      signingUpRef.current = false;
      setUser(null);
      setLoading(false);
      if (err.message === "This username is already taken." || err.message === "USERNAME_TAKEN") {
        throw new Error("USERNAME_TAKEN");
      }
      throw err;
    }

    signingUpRef.current = false;
    setUser(auth.currentUser);
    setLoading(false);
    onAuthEvent?.("signup", username.trim());
  };

  // ── Helpers ───────────────────────────────────────────────────────────────

  // Check if a user already has a username reserved (i.e. they're a returning user)
  const _hasUsername = async (uid, token) => {
    try {
      const res  = await fetch(`${process.env.REACT_APP_API_URL || "http://localhost:4010"}/has-username`, {
        headers: { "Authorization": `Bearer ${token}` },
      });
      if (!res.ok) return false;
      const data = await res.json();
      return data.hasUsername;
    } catch {
      return false;
    }
  };

  // ── Logout ────────────────────────────────────────────────────────────────
  const logout = async () => {
    await signOut(auth);
    onAuthEvent?.("logout");
  };

  const getToken = async () => {
    if (!user) return null;
    return user.getIdToken();
  };

  const value = { user, loading, signup, login, logout, getToken, loginWithGoogle, googleFinishSignup };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}