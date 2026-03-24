/**
 * routes/urlRoutes.js
 *
 * Defines all URL paths and maps them to controller functions.
 *
 * Changes from v1:
 *  - POST /shorten now goes through verifyToken (auth required)
 *  - GET  /my-links is NEW (auth required) → personal dashboard
 *  - DELETE /my-links/:id is NEW (auth required) → delete own link
 *  - GET  /recent stays public (no auth needed)
 *  - GET  /:shortURL stays public (redirect, no auth needed)
 *
 * Middleware order matters:
 *  verifyToken → validateURL → controller
 *
 * NOTE: /recent and /my-links MUST come before /:shortURL
 *       otherwise Express swallows them as short code lookups.
 */

import { Router } from "express";
import {
  shortenURL,
  redirectURL,
  getRecent,
  getMyLinks,
  deleteMyLink,
} from "../controllers/urlController.js";
import { validateURL }  from "../middlewares/validateURL.js";
import { verifyToken }  from "../middlewares/authMiddleware.js";

const router = Router();

// ── Protected Routes (login required) ─────────────────────────────────────────

// POST /shorten
// verifyToken → attach req.user, then validateURL → then shorten
router.post("/shorten", verifyToken, validateURL, shortenURL);

// GET /my-links
// Returns all links for the logged-in user (personal dashboard)
router.get("/my-links", verifyToken, getMyLinks);

// DELETE /my-links/:id
// Deletes a specific link by Firestore doc ID (ownership checked in repo)
router.delete("/my-links/:id", verifyToken, deleteMyLink);

// ── Public Routes (no login required) ─────────────────────────────────────────

// GET /recent
// Returns 10 most recent global links
// Must come BEFORE /:shortURL to avoid being swallowed by it
router.get("/recent", getRecent);

// GET /:shortURL
// Redirect to the original URL (public, works for everyone)
router.get("/:shortURL", redirectURL);

export default router;