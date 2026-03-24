/**
 * routes/urlRoutes.js
 * Added: GET /has-username (protected) — checks if the authenticated user
 * already has a username reserved. Used by Google sign-in to detect new vs returning users.
 */

import { Router } from "express";
import {
  shortenURL,
  redirectURL,
  getRecent,
  getMyLinks,
  deleteMyLink,
  checkUsername,
  reserveUsername,
  hasUsername,
} from "../controllers/urlController.js";
import { validateURL }  from "../middlewares/validateURL.js";
import { verifyToken }  from "../middlewares/authMiddleware.js";

const router = Router();

// ── Username routes (public) ──────────────────────────────────────────────────
router.get("/check-username", checkUsername);

// ── Username routes (protected) ───────────────────────────────────────────────
router.get("/has-username",      verifyToken, hasUsername);
router.post("/reserve-username", verifyToken, reserveUsername);

// ── Protected Routes ──────────────────────────────────────────────────────────
router.post("/shorten",        verifyToken, validateURL, shortenURL);
router.get("/my-links",        verifyToken, getMyLinks);
router.delete("/my-links/:id", verifyToken, deleteMyLink);

// ── Public Routes ─────────────────────────────────────────────────────────────
router.get("/recent",    getRecent);
router.get("/:shortURL", redirectURL);

export default router;