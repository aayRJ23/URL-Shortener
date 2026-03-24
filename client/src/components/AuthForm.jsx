// components/AuthForm.jsx
// Updated:
//  - Live username availability check as user types (debounced 600ms)
//  - Handles USERNAME_TAKEN error from AuthContext
//  - All Firebase + custom error codes mapped to clear messages
//  - Password strength hint
//  - Username validation: 3–20 chars, alphanumeric + hyphens only

import { useState, useEffect, useRef } from "react";
import { useAuth }                     from "../context/AuthContext";
import { checkUsernameAvailable }      from "../api/urlApi";

// Valid username: 3-20 chars, letters/numbers/hyphens, no leading/trailing hyphen
const USERNAME_REGEX = /^[a-z0-9][a-z0-9-]{1,18}[a-z0-9]$|^[a-z0-9]{3,20}$/;

function AuthForm() {
  const [mode,     setMode]     = useState("login");
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);

  // Username availability state
  const [usernameStatus, setUsernameStatus] = useState("idle");
  // "idle" | "checking" | "available" | "taken" | "invalid"

  const { login, signup } = useAuth();
  const isSignup = mode === "signup";
  const debounceRef = useRef(null);

  // Live username check — debounced 600ms
  useEffect(() => {
    if (!isSignup) return;
    const clean = username.trim().toLowerCase();

    if (!clean) { setUsernameStatus("idle"); return; }
    if (!USERNAME_REGEX.test(clean)) { setUsernameStatus("invalid"); return; }

    setUsernameStatus("checking");
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const available = await checkUsernameAvailable(clean);
        setUsernameStatus(available ? "available" : "taken");
      } catch {
        setUsernameStatus("idle"); // server error — silently ignore, validate on submit
      }
    }, 600);

    return () => clearTimeout(debounceRef.current);
  }, [username, isSignup]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (isSignup) {
      const clean = username.trim().toLowerCase();
      if (!clean) { setError("Username is required."); return; }
      if (!USERNAME_REGEX.test(clean)) {
        setError("Username must be 3–20 chars: letters, numbers, hyphens only. Cannot start/end with a hyphen.");
        return;
      }
      if (usernameStatus === "taken") { setError("This username is already taken."); return; }
      if (usernameStatus === "checking") { setError("Please wait — checking username availability…"); return; }
    }

    setLoading(true);
    try {
      if (isSignup) {
        await signup(email, password, username.trim());
      } else {
        await login(email, password);
      }
    } catch (err) {
      setError(mapErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  function switchMode(newMode) {
    setMode(newMode);
    setError("");
    setEmail("");
    setPassword("");
    setUsername("");
    setUsernameStatus("idle");
  }

  // Username field status indicator
  const usernameIndicator = () => {
    if (!username) return null;
    const map = {
      checking:  { cls: "un-checking", text: "Checking…" },
      available: { cls: "un-available", text: "✓ Available" },
      taken:     { cls: "un-taken",     text: "✗ Already taken" },
      invalid:   { cls: "un-invalid",   text: "3–20 chars, letters/numbers/hyphens only" },
    };
    const s = map[usernameStatus];
    return s ? <span className={`username-status ${s.cls}`}>{s.text}</span> : null;
  };

  return (
    <div className="card card--main card--auth">
      <h2 className="card-title">
        {isSignup ? "Create an account" : "Welcome back"}
      </h2>
      <p className="auth-subtitle">
        {isSignup
          ? "Sign up to start shortening and tracking your links."
          : "Log in to manage your shortened links."}
      </p>

      <form onSubmit={handleSubmit} className="form" noValidate>

        {isSignup && (
          <div className="field-group">
            <label className="field-label" htmlFor="auth-username">
              Username <span className="field-required">*</span>
              {usernameIndicator()}
            </label>
            <div className={`input-group ${
              usernameStatus === "taken" || usernameStatus === "invalid"
                ? "input-group--error"
                : usernameStatus === "available"
                ? "input-group--ok"
                : ""
            }`}>
              <input
                id="auth-username"
                type="text"
                className="input"
                placeholder="e.g. johndoe"
                value={username}
                onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9-]/g, "").toLowerCase())}
                maxLength={20}
                autoComplete="off"
              />
            </div>
            <p className="field-hint">Used as prefix in your short links. 3–20 chars.</p>
          </div>
        )}

        <div className="field-group">
          <label className="field-label" htmlFor="auth-email">
            Email <span className="field-required">*</span>
          </label>
          <div className="input-group">
            <input
              id="auth-email"
              type="email"
              className="input"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </div>
        </div>

        <div className="field-group">
          <label className="field-label" htmlFor="auth-password">
            Password <span className="field-required">*</span>
          </label>
          <div className="input-group">
            <input
              id="auth-password"
              type="password"
              className="input"
              placeholder={isSignup ? "Min. 6 characters" : "Your password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={isSignup ? "new-password" : "current-password"}
            />
          </div>
        </div>

        {error && <p className="error-msg">⚠ {error}</p>}

        <button
          type="submit"
          className={`btn-shorten ${loading ? "btn-shorten--loading" : ""}`}
          disabled={loading || (isSignup && (usernameStatus === "taken" || usernameStatus === "checking"))}
        >
          {loading
            ? <span className="spinner" />
            : isSignup ? "Sign Up" : "Log In"
          }
        </button>
      </form>

      <p className="auth-toggle">
        {isSignup ? "Already have an account?" : "Don't have an account?"}{" "}
        <button
          className="auth-toggle-btn"
          onClick={() => switchMode(isSignup ? "login" : "signup")}
        >
          {isSignup ? "Log In" : "Sign Up"}
        </button>
      </p>
    </div>
  );
}

/**
 * Maps all possible error sources to clear user-facing messages.
 * Handles: Firebase error codes, custom "USERNAME_TAKEN", network errors.
 */
function mapErrorMessage(err) {
  // Custom errors thrown by AuthContext
  if (err.message === "USERNAME_TAKEN") return "This username is already taken. Please choose another.";
  if (err.message?.includes("server running")) return err.message;

  // Firebase error codes
  switch (err.code) {
    case "auth/email-already-in-use":
      return "An account with this email already exists. Try logging in instead.";
    case "auth/invalid-email":
      return "That doesn't look like a valid email address.";
    case "auth/weak-password":
      return "Password is too weak — use at least 6 characters.";
    case "auth/user-not-found":
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return "Invalid email or password. Please check and try again.";
    case "auth/too-many-requests":
      return "Too many failed attempts. Please wait a moment and try again.";
    case "auth/network-request-failed":
      return "Network error. Please check your internet connection.";
    case "auth/user-disabled":
      return "This account has been disabled. Please contact support.";
    default:
      return err.message || "Something went wrong. Please try again.";
  }
}

export default AuthForm;