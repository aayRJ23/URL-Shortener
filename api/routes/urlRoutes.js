/**
 * api/routes/urlRoutes.js
 * Added spamCheck middleware between validateURL and shortenURL.
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
import { validateURL } from "../middlewares/validateURL.js";
import { spamCheck }   from "../middlewares/spamCheck.js";
import { verifyToken } from "../middlewares/authMiddleware.js";

const router = Router();

// ── Username routes (public) ──────────────────────────────────────────────────
router.get("/check-username", checkUsername);

// ── Username routes (protected) ───────────────────────────────────────────────
router.get("/has-username",      verifyToken, hasUsername);
router.post("/reserve-username", verifyToken, reserveUsername);

// ── Protected Routes ──────────────────────────────────────────────────────────
// validateURL → spamCheck → shortenURL
router.post("/shorten",        verifyToken, validateURL, spamCheck, shortenURL);
router.get("/my-links",        verifyToken, getMyLinks);
router.delete("/my-links/:id", verifyToken, deleteMyLink);

// ── Public Routes ─────────────────────────────────────────────────────────────
router.get("/recent",    getRecent);
router.get("/:shortURL", redirectURL);

export default router;