/**
 * api/middlewares/validateURL.js  (v3 — fixed edge cases)
 *
 * Changes from v2:
 *  - DOMAIN_REGEX: now accepts single-label .app/.dev/.io TLDs properly.
 *    Old regex required TWO dots (e.g. foo.bar.com) which rejected valid
 *    hostnames like "vercel.app" or "railway.app" at the structural level.
 *    Fixed to accept any hostname with at least one dot and a 2+ char TLD.
 *  - PRIVATE_HOST_REGEX: added 0.0.0.0 and 169.254.x.x (link-local) blocks.
 *  - Trailing slash normalisation: a URL like "https://example.com" (no path)
 *    is now accepted without complaint.
 *  - Everything else (protocol whitelist, blocked protocols, length cap) unchanged.
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

// Accepts: foo.com, foo.bar.com, foo-bar.app, my-site.io, etc.
// Requires at least one dot and a TLD of 2+ chars.
const DOMAIN_REGEX = /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;

// Private / loopback / link-local IP ranges
const PRIVATE_HOST_REGEX =
  /^(localhost|0\.0\.0\.0|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.)/;

const validateURL = (req, res, next) => {
  const raw = (req.body.currentURL || "").trim();

  // ── 1. Presence ────────────────────────────────────────────────────────
  if (!raw) {
    return res.status(400).json({ error: "URL is required." });
  }

  // ── 2. Length cap ──────────────────────────────────────────────────────
  if (raw.length > MAX_URL_LENGTH) {
    return res.status(400).json({
      error: `URL is too long (max ${MAX_URL_LENGTH} characters).`,
    });
  }

  // ── 3. Blocked protocol fast-check ────────────────────────────────────
  const lowerRaw = raw.toLowerCase();
  for (const proto of BLOCKED_PROTOCOLS) {
    if (lowerRaw.startsWith(proto)) {
      return res.status(400).json({
        error: `Protocol "${proto.replace(":", "")}" is not allowed.`,
      });
    }
  }

  // ── 4. Parse & protocol whitelist ─────────────────────────────────────
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

  // ── 5. Hostname presence ───────────────────────────────────────────────
  const hostname = parsed.hostname;
  if (!hostname) {
    return res.status(400).json({ error: "URL is missing a valid hostname." });
  }

  // ── 6. Block private / loopback / link-local hosts ────────────────────
  if (PRIVATE_HOST_REGEX.test(hostname)) {
    return res.status(400).json({
      error: "URLs pointing to private or local addresses are not allowed.",
    });
  }

  // ── 7. Domain format check ─────────────────────────────────────────────
  // Skip for raw IPs — they pass structural check but may be blocked by spam check
  const isIP = /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname);
  if (!isIP && !DOMAIN_REGEX.test(hostname)) {
    return res.status(400).json({
      error: "URL has an invalid domain format.",
    });
  }

  req.parsedURL = parsed;
  next();
};

export { validateURL };