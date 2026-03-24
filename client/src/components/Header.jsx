// components/Header.jsx
// ─────────────────────────────────────────────────────────────
// Branding header.
//
// Changes from v1:
//  - Shows logged-in username on the right
//  - Shows a Logout button
//  - Uses useAuth() directly (no props needed — auth is global)
// ─────────────────────────────────────────────────────────────

import { useAuth } from "../context/AuthContext";

function Header() {
  const { user, logout } = useAuth();

  return (
    <header className="header">

      {/* Logo — unchanged */}
      <div className="logo">
        <span className="logo-icon">⚡</span>
        <span className="logo-text">
          snip<span className="logo-accent">ly</span>
        </span>
      </div>
      <p className="logo-sub">Shorten. Share. Track.</p>

      {/* User info + logout — only shown when logged in */}
      {user && (
        <div className="header-user">
          <span className="header-username">@{user.displayName}</span>
          <button className="btn-logout" onClick={logout}>
            Log out
          </button>
        </div>
      )}

    </header>
  );
}

export default Header;