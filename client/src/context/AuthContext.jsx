// context/AuthContext.jsx
// ─────────────────────────────────────────────────────────────
// Provides Firebase Auth state globally across the app.
//
// What this does:
//  - Listens to Firebase Auth state changes (login/logout)
//  - Stores the current user object + loading state
//  - Exposes login, signup, logout functions
//  - Any component can call useAuth() to access these
//
// Usage:
//   const { user, login, signup, logout } = useAuth();
// ─────────────────────────────────────────────────────────────

import { createContext, useContext, useEffect, useState } from "react";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
} from "firebase/auth";
import { auth } from "../firerbase";

// Create the context object
const AuthContext = createContext(null);

/**
 * AuthProvider
 *
 * Wrap your entire app with this (in index.js) so every component
 * can access auth state via useAuth().
 */
export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);   // Firebase user object or null
  const [loading, setLoading] = useState(true);   // true until Firebase resolves initial state

  // Listen to auth state changes (fires on login, logout, page reload)
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);   // null if logged out, user object if logged in
      setLoading(false);       // Firebase has resolved the initial auth state
    });

    // Cleanup the listener when the component unmounts
    return () => unsubscribe();
  }, []);

  /**
   * signup
   * Creates a new Firebase user and sets their displayName (username).
   * displayName is what gets embedded in the short code prefix.
   *
   * @param {string} email
   * @param {string} password
   * @param {string} username - stored as Firebase displayName
   */
  const signup = async (email, password, username) => {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    // Set displayName immediately after account creation
    await updateProfile(userCredential.user, { displayName: username });
    // Re-read the user so displayName is reflected in the state
    setUser({ ...userCredential.user, displayName: username });
  };

  /**
   * login
   * Signs in an existing user with email + password.
   */
  const login = (email, password) => {
    return signInWithEmailAndPassword(auth, email, password);
  };

  /**
   * logout
   * Signs the user out. onAuthStateChanged will fire and set user → null.
   */
  const logout = () => {
    return signOut(auth);
  };

  /**
   * getToken
   * Returns the current user's Firebase ID token.
   * Call this before any protected API request.
   * Firebase auto-refreshes tokens — this always returns a valid one.
   */
  const getToken = async () => {
    if (!user) return null;
    return user.getIdToken();
  };

  const value = { user, loading, signup, login, logout, getToken };

  // Don't render children until Firebase resolves the initial auth state
  // This prevents a flash of "logged out" UI on page reload
  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

/**
 * useAuth
 * Custom hook for consuming AuthContext.
 * Use this in any component instead of useContext(AuthContext) directly.
 */
export function useAuth() {
  return useContext(AuthContext);
}