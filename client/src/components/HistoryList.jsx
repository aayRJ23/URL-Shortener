// components/HistoryList.jsx
// Updated: table layout with copy buttons for both URLs (feature v)

import { useState } from "react";
import { API_BASE }             from "../api/urlApi";
import { formatDate, truncate } from "../utils/formatters";

function HistoryList({ history, historyLoading, onRefresh, onDelete }) {
  return (
    <div className="card card--history">
      <div className="history-header">
        <h3 className="card-title">Your Links</h3>
        <button className="btn-refresh" onClick={onRefresh} title="Refresh">↻</button>
      </div>

      {historyLoading && (
        <div className="history-loading">
          <span className="spinner spinner--sm" />
          <span>Loading your links…</span>
        </div>
      )}

      {!historyLoading && history.length === 0 && (
        <p className="history-empty">You haven't shortened any links yet. Go ahead! 🚀</p>
      )}

      {!historyLoading && history.length > 0 && (
        <div className="links-table-wrapper">
          <table className="links-table">
            <thead>
              <tr>
                <th>Original URL</th>
                <th>Short URL</th>
                <th className="col-visits">Visits</th>
                <th className="col-date">Created</th>
                <th className="col-actions"></th>
              </tr>
            </thead>
            <tbody>
              {history.map((item) => (
                <LinkRow key={item.id} item={item} onDelete={onDelete} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function CopyBtn({ text, label }) {
  const [copied, setCopied] = useState(false);

  function handleCopy(e) {
    e.preventDefault();
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }

  return (
    <button
      className={`btn-copy-inline ${copied ? "btn-copy-inline--done" : ""}`}
      onClick={handleCopy}
      title={`Copy ${label}`}
    >
      {copied ? "✓" : "⎘"}
    </button>
  );
}

function LinkRow({ item, onDelete }) {
  const shortLink = `${API_BASE}/${item.shortURL}`;

  return (
    <tr className="link-row">
      {/* Original URL */}
      <td className="col-original">
        <div className="url-cell">
          <a
            href={item.originalURL}
            target="_blank"
            rel="noopener noreferrer"
            className="url-text url-text--original"
            title={item.originalURL}
          >
            {truncate(item.originalURL, 42)}
          </a>
          <CopyBtn text={item.originalURL} label="original URL" />
        </div>
      </td>

      {/* Short URL */}
      <td className="col-short">
        <div className="url-cell">
          <a
            href={shortLink}
            target="_blank"
            rel="noopener noreferrer"
            className="url-text url-text--short"
            title={shortLink}
          >
            /{item.shortURL}
          </a>
          <CopyBtn text={shortLink} label="short URL" />
        </div>
      </td>

      {/* Visit count */}
      <td className="col-visits">
        <span className="visits-badge">
          <span className="visits-icon">👁</span>
          {item.tracknumber}
        </span>
      </td>

      {/* Date */}
      <td className="col-date">
        <span className="date-text">{formatDate(item.createdAt)}</span>
      </td>

      {/* Delete */}
      <td className="col-actions">
        <button
          className="btn-delete"
          onClick={() => onDelete(item.id)}
          title="Delete this link"
        >
          🗑
        </button>
      </td>
    </tr>
  );
}

export default HistoryList;