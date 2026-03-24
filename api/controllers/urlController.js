/**
 * controllers/urlController.js
 *
 * BUSINESS LOGIC LAYER — sits between routes and the DB repository.
 *
 * Changes from v1:
 *  - shortenURL now reads userId + username from req.user (set by verifyToken middleware)
 *  - shortenURL now prefixes custom alias with username automatically
 *  - getRecent is unchanged (global, public)
 *  - getMyLinks is NEW → returns only the logged-in user's URLs
 *  - deleteMyLink is NEW → deletes a user's own link (with ownership check in repo)
 *
 * Functions exported:
 *  - shortenURL    → POST /shorten       (protected)
 *  - redirectURL   → GET  /:shortURL     (public)
 *  - getRecent     → GET  /recent        (public, unchanged)
 *  - getMyLinks    → GET  /my-links      (protected, NEW)
 *  - deleteMyLink  → DELETE /my-links/:id (protected, NEW)
 */

import { nanoid } from "nanoid";
import {
  createShortURL,
  findURLByShortCode,
  getRecentURLs,
  getMyURLs,
  deleteURL,
} from "../db/urlRepository.js";

/**
 * shortenURL
 *
 * Accepts a long URL and an optional custom alias.
 * If customAlias is provided, it is prefixed with the username:
 *   username="aayush", alias="my-link" → shortCode="aayush-my-link"
 * If no alias, a random 5-char nanoid is used.
 *
 * Requires: verifyToken middleware (req.user must be set)
 *
 * POST /shorten
 * Body: { currentURL: string, customAlias?: string }
 * Headers: Authorization: Bearer <token>
 */
const shortenURL = async (req, res) => {
  const { currentURL, customAlias } = req.body;

  // req.user is attached by verifyToken middleware
  const { uid: userId, username } = req.user;

  // Build the final short code:
  //  - custom alias → prefix with "username-" so it's namespaced
  //  - no alias     → random 5-char id (no prefix needed, stays short)
  const shortURL = customAlias
    ? `${username}-${customAlias.trim()}`
    : nanoid(5);

  try {
    await createShortURL(currentURL, shortURL, userId, username);
    console.log(`[Controller] Shortened: ${currentURL} → ${shortURL} (by ${username})`);
    res.status(201).json({ shortedurl: shortURL });
  } catch (error) {
    if (error.message === "ALIAS_TAKEN") {
      // The alias (after prefixing) was already taken — tell the client clearly
      return res.status(409).json({
        error: `Alias "${shortURL}" already taken. Please try a different one.`,
      });
    }
    console.error("[Controller] Error shortening URL:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

/**
 * redirectURL
 *
 * Looks up the short code from the URL params and redirects.
 * Public — no auth required.
 *
 * GET /:shortURL
 */
const redirectURL = async (req, res) => {
  const { shortURL } = req.params;

  try {
    const result = await findURLByShortCode(shortURL);

    if (!result) {
      return res.status(404).json({ error: "Short URL not found." });
    }

    const { originalURL, tracknumber } = result;
    console.log(`[Controller] Redirecting to: ${originalURL} (visit #${tracknumber})`);

    // 302 redirect → browser goes to the original URL
    res.redirect(originalURL);
  } catch (error) {
    console.error("[Controller] Error during redirect:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

/**
 * getRecent
 *
 * Returns the 10 most recently created short URLs globally.
 * Public — no auth required. Unchanged from v1.
 *
 * GET /recent
 */
const getRecent = async (req, res) => {
  try {
    const urls = await getRecentURLs();
    res.status(200).json(urls);
  } catch (error) {
    console.error("[Controller] Error fetching recent URLs:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

/**
 * getMyLinks  (NEW)
 *
 * Returns ALL links created by the currently logged-in user.
 * Reads userId from req.user (set by verifyToken middleware).
 *
 * Requires: verifyToken middleware
 *
 * GET /my-links
 */
const getMyLinks = async (req, res) => {
  const { uid: userId } = req.user;

  try {
    const urls = await getMyURLs(userId);
    res.status(200).json(urls);
  } catch (error) {
    console.error("[Controller] Error fetching user links:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

/**
 * deleteMyLink  (NEW)
 *
 * Deletes a specific link by its Firestore document ID.
 * The repo layer checks ownership — users cannot delete others' links.
 *
 * Requires: verifyToken middleware
 *
 * DELETE /my-links/:id
 * Params: id → Firestore document ID
 */
const deleteMyLink = async (req, res) => {
  const { id }         = req.params;  // Firestore doc ID
  const { uid: userId } = req.user;   // from verifyToken

  try {
    await deleteURL(id, userId);
    res.status(200).json({ message: "Link deleted successfully." });
  } catch (error) {
    if (error.message === "NOT_FOUND") {
      return res.status(404).json({ error: "Link not found." });
    }
    if (error.message === "FORBIDDEN") {
      // User tried to delete someone else's link
      return res.status(403).json({ error: "You do not own this link." });
    }
    console.error("[Controller] Error deleting link:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export { shortenURL, redirectURL, getRecent, getMyLinks, deleteMyLink };