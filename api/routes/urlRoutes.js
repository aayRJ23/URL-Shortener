/**
 * routes/urlRoutes.js
 *
 * Added:
 *  - GET  /check-username  → public, check if username is available
 *  - POST /reserve-username → protected, claim username after signup
 *
 * NOTE: these must come before /:shortURL to avoid being swallowed.
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
} from "../controllers/urlController.js";
import { validateURL }  from "../middlewares/validateURL.js";
import { verifyToken }  from "../middlewares/authMiddleware.js";

const router = Router();

// ── Username check (public) ───────────────────────────────────────────────────
// GET /check-username?username=xxx
router.get("/check-username", checkUsername);

// ── Protected Routes ──────────────────────────────────────────────────────────
router.post("/shorten",          verifyToken, validateURL, shortenURL);
router.get("/my-links",          verifyToken, getMyLinks);
router.delete("/my-links/:id",   verifyToken, deleteMyLink);
router.post("/reserve-username", verifyToken, reserveUsername);

// ── Public Routes ─────────────────────────────────────────────────────────────
// GET /recent must come BEFORE /:shortURL
router.get("/recent",     getRecent);
router.get("/:shortURL",  redirectURL);

export default router;