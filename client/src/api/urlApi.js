// api/urlApi.js
// Added:
//  - checkUsernameAvailable(username) → GET /check-username
//  - reserveUsername(username, token) → POST /reserve-username

export const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:4010";

const authHeader = (token) => ({
  "Content-Type":  "application/json",
  "Authorization": `Bearer ${token}`,
});

export async function fetchRecentLinks() {
  const res = await fetch(`${API_BASE}/recent`);
  if (!res.ok) throw new Error("Failed to fetch history");
  return res.json();
}

export async function shortenURL(currentURL, customAlias, token) {
  const res = await fetch(`${API_BASE}/shorten`, {
    method:  "POST",
    headers: authHeader(token),
    body:    JSON.stringify({ currentURL, customAlias }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Something went wrong.");
  return data;
}

export async function fetchMyLinks(token) {
  const res = await fetch(`${API_BASE}/my-links`, {
    headers: authHeader(token),
  });
  if (!res.ok) throw new Error("Failed to fetch your links");
  return res.json();
}

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

/**
 * checkUsernameAvailable
 * Public — no token needed.
 * @param {string} username
 * @returns {Promise<boolean>} true if available
 */
export async function checkUsernameAvailable(username) {
  const res  = await fetch(`${API_BASE}/check-username?username=${encodeURIComponent(username)}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Could not check username.");
  return data.available;
}

/**
 * reserveUsername
 * Called after Firebase account creation to claim the username in Firestore.
 * @param {string} username
 * @param {string} token - fresh Firebase ID token
 */
export async function reserveUsername(username, token) {
  const res = await fetch(`${API_BASE}/reserve-username`, {
    method:  "POST",
    headers: authHeader(token),
    body:    JSON.stringify({ username }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Could not reserve username.");
  return data;
}