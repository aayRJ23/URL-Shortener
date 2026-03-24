/**
 * routes/urlRoutes.js
 *
 * This file ONLY defines the URL paths (routes) and maps them
 * to the right controller function.
 *
 * No business logic here — routes are just the "address" layer.
 * Think of this as a table of contents:
 *   "When this URL is hit, call this function."
 *
 * The validateURL middleware runs before the controller on POST /shorten
 * to reject bad input early, before any DB calls happen.
 */

import { Router } from "express";
import { shortenURL, redirectURL, getRecent } from "../controllers/urlController.js";
import { validateURL } from "../middlewares/validateURL.js";

const router = Router();

// POST /shorten
// → Validate the URL first (middleware), then shorten it (controller)
router.post("/shorten", validateURL, shortenURL);

// GET /recent
// → Return the 10 most recently created short URLs
// NOTE: This route MUST come before /:shortURL to avoid being swallowed by it
router.get("/recent", getRecent);

// GET /:shortURL
// → Redirect to the original URL
router.get("/:shortURL", redirectURL);

export default router;