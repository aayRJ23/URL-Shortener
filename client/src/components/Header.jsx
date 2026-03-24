// components/Header.jsx
// ─────────────────────────────────────────────────────────────
// Static branding header. No props needed.
// ─────────────────────────────────────────────────────────────

function Header() {
  return (
    <header className="header">
      <div className="logo">
        <span className="logo-icon">⚡</span>
        <span className="logo-text">
          snip<span className="logo-accent">ly</span>
        </span>
      </div>
      <p className="logo-sub">Shorten. Share. Track.</p>
    </header>
  );
}

export default Header;
