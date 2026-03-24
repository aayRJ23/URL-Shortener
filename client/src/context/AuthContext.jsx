// context/AuthContext.jsx
// Updated signup flow:
//  1. Check username availability (fast, before creating account)
//  2. Create Firebase account
//  3. Set displayName
//  4. Get fresh token
//  5. Reserve username in Firestore (POST /reserve-username)
//  6. If Firestore reservation fails → delete the Firebase account (rollback)
// This ensures email AND username are both unique with proper error messages.

import { createContext, useContext, useEffect, useState } from "react";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  deleteUser,
} from "firebase/auth";
import { auth }                                        from "../firerbase";
import { checkUsernameAvailable, reserveUsername }     from "../api/urlApi";

const AuthContext = createContext(null);

export function AuthProvider({ children, onAuthEvent }) {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  /**
   * signup
   *
   * Full flow with username uniqueness guarantee:
   *  Step 1 — Pre-check: is username already taken? (avoids wasted account creation)
   *  Step 2 — Create Firebase Auth account (catches duplicate email automatically)
   *  Step 3 — Set displayName on the new account
   *  Step 4 — Get a fresh token (needed to call our protected API)
   *  Step 5 — Reserve username in Firestore via POST /reserve-username
   *  Step 6 — If reservation fails (race condition), delete the Firebase account
   *            and throw so the UI shows an appropriate error
   */
  const signup = async (email, password, username) => {
    const cleanUsername = username.trim().toLowerCase();

    // ── Step 1: pre-check username availability ──────────────────────────────
    let available;
    try {
      available = await checkUsernameAvailable(cleanUsername);
    } catch {
      throw new Error("Could not verify username. Is the server running?");
    }
    if (!available) {
      throw new Error("USERNAME_TAKEN");
    }

    // ── Step 2: create Firebase Auth account ─────────────────────────────────
    // Firebase throws auth/email-already-in-use automatically here
    let userCredential;
    try {
      userCredential = await createUserWithEmailAndPassword(auth, email, password);
    } catch (err) {
      throw err; // re-throw Firebase error codes as-is for AuthForm to map
    }

    // ── Step 3: set displayName ───────────────────────────────────────────────
    await updateProfile(userCredential.user, { displayName: username.trim() });
    await userCredential.user.reload();

    // ── Step 4: get fresh token ───────────────────────────────────────────────
    const token = await userCredential.user.getIdToken(true);

    // ── Step 5: reserve username in Firestore ─────────────────────────────────
    try {
      await reserveUsername(cleanUsername, token);
    } catch (err) {
      // ── Step 6: rollback — delete the Firebase account we just created ──────
      // This can happen if two users submit the exact same username in the same
      // millisecond (race condition past step 1's pre-check).
      console.error("[Auth] Username reservation failed — rolling back Firebase account:", err.message);
      try {
        await deleteUser(userCredential.user);
      } catch (deleteErr) {
        console.error("[Auth] Rollback deleteUser failed:", deleteErr.message);
      }
      throw new Error("USERNAME_TAKEN");
    }

    // ── Done: update state with the real Firebase user object ─────────────────
    setUser(auth.currentUser);
    onAuthEvent?.("signup", username.trim());
  };

  const login = async (email, password) => {
    const result = await signInWithEmailAndPassword(auth, email, password);
    onAuthEvent?.("login", result.user.displayName || result.user.email);
    return result;
  };

  const logout = async () => {
    await signOut(auth);
    onAuthEvent?.("logout");
  };

  const getToken = async () => {
    if (!user) return null;
    return user.getIdToken();
  };

  const value = { user, loading, signup, login, logout, getToken };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}