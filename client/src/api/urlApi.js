// api/urlApi.js
// ─────────────────────────────────────────────────────────────
// All HTTP calls to the backend live here.
//
// Changes from v1:
//  - shortenURL now accepts a token and sends it in Authorization header
//  - fetchMyLinks is NEW → GET /my-links (user's personal links)
//  - deleteLink is NEW   → DELETE /my-links/:id
//  - fetchRecentLinks is unchanged (public, no token needed)
//
// All protected functions accept `token` as their last parameter.
// Get it in the hook via: const token = await getToken();  (from useAuth)
// ─────────────────────────────────────────────────────────────

export const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:4010";

/**
 * Helper: builds the Authorization header object.
 * Keeps header construction in one place.
 * @param {string} token - Firebase ID token
 */
const authHeader = (token) => ({
  "Content-Type":  "application/json",
  "Authorization": `Bearer ${token}`,
});

/**
 * fetchRecentLinks
 * Public — no token needed. Unchanged from v1.
 * @returns {Promise<Array>}
 */
export async function fetchRecentLinks() {
  const res = await fetch(`${API_BASE}/recent`);
  if (!res.ok) throw new Error("Failed to fetch history");
  return res.json();
}

/**
 * shortenURL
 * Protected — requires a valid Firebase ID token.
 *
 * @param {string} currentURL  - The original long URL
 * @param {string} customAlias - Optional custom alias (will be prefixed by backend)
 * @param {string} token       - Firebase ID token from getToken()
 * @returns {Promise<{ shortedurl: string }>}
 */
export async function shortenURL(currentURL, customAlias, token) {
  const res = await fetch(`${API_BASE}/shorten`, {
    method:  "POST",
    headers: authHeader(token),
    body:    JSON.stringify({ currentURL, customAlias }),
  });

  const data = await res.json();

  if (!res.ok) {
    // Throw with server's error message so the UI can display it directly
    throw new Error(data.error || "Something went wrong.");
  }

  return data;
}

/**
 * fetchMyLinks  (NEW)
 * Returns all links belonging to the logged-in user.
 * Protected — requires token.
 *
 * @param {string} token - Firebase ID token
 * @returns {Promise<Array>}
 */
export async function fetchMyLinks(token) {
  const res = await fetch(`${API_BASE}/my-links`, {
    headers: authHeader(token),
  });
  if (!res.ok) throw new Error("Failed to fetch your links");
  return res.json();
}

/**
 * deleteLink  (NEW)
 * Deletes a specific link by its Firestore document ID.
 * Protected — requires token. Backend verifies ownership.
 *
 * @param {string} docId  - Firestore document ID (item.id from the list)
 * @param {string} token  - Firebase ID token
 */
export async function deleteLink(docId, token) {
  const res = await fetch(`${API_BASE}/my-links/${docId}`, {
    method:  "DELETE",
    headers: authHeader(token),
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || "Failed to delete link.");
  }
}