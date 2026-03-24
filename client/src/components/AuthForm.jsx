// components/AuthForm.jsx
// ─────────────────────────────────────────────────────────────
// Handles both Login and Signup in a single component.
// Toggles between modes via local state.
//
// Uses useAuth() to call login() or signup().
// On success, AuthContext updates user state and App re-renders
// to show the main shortener UI.
// ─────────────────────────────────────────────────────────────

import { useState } from "react";
import { useAuth }  from "../context/AuthContext";

function AuthForm() {
  // Toggle between "login" and "signup" mode
  const [mode,     setMode]     = useState("login");

  // Form fields
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState(""); // only used in signup

  // UI state
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);

  const { login, signup } = useAuth();

  const isSignup = mode === "signup";

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (isSignup) {
        // Signup: create account + set displayName as username
        if (!username.trim()) {
          setError("Username is required.");
          return;
        }
        await signup(email, password, username.trim());
      } else {
        // Login: sign in with email + password
        await login(email, password);
      }
      // On success, AuthContext updates user → App shows the main UI
    } catch (err) {
      // Firebase error codes → user-friendly messages
      const msg = firebaseErrorMessage(err.code);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card card--main">
      <h2 className="card-title">
        {isSignup ? "Create an account" : "Welcome back"}
      </h2>

      <form onSubmit={handleSubmit} className="form" noValidate>

        {/* Username field — signup only */}
        {isSignup && (
          <div className="input-group">
            <input
              type="text"
              className="input"
              placeholder="Username (used in your short links)"
              value={username}
              onChange={(e) => setUsername(e.target.value.replace(/\s/g, ""))}
              maxLength={20}
            />
          </div>
        )}

        {/* Email */}
        <div className="input-group">
          <input
            type="email"
            className="input"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        {/* Password */}
        <div className="input-group">
          <input
            type="password"
            className="input"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        {/* Error message */}
        {error && <p className="error-msg">⚠ {error}</p>}

        {/* Submit button */}
        <button
          type="submit"
          className={`btn-shorten ${loading ? "btn-shorten--loading" : ""}`}
          disabled={loading}
        >
          {loading
            ? <span className="spinner" />
            : isSignup ? "Sign Up" : "Log In"
          }
        </button>

      </form>

      {/* Toggle between login and signup */}
      <p className="auth-toggle">
        {isSignup ? "Already have an account?" : "Don't have an account?"}{" "}
        <button
          className="auth-toggle-btn"
          onClick={() => { setMode(isSignup ? "login" : "signup"); setError(""); }}
        >
          {isSignup ? "Log In" : "Sign Up"}
        </button>
      </p>
    </div>
  );
}

/**
 * Converts Firebase error codes to readable messages.
 * Add more cases as needed.
 */
function firebaseErrorMessage(code) {
  switch (code) {
    case "auth/email-already-in-use":  return "This email is already registered.";
    case "auth/invalid-email":         return "Invalid email address.";
    case "auth/weak-password":         return "Password must be at least 6 characters.";
    case "auth/user-not-found":        return "No account found with this email.";
    case "auth/wrong-password":        return "Incorrect password.";
    case "auth/invalid-credential":    return "Invalid email or password.";
    default:                           return "Something went wrong. Please try again.";
  }
}

export default AuthForm;