// components/HistoryList.jsx
// ─────────────────────────────────────────────────────────────
// Displays recently shortened links in a card.
// Handles its own loading and empty states.
// ─────────────────────────────────────────────────────────────

import { API_BASE } from "../api/urlApi";
import { formatDate, truncate } from "../utils/formatters";

function HistoryList({ history, historyLoading, onRefresh }) {
  return (
    <div className="card card--history">

      {/* Card header with refresh button */}
      <div className="history-header">
        <h3 className="card-title">Recent Links</h3>
        <button className="btn-refresh" onClick={onRefresh} title="Refresh">
          ↻
        </button>
      </div>

      {/* Loading state */}
      {historyLoading && (
        <div className="history-loading">
          <span className="spinner spinner--sm" />
          <span>Loading history…</span>
        </div>
      )}

      {/* Empty state */}
      {!historyLoading && history.length === 0 && (
        <p className="history-empty">No links shortened yet. Be the first! 🚀</p>
      )}

      {/* History list */}
      {!historyLoading && history.length > 0 && (
        <ul className="history-list">
          {history.map((item) => (
            <HistoryItem key={item.id} item={item} />
          ))}
        </ul>
      )}

    </div>
  );
}

// ── Sub-component: a single history row ──────────────────────
// Kept here (not a separate file) since it's only used by HistoryList.

function HistoryItem({ item }) {
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

        {/* Visit counter */}
        <span className="history-visits">
          👁 {item.tracknumber} visit{item.tracknumber !== 1 ? "s" : ""}
        </span>

      </div>

      {/* Original URL, truncated so long URLs don't break layout */}
      <p className="history-original" title={item.originalURL}>
        {truncate(item.originalURL, 55)}
      </p>

      {/* Creation date */}
      <span className="history-date">{formatDate(item.createdAt)}</span>
    </li>
  );
}

export default HistoryList;
