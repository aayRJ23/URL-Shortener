/**
 * controllers/urlController.js
 *
 * This is the BUSINESS LOGIC LAYER.
 *
 * Controllers sit between the route definitions and the database.
 * Each function here:
 *  1. Reads data from the request (req)
 *  2. Calls the repository (DB layer) to do actual data work
 *  3. Sends back an appropriate HTTP response (res)
 *
 * Controllers do NOT import Firestore directly.
 * Controllers do NOT define routes.
 *
 * Functions exported:
 *  - shortenURL   → handles POST /shorten
 *  - redirectURL  → handles GET /:shortURL
 *  - getRecent    → handles GET /recent
 */

import { nanoid } from "nanoid";
import {
  createShortURL,
  findURLByShortCode,
  getRecentURLs,
} from "../db/urlRepository.js";

/**
 * shortenURL
 *
 * Accepts a long URL and an optional custom alias.
 * Generates a random short code if no alias is provided.
 * Delegates saving to the repository.
 *
 * POST /shorten
 * Body: { currentURL: string, customAlias?: string }
 */
const shortenURL = async (req, res) => {
  const { currentURL, customAlias } = req.body;

  // Use custom alias if provided, otherwise auto-generate a 5-char ID
  const shortURL = customAlias ? customAlias.trim() : nanoid(5);

  try {
    await createShortURL(currentURL, shortURL);
    console.log(`[Controller] Shortened: ${currentURL} → ${shortURL}`);
    res.status(201).json({ shortedurl: shortURL });
  } catch (error) {
    if (error.message === "ALIAS_TAKEN") {
      // The alias was already taken — tell the client clearly
      return res.status(409).json({
        error: "Custom alias already taken. Please try a different one.",
      });
    }
    console.error("[Controller] Error shortening URL:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

/**
 * redirectURL
 *
 * Looks up the short code from the URL params,
 * and redirects the user to the original URL.
 *
 * GET /:shortURL
 */
const redirectURL = async (req, res) => {
  const { shortURL } = req.params;

  try {
    const result = await findURLByShortCode(shortURL);

    if (!result) {
      // Short URL doesn't exist in our database
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
 * Returns the 10 most recently created short URLs.
 * Useful for showing a history/dashboard on the frontend.
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

export { shortenURL, redirectURL, getRecent };