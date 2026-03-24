// components/ResultBox.jsx
// ─────────────────────────────────────────────────────────────
// Shown below the form after a URL is successfully shortened.
// Displays the short link with a copy-to-clipboard button.
// ─────────────────────────────────────────────────────────────

import { API_BASE } from "../api/urlApi";

function ResultBox({ shortURL, copied, onCopy }) {
  // Don't render anything if there's no result yet
  if (!shortURL) return null;

  const fullShortURL = `${API_BASE}/${shortURL}`;

  return (
    <div className="result-box">
      <p className="result-label">Your short link is ready!</p>
      <div className="result-row">

        {/* Clickable short URL */}
        <a
          href={fullShortURL}
          target="_blank"
          rel="noopener noreferrer"
          className="result-link"
        >
          {fullShortURL}
        </a>

        {/* Copy button — shows a tick when copied */}
        <button
          className={`btn-copy ${copied ? "btn-copy--done" : ""}`}
          onClick={() => onCopy(fullShortURL)}
        >
          {copied ? "✓ Copied!" : "Copy"}
        </button>

      </div>
    </div>
  );
}

export default ResultBox;
