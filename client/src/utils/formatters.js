// utils/formatters.js
// ─────────────────────────────────────────────────────────────
// Pure helper functions with no side effects.
// Easy to test individually.
// ─────────────────────────────────────────────────────────────

/**
 * Formats an ISO date string into a human-readable date (e.g. "5 Jan 2024").
 * Returns "—" if the value is missing or invalid.
 * @param {string} iso
 * @returns {string}
 */
export function formatDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * Truncates a string to n characters and appends "…" if it was longer.
 * @param {string} str
 * @param {number} n
 * @returns {string}
 */
export function truncate(str, n) {
  if (!str) return "";
  return str.length > n ? str.slice(0, n) + "…" : str;
}
