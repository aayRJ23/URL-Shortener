/**
 * controllers/urlController.js
 * Added: hasUsername handler for GET /has-username
 */

import { nanoid } from "nanoid";
import {
  createShortURL,
  findURLByShortCode,
  getRecentURLs,
  getMyURLs,
  deleteURL,
  isUsernameTaken,
  claimUsername,
} from "../db/urlRepository.js";

const shortenURL = async (req, res) => {
  const { currentURL, customAlias } = req.body;
  const { uid: userId, username }   = req.user;
  const spamResult                  = req.spamResult || {};

  const suffix   = customAlias ? customAlias.trim() : nanoid(5);
  const shortURL = `${username}-${suffix}`;

  try {
    await createShortURL(currentURL, shortURL, userId, username, spamResult);
    console.log(`[Controller] Shortened: ${currentURL} → ${shortURL} (by ${username})`);
    res.status(201).json({ shortedurl: shortURL });
  } catch (error) {
    if (error.message === "ALIAS_TAKEN") {
      return res.status(409).json({
        error: `Alias "${shortURL}" already taken. Please try a different one.`,
      });
    }
    console.error("[Controller] Error shortening URL:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

const redirectURL = async (req, res) => {
  const { shortURL } = req.params;
  try {
    const result = await findURLByShortCode(shortURL);
    if (!result) return res.status(404).json({ error: "Short URL not found." });
    const { originalURL, tracknumber } = result;
    console.log(`[Controller] Redirecting to: ${originalURL} (visit #${tracknumber})`);
    res.redirect(originalURL);
  } catch (error) {
    console.error("[Controller] Error during redirect:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

const getRecent = async (req, res) => {
  try {
    const urls = await getRecentURLs();
    res.status(200).json(urls);
  } catch (error) {
    console.error("[Controller] Error fetching recent URLs:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

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

const deleteMyLink = async (req, res) => {
  const { id }          = req.params;
  const { uid: userId } = req.user;
  try {
    await deleteURL(id, userId);
    res.status(200).json({ message: "Link deleted successfully." });
  } catch (error) {
    if (error.message === "NOT_FOUND") return res.status(404).json({ error: "Link not found." });
    if (error.message === "FORBIDDEN") return res.status(403).json({ error: "You do not own this link." });
    console.error("[Controller] Error deleting link:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

const checkUsername = async (req, res) => {
  const { username } = req.query;
  if (!username || username.trim().length < 3) {
    return res.status(400).json({ error: "Username must be at least 3 characters." });
  }
  try {
    const taken = await isUsernameTaken(username.trim().toLowerCase());
    res.status(200).json({ available: !taken });
  } catch (error) {
    console.error("[Controller] Error checking username:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

const reserveUsername = async (req, res) => {
  const { username }    = req.body;
  const { uid: userId } = req.user;

  if (!username || username.trim().length < 3) {
    return res.status(400).json({ error: "Username must be at least 3 characters." });
  }
  try {
    await claimUsername(username.trim().toLowerCase(), userId);
    res.status(201).json({ message: "Username reserved." });
  } catch (error) {
    if (error.message === "USERNAME_TAKEN") {
      return res.status(409).json({ error: "This username is already taken." });
    }
    console.error("[Controller] Error reserving username:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

/**
 * hasUsername — GET /has-username (protected)
 * Returns { hasUsername: true/false }
 * Used by Google sign-in to detect returning vs new Google users.
 */
const hasUsername = async (req, res) => {
  const { uid: userId } = req.user;
  try {
    // Search usernames collection for a doc with this uid
    const admin = (await import("firebase-admin")).default;
    const db    = admin.firestore();
    const snap  = await db.collection("usernames").where("uid", "==", userId).limit(1).get();
    res.status(200).json({ hasUsername: !snap.empty });
  } catch (error) {
    console.error("[Controller] Error checking hasUsername:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export { shortenURL, redirectURL, getRecent, getMyLinks, deleteMyLink, checkUsername, reserveUsername, hasUsername };