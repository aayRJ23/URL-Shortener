// context/AuthContext.jsx
// FIXED:
//  1. After successful signup, force-reload user before setting state
//     so displayName is present on the user object immediately.
//  2. onAuthStateChanged now skips setting user during active signup
//     to prevent race conditions between signup steps and state updates.
//  3. Rollback (deleteUser) correctly results in null user — login form shows,
//     which is correct behavior when username is taken.

import { createContext, useContext, useEffect, useState, useRef } from "react";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  deleteUser,
} from "firebase/auth";
import { auth }                                    from "../firerbase";
import { checkUsernameAvailable, reserveUsername } from "../api/urlApi";

const AuthContext = createContext(null);

export function AuthProvider({ children, onAuthEvent }) {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);

  // Flag: suppress onAuthStateChanged during the middle of signup steps
  // to prevent partial state being set before the full flow completes.
  const signingUpRef = useRef(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      // If we're in the middle of a signup, don't update state yet.
      // The signup function will call setUser itself when done (or on rollback).
      if (signingUpRef.current) return;
      setUser(firebaseUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  /**
   * signup
   * Full atomic flow:
   *  1. Pre-check username availability
   *  2. Create Firebase Auth account
   *  3. Set displayName
   *  4. Reload user to get fresh claims
   *  5. Get fresh ID token
   *  6. Reserve username in Firestore via POST /reserve-username
   *  7. On failure: delete Firebase account (rollback), clear user state
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
    if (!available) throw new Error("USERNAME_TAKEN");

    // Mark that signup is in progress — suppress onAuthStateChanged handler
    signingUpRef.current = true;

    let userCredential;
    try {
      // ── Step 2: create Firebase Auth account ───────────────────────────────
      userCredential = await createUserWithEmailAndPassword(auth, email, password);

      // ── Step 3: set displayName ─────────────────────────────────────────────
      await updateProfile(userCredential.user, { displayName: username.trim() });

      // ── Step 4: reload to get fresh user object with displayName ────────────
      await userCredential.user.reload();

      // ── Step 5: get fresh ID token ──────────────────────────────────────────
      const token = await userCredential.user.getIdToken(true);

      // ── Step 6: reserve username in Firestore ───────────────────────────────
      await reserveUsername(cleanUsername, token);

      // ── Success: update state with fully-set-up user ────────────────────────
      signingUpRef.current = false;
      setUser(auth.currentUser);
      setLoading(false);
      onAuthEvent?.("signup", username.trim());

    } catch (err) {
      signingUpRef.current = false;

      // If we created the Firebase account but something after failed, roll back
      if (userCredential?.user) {
        console.error("[Auth] Signup step failed — rolling back Firebase account:", err.message);
        try {
          await deleteUser(userCredential.user);
        } catch (deleteErr) {
          console.error("[Auth] Rollback deleteUser failed:", deleteErr.message);
        }
        // Explicitly set user to null — the auth state may not fire again
        setUser(null);
        setLoading(false);

        // Map reservation failure to USERNAME_TAKEN
        if (err.message === "This username is already taken." || err.message === "USERNAME_TAKEN") {
          throw new Error("USERNAME_TAKEN");
        }
      }

      throw err; // re-throw original Firebase error codes (email-in-use etc.)
    }
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