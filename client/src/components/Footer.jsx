// components/Footer.jsx — TrimLynk branded footer

function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="footer">
      <div className="footer-credit">
        Made with{" "}
        <span className="footer-heart" aria-label="love">❤️</span>
        {" "}by{" "}
        <span className="footer-author">Aayush Raj</span>
      </div>
      <div className="footer-brand">
        <span className="footer-logo">
          Trim<span className="logo-accent">Lynk</span>
        </span>
        <span className="footer-dot">·</span>
        <span className="footer-tagline">Built with ☕</span>
      </div>
      <div className="footer-copy">
        © {year} TrimLynk. All rights reserved.
      </div>
    </footer>
  );
}

export default Footer;