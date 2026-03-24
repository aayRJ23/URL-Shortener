// components/HistoryList.jsx
// ─────────────────────────────────────────────────────────────
// Displays the logged-in user's shortened links.
//
// Changes from v1:
//  - Title changed to "Your Links" (personal, not global)
//  - Each item now has a delete button
//  - onDelete prop is NEW → passed down from App via useUrlShortener
// ─────────────────────────────────────────────────────────────

import { API_BASE }             from "../api/urlApi";
import { formatDate, truncate } from "../utils/formatters";

function HistoryList({ history, historyLoading, onRefresh, onDelete }) {
  return (
    <div className="card card--history">

      {/* Card header with refresh button */}
      <div className="history-header">
        <h3 className="card-title">Your Links</h3>
        <button className="btn-refresh" onClick={onRefresh} title="Refresh">
          ↻
        </button>
      </div>

      {/* Loading state */}
      {historyLoading && (
        <div className="history-loading">
          <span className="spinner spinner--sm" />
          <span>Loading your links…</span>
        </div>
      )}

      {/* Empty state */}
      {!historyLoading && history.length === 0 && (
        <p className="history-empty">You haven't shortened any links yet. Go ahead! 🚀</p>
      )}

      {/* Links list */}
      {!historyLoading && history.length > 0 && (
        <ul className="history-list">
          {history.map((item) => (
            <HistoryItem
              key={item.id}
              item={item}
              onDelete={onDelete} // NEW: pass delete handler down
            />
          ))}
        </ul>
      )}

    </div>
  );
}

// ── Sub-component: a single history row ──────────────────────

function HistoryItem({ item, onDelete }) {
  const shortLink = `${API_BASE}/${item.shortURL}`;

  return (
    <li className="history-item">
      <div className="history-item__top">

        {/* Short link */}
        <a
          href={shortLink}
          target="_blank"
          rel="noopener noreferrer"
          className="history-short"
        >
          /{item.shortURL}
        </a>

        <div className="history-item__actions">
          {/* Visit counter */}
          <span className="history-visits">
            👁 {item.tracknumber} visit{item.tracknumber !== 1 ? "s" : ""}
          </span>

          {/* Delete button (NEW) */}
          <button
            className="btn-delete"
            onClick={() => onDelete(item.id)}
            title="Delete this link"
          >
            🗑
          </button>
        </div>

      </div>

      {/* Original URL, truncated */}
      <p className="history-original" title={item.originalURL}>
        {truncate(item.originalURL, 55)}
      </p>

      {/* Creation date */}
      <span className="history-date">{formatDate(item.createdAt)}</span>
    </li>
  );
}

export default HistoryList;