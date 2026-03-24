// components/ShortenForm.jsx
// ─────────────────────────────────────────────────────────────
// The main card with the URL input form.
// All logic comes from the useUrlShortener hook via props.
// ─────────────────────────────────────────────────────────────

import { API_BASE } from "../api/urlApi";

function ShortenForm({
  currentURL,
  customAlias,
  error,
  loading,
  inputRef,
  onSubmit,
  onURLChange,
  onAliasChange,
}) {
  return (
    <div className="card card--main">
      <h2 className="card-title">Paste your long URL</h2>

      <form onSubmit={onSubmit} className="form" noValidate>

        {/* Long URL input */}
        <div className="input-group">
          <input
            ref={inputRef}
            type="url"
            className={`input ${error ? "input--error" : ""}`}
            placeholder="https://example.com/very/long/url"
            value={currentURL}
            onChange={(e) => onURLChange(e.target.value)}
          />
        </div>

        {/* Optional custom alias input */}
        <div className="input-group input-group--alias">
          <span className="alias-prefix">{API_BASE}/</span>
          <input
            type="text"
            className="input input--alias"
            placeholder="custom-alias (optional)"
            value={customAlias}
            onChange={(e) => onAliasChange(e.target.value)}
            maxLength={20}
          />
        </div>

        {/* Validation error */}
        {error && <p className="error-msg">⚠ {error}</p>}

        {/* Submit button */}
        <button
          type="submit"
          className={`btn-shorten ${loading ? "btn-shorten--loading" : ""}`}
          disabled={loading}
        >
          {loading ? <span className="spinner" /> : "Shorten URL"}
        </button>
      </form>
    </div>
  );
}

export default ShortenForm;
