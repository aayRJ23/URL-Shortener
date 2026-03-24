// components/AuthForm.jsx

import { useState, useEffect, useRef } from "react";
import { useAuth }                     from "../context/AuthContext";
import { checkUsernameAvailable }      from "../api/urlApi";

const USERNAME_REGEX = /^[a-z0-9][a-z0-9-]{1,18}[a-z0-9]$|^[a-z0-9]{3,20}$/;

function AuthForm() {
  const [mode,     setMode]     = useState("login");
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  // After Google sign-in for a new user — shows username-pick step
  const [googlePending, setGooglePending]   = useState(null); // { googleUser, token }
  const [googleUsername, setGoogleUsername] = useState("");

  const [usernameStatus, setUsernameStatus] = useState("idle");
  // "idle" | "checking" | "available" | "taken" | "invalid"

  const [googleUsernameStatus, setGoogleUsernameStatus] = useState("idle");

  const { login, signup, loginWithGoogle, googleFinishSignup } = useAuth();
  const isSignup    = mode === "signup";
  const debounceRef = useRef(null);
  const gDebounceRef = useRef(null);

  // Live username check for email signup
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
      } catch { setUsernameStatus("idle"); }
    }, 600);
    return () => clearTimeout(debounceRef.current);
  }, [username, isSignup]);

  // Live username check for Google username-pick step
  useEffect(() => {
    if (!googlePending) return;
    const clean = googleUsername.trim().toLowerCase();
    if (!clean) { setGoogleUsernameStatus("idle"); return; }
    if (!USERNAME_REGEX.test(clean)) { setGoogleUsernameStatus("invalid"); return; }
    setGoogleUsernameStatus("checking");
    clearTimeout(gDebounceRef.current);
    gDebounceRef.current = setTimeout(async () => {
      try {
        const available = await checkUsernameAvailable(clean);
        setGoogleUsernameStatus(available ? "available" : "taken");
      } catch { setGoogleUsernameStatus("idle"); }
    }, 600);
    return () => clearTimeout(gDebounceRef.current);
  }, [googleUsername, googlePending]);

  // ── Email/Password submit ─────────────────────────────────────────────────
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
      if (usernameStatus === "taken")    { setError("This username is already taken."); return; }
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

  // ── Google button click ───────────────────────────────────────────────────
  async function handleGoogle() {
    setError("");
    setGoogleLoading(true);
    try {
      const result = await loginWithGoogle();
      if (result.needsUsername) {
        // New Google user — show username-pick step
        setGooglePending({ googleUser: result.googleUser, token: result.token });
      }
      // If !needsUsername, AuthContext already set the user → AppContent renders
    } catch (err) {
      if (err.code !== "auth/popup-closed-by-user") {
        setError(mapErrorMessage(err));
      }
    } finally {
      setGoogleLoading(false);
    }
  }

  // ── Google username-pick submit ───────────────────────────────────────────
  async function handleGoogleUsername(e) {
    e.preventDefault();
    setError("");
    const clean = googleUsername.trim().toLowerCase();
    if (!clean) { setError("Username is required."); return; }
    if (!USERNAME_REGEX.test(clean)) {
      setError("Username must be 3–20 chars: letters, numbers, hyphens only.");
      return;
    }
    if (googleUsernameStatus === "taken")    { setError("This username is already taken."); return; }
    if (googleUsernameStatus === "checking") { setError("Please wait — checking username availability…"); return; }

    setLoading(true);
    try {
      await googleFinishSignup(googleUsername.trim(), googlePending.googleUser, googlePending.token);
    } catch (err) {
      setError(mapErrorMessage(err));
      if (err.code === "auth/requires-recent-login" || err.message?.includes("rollback")) {
        setGooglePending(null);
        setGoogleUsername("");
      }
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
    setGooglePending(null);
    setGoogleUsername("");
    setGoogleUsernameStatus("idle");
  }

  const usernameIndicator = (status, val) => {
    if (!val) return null;
    const map = {
      checking:  { cls: "un-checking", text: "Checking…" },
      available: { cls: "un-available", text: "✓ Available" },
      taken:     { cls: "un-taken",     text: "✗ Already taken" },
      invalid:   { cls: "un-invalid",   text: "3–20 chars, letters/numbers/hyphens only" },
    };
    const s = map[status];
    return s ? <span className={`username-status ${s.cls}`}>{s.text}</span> : null;
  };

  // ── Google username-pick screen ───────────────────────────────────────────
  if (googlePending) {
    return (
      <div className="card card--main card--auth">
        <h2 className="card-title">Pick a username</h2>
        <p className="auth-subtitle">
          Your Google account is ready! Choose a username — it'll be the prefix on all your short links.
        </p>

        <form onSubmit={handleGoogleUsername} className="form" noValidate>
          <div className="field-group">
            <label className="field-label" htmlFor="google-username">
              Username <span className="field-required">*</span>
              {usernameIndicator(googleUsernameStatus, googleUsername)}
            </label>
            <div className={`input-group ${
              googleUsernameStatus === "taken" || googleUsernameStatus === "invalid"
                ? "input-group--error"
                : googleUsernameStatus === "available"
                ? "input-group--ok"
                : ""
            }`}>
              <input
                id="google-username"
                type="text"
                className="input"
                placeholder="e.g. johndoe"
                value={googleUsername}
                onChange={(e) => setGoogleUsername(e.target.value.replace(/[^a-zA-Z0-9-]/g, "").toLowerCase())}
                maxLength={20}
                autoFocus
                autoComplete="off"
              />
            </div>
            <p className="field-hint">3–20 chars, letters/numbers/hyphens only.</p>
          </div>

          {error && <p className="error-msg">⚠ {error}</p>}

          <button
            type="submit"
            className={`btn-shorten ${loading ? "btn-shorten--loading" : ""}`}
            disabled={loading || googleUsernameStatus === "taken" || googleUsernameStatus === "checking"}
          >
            {loading ? <span className="spinner" /> : "Finish Sign Up"}
          </button>
        </form>
      </div>
    );
  }

  // ── Main auth form ────────────────────────────────────────────────────────
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

      {/* ── Google Button ── */}
      <button
        type="button"
        className={`btn-google ${googleLoading ? "btn-google--loading" : ""}`}
        onClick={handleGoogle}
        disabled={googleLoading || loading}
      >
        {googleLoading ? (
          <span className="spinner spinner--dark" />
        ) : (
          <>
            <GoogleIcon />
            <span>{isSignup ? "Sign up with Google" : "Continue with Google"}</span>
          </>
        )}
      </button>

      <div className="auth-divider">
        <span>or</span>
      </div>

      {/* ── Email / Password Form ── */}
      <form onSubmit={handleSubmit} className="form" noValidate>

        {isSignup && (
          <div className="field-group">
            <label className="field-label" htmlFor="auth-username">
              Username <span className="field-required">*</span>
              {usernameIndicator(usernameStatus, username)}
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

// Official Google "G" SVG icon
function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
      <g fill="none" fillRule="evenodd">
        <path d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
        <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
        <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
        <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
      </g>
    </svg>
  );
}

function mapErrorMessage(err) {
  if (err.message === "USERNAME_TAKEN") return "This username is already taken. Please choose another.";
  if (err.message?.includes("server running")) return err.message;
  switch (err.code) {
    case "auth/email-already-in-use":      return "An account with this email already exists. Try logging in instead.";
    case "auth/invalid-email":             return "That doesn't look like a valid email address.";
    case "auth/weak-password":             return "Password is too weak — use at least 6 characters.";
    case "auth/user-not-found":
    case "auth/wrong-password":
    case "auth/invalid-credential":        return "Invalid email or password. Please check and try again.";
    case "auth/too-many-requests":         return "Too many failed attempts. Please wait a moment and try again.";
    case "auth/network-request-failed":    return "Network error. Please check your internet connection.";
    case "auth/user-disabled":             return "This account has been disabled. Please contact support.";
    case "auth/account-exists-with-different-credential":
      return "An account already exists with this email. Try logging in with email/password.";
    default: return err.message || "Something went wrong. Please try again.";
  }
}

export default AuthForm;