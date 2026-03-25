// components/Header.jsx — TrimLynk branding + redesigned user bar

import { useAuth } from "../context/AuthContext";

function Header() {
  const { user, logout } = useAuth();

  return (
    <header className="header">

      {/* ── Logo ── */}
      <div className="logo">
        <span className="logo-icon">✂️</span>
        <span className="logo-text">
          Trim<span className="logo-accent">Lynk</span>
        </span>
      </div>
      <p className="logo-sub">Shorten. Share. Track.</p>

      {/* ── User bar — only when logged in ── */}
      {user && (
        <div className="header-user">
          <div className="header-user__pill">
            <span className="header-user__avatar">
              {(user.displayName || user.email)?.[0]?.toUpperCase()}
            </span>
            <div className="header-user__info">
              <span className="header-user__label">Logged in as</span>
              <span className="header-user__name">@{user.displayName || user.email}</span>
            </div>
          </div>
          <button className="btn-logout" onClick={logout}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            Log out
          </button>
        </div>
      )}

    </header>
  );
}

export default Header;