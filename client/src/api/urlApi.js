// api/urlApi.js
// ─────────────────────────────────────────────────────────────
// All HTTP calls to the backend live here.
// If you ever change the API (e.g. move to Firebase directly),
// you only need to edit this one file.
// ─────────────────────────────────────────────────────────────

export const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:4010";

/**
 * Fetches the most recent shortened URLs from the backend.
 * @returns {Promise<Array>} Array of URL history objects
 */
export async function fetchRecentLinks() {
  const res = await fetch(`${API_BASE}/recent`);
  if (!res.ok) throw new Error("Failed to fetch history");
  return res.json();
}

/**
 * Sends a URL to the backend to be shortened.
 * @param {string} currentURL    - The original long URL
 * @param {string} customAlias   - Optional custom alias
 * @returns {Promise<{ shortedurl: string }>} The shortened URL key
 */
export async function shortenURL(currentURL, customAlias) {
  const res = await fetch(`${API_BASE}/shorten`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ currentURL, customAlias }),
  });

  const data = await res.json();

  if (!res.ok) {
    // Throw with the server's error message so the UI can display it
    throw new Error(data.error || "Something went wrong.");
  }

  return data;
}
