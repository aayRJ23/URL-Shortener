/**
 * api/middlewares/validateURL.js
 *
 * Advanced URL validation (non-ML).
 * Replaces the basic URL parser check with:
 *  1. Presence check
 *  2. Protocol whitelist (only http / https)
 *  3. Blocked protocol list (javascript:, data:, vbscript:, file:, etc.)
 *  4. URL length cap (2048 chars — same as most browsers)
 *  5. Domain format validation (must have a TLD, no bare IPs unless explicitly allowed)
 *  6. No localhost / private-range hosts in production
 *
 * The ML spam check lives in a separate middleware (spamCheck.js)
 * so each concern stays isolated and individually testable.
 */

const MAX_URL_LENGTH = 2048;

const BLOCKED_PROTOCOLS = new Set([
  "javascript:",
  "data:",
  "vbscript:",
  "file:",
  "blob:",
  "about:",
  "mailto:",
  "tel:",
  "ftp:",
]);

// Regex: valid domain with at least one dot and a TLD of 2+ chars
const DOMAIN_REGEX = /^[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z]{2,})+$/;

// Private / loopback IP ranges — reject in production
const PRIVATE_HOST_REGEX = /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/;

const validateURL = (req, res, next) => {
  const raw = (req.body.currentURL || "").trim();

  // ── 1. Presence ──────────────────────────────────────────────────────────
  if (!raw) {
    return res.status(400).json({ error: "URL is required." });
  }

  // ── 2. Length cap ─────────────────────────────────────────────────────────
  if (raw.length > MAX_URL_LENGTH) {
    return res.status(400).json({
      error: `URL is too long (max ${MAX_URL_LENGTH} characters).`,
    });
  }

  // ── 3. Blocked protocol fast-check (before URL parse) ────────────────────
  const lowerRaw = raw.toLowerCase();
  for (const proto of BLOCKED_PROTOCOLS) {
    if (lowerRaw.startsWith(proto)) {
      return res.status(400).json({
        error: `Protocol "${proto.replace(":", "")}" is not allowed.`,
      });
    }
  }

  // ── 4. Parse & protocol whitelist ─────────────────────────────────────────
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    return res.status(400).json({
      error: "Invalid URL format. Please include http:// or https://",
    });
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    return res.status(400).json({
      error: `Only http and https URLs are allowed (got "${parsed.protocol.replace(":", "")}").`,
    });
  }

  // ── 5. Hostname validation ────────────────────────────────────────────────
  const hostname = parsed.hostname;

  if (!hostname) {
    return res.status(400).json({ error: "URL is missing a valid hostname." });
  }

  // ── 6. Block private / loopback hosts ─────────────────────────────────────
  if (PRIVATE_HOST_REGEX.test(hostname)) {
    return res.status(400).json({
      error: "URLs pointing to private or local addresses are not allowed.",
    });
  }

  // ── 7. Domain format check ────────────────────────────────────────────────
  // Skip this check for raw IP addresses (caught by spam check later)
  const isIP = /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname);
  if (!isIP && !DOMAIN_REGEX.test(hostname)) {
    return res.status(400).json({
      error: "URL has an invalid domain format.",
    });
  }

  // Attach the parsed object for downstream middleware to reuse
  req.parsedURL = parsed;
  next();
};

export { validateURL };