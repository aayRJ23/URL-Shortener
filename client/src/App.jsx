import { useState, useEffect, useRef } from "react";
import "./App.css";

const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:4010";

function App() {
  const [currentURL, setCurrentURL] = useState("");
  const [customAlias, setCustomAlias] = useState("");
  const [shortURL, setShortURL] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [showResult, setShowResult] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    fetchHistory();
    inputRef.current?.focus();
  }, []);

  const fetchHistory = async () => {
    setHistoryLoading(true);
    try {
      const res = await fetch(`${API_BASE}/recent`);
      const data = await res.json();
      setHistory(data);
    } catch {
      // silently fail
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setShowResult(false);

    if (!currentURL.trim()) {
      setError("Please enter a URL.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/shorten`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentURL, customAlias }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Something went wrong.");
        return;
      }

      setShortURL(data.shortedurl);
      setShowResult(true);
      setCopied(false);
      fetchHistory();
    } catch {
      setError("Could not connect to server. Is the API running?");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    const full = `${API_BASE}/${shortURL}`;
    navigator.clipboard.writeText(full).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const formatDate = (iso) => {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const truncate = (str, n) =>
    str && str.length > n ? str.slice(0, n) + "…" : str;

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <div className="logo">
          <span className="logo-icon">⚡</span>
          <span className="logo-text">snip<span className="logo-accent">ly</span></span>
        </div>
        <p className="logo-sub">Shorten. Share. Track.</p>
      </header>

      {/* Main Card */}
      <main className="main">
        <div className="card card--main">
          <h2 className="card-title">Paste your long URL</h2>

          <form onSubmit={handleSubmit} className="form" noValidate>
            <div className="input-group">
              <input
                ref={inputRef}
                type="url"
                className={`input ${error ? "input--error" : ""}`}
                placeholder="https://example.com/very/long/url"
                value={currentURL}
                onChange={(e) => { setCurrentURL(e.target.value); setError(""); }}
              />
            </div>

            <div className="input-group input-group--alias">
              <span className="alias-prefix">{API_BASE}/</span>
              <input
                type="text"
                className="input input--alias"
                placeholder="custom-alias (optional)"
                value={customAlias}
                onChange={(e) => setCustomAlias(e.target.value.replace(/\s/g, ""))}
                maxLength={20}
              />
            </div>

            {error && <p className="error-msg">⚠ {error}</p>}

            <button type="submit" className={`btn-shorten ${loading ? "btn-shorten--loading" : ""}`} disabled={loading}>
              {loading ? <span className="spinner" /> : "Shorten URL"}
            </button>
          </form>

          {/* Result */}
          {showResult && shortURL && (
            <div className="result-box">
              <p className="result-label">Your short link is ready!</p>
              <div className="result-row">
                <a
                  href={`${API_BASE}/${shortURL}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="result-link"
                >
                  {API_BASE}/{shortURL}
                </a>
                <button className={`btn-copy ${copied ? "btn-copy--done" : ""}`} onClick={handleCopy}>
                  {copied ? "✓ Copied!" : "Copy"}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* History */}
        <div className="card card--history">
          <div className="history-header">
            <h3 className="card-title">Recent Links</h3>
            <button className="btn-refresh" onClick={fetchHistory} title="Refresh">↻</button>
          </div>

          {historyLoading ? (
            <div className="history-loading">
              <span className="spinner spinner--sm" />
              <span>Loading history…</span>
            </div>
          ) : history.length === 0 ? (
            <p className="history-empty">No links shortened yet. Be the first! 🚀</p>
          ) : (
            <ul className="history-list">
              {history.map((item) => (
                <li key={item.id} className="history-item">
                  <div className="history-item__top">
                    <a
                      href={`${API_BASE}/${item.shortURL}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="history-short"
                    >
                      /{item.shortURL}
                    </a>
                    <span className="history-visits">
                      👁 {item.tracknumber} visit{item.tracknumber !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <p className="history-original" title={item.originalURL}>
                    {truncate(item.originalURL, 55)}
                  </p>
                  <span className="history-date">{formatDate(item.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>

      <footer className="footer">
        Built with ☕ · <span>snip<span className="logo-accent">ly</span></span>
      </footer>
    </div>
  );
}

export default App;