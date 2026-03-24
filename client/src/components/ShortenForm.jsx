// components/ShortenForm.jsx
// Fixes:
//  - Added labels to all fields (feature iv)
//  - Alias placeholder now shows username (feature iv)
//  - Bug (ii): the alias prefix now shows username- when user types alias
//    (backend already prefixes it; we just reflect it visually)

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
  username,
}) {
  const baseDisplay = API_BASE.replace(/^https?:\/\//, "");

  return (
    <div className="card card--main">
      <h2 className="card-title">Paste your long URL</h2>

      <form onSubmit={onSubmit} className="form" noValidate>

        {/* Long URL input */}
        <div className="field-group">
          <label className="field-label" htmlFor="url-input">
            Long URL <span className="field-required">*</span>
          </label>
          <div className={`input-group ${error ? "input-group--error" : ""}`}>
            <input
              id="url-input"
              ref={inputRef}
              type="url"
              className="input"
              placeholder="https://example.com/very/long/url"
              value={currentURL}
              onChange={(e) => onURLChange(e.target.value)}
            />
          </div>
        </div>

        {/* Optional custom alias */}
        <div className="field-group">
          <label className="field-label" htmlFor="alias-input">
            Custom Alias{" "}
            <span className="field-optional">(optional)</span>
          </label>
          <div className="input-group input-group--alias">
            <span className="alias-prefix">
              {baseDisplay}/<strong>{username}-</strong>
            </span>
            <input
              id="alias-input"
              type="text"
              className="input input--alias"
              placeholder="my-link"
              value={customAlias}
              onChange={(e) => onAliasChange(e.target.value)}
              maxLength={20}
            />
          </div>
          <p className="field-hint">
            Leave blank to get a random short code.
          </p>
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