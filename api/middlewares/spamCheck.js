/**
 * api/middlewares/spamCheck.js
 *
 * Calls the Flask ML microservice to detect phishing/spam URLs.
 * Sits in the middleware chain AFTER validateURL and BEFORE the controller.
 *
 * Route usage:
 *   router.post("/shorten", verifyToken, validateURL, spamCheck, shortenURL);
 *
 * Behaviour:
 *  - If Flask is unreachable or times out → ALLOW (fail open) and log a warning.
 *    This ensures the shortener keeps working if the ML service is down.
 *  - If Flask returns isSpam: true → REJECT with 422 + reasons.
 *  - If Flask returns isSpam: false → attach spamResult to req and continue.
 *
 * req.spamResult is then available in the controller to persist to Firestore.
 */

import fetch from "node-fetch";

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || "http://localhost:5001";
const TIMEOUT_MS     = 3000;

// Raised from 0.5 → 0.62 to reduce false positives on legitimate URLs.
// The retrained URL-only model scores genuinely suspicious URLs 0.75+,
// while borderline-legitimate URLs (stackoverflow, docs.google) score ~0.65–0.70.
const SPAM_THRESHOLD = 0.62;

// Trusted domains that bypass ML check entirely.
// These are high-traffic, well-known platforms whose URL patterns
// (long path IDs, numeric slugs, brand names in path) confuse URL-only models.
const TRUSTED_DOMAINS = new Set([
  "google.com", "youtube.com", "github.com", "stackoverflow.com",
  "wikipedia.org", "twitter.com", "instagram.com", "facebook.com",
  "linkedin.com", "reddit.com", "amazon.com", "amazon.in",
  "flipkart.com", "npmjs.com", "pypi.org", "docs.google.com",
  "mail.google.com", "drive.google.com", "leetcode.com",
  "geeksforgeeks.org", "medium.com", "dev.to", "notion.so",
]);

/**
 * Returns true if the hostname ends with any trusted domain.
 * e.g. "docs.google.com" → matches "google.com" → trusted
 */
function isTrustedDomain(url) {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    for (const trusted of TRUSTED_DOMAINS) {
      if (hostname === trusted || hostname.endsWith("." + trusted)) {
        return true;
      }
    }
  } catch {
    // ignore malformed URLs — validateURL.js already caught them
  }
  return false;
}

const spamCheck = async (req, res, next) => {
  const url = req.body.currentURL;

  // ── Trusted domain fast-pass ───────────────────────────────────────────────
  if (isTrustedDomain(url)) {
    console.log(`[SpamCheck] Trusted domain — skipping ML check for: ${url}`);
    req.spamResult = { isSpam: false, confidence: 0, reasons: [], mlAvailable: true };
    return next();
  }

  // ── Punycode safety net ────────────────────────────────────────────────────
  // The ML model occasionally under-scores punycode (xn--) phishing domains.
  // Block them directly here as a hard rule since punycode in a hostname
  // is almost exclusively used for homograph/lookalike attacks.
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    if (hostname.includes("xn--")) {
      console.log(`[SpamCheck] Punycode hostname detected — blocking: ${url}`);
      return res.status(422).json({
        error:      "This URL has been flagged as potentially malicious and cannot be shortened.",
        confidence: 1.0,
        reasons:    ["Uses Punycode (xn--) encoding — possible homograph/lookalike attack"],
      });
    }
  } catch {
    // ignore — validateURL already caught malformed URLs
  }

  try {
    const controller = new AbortController();
    const timer      = setTimeout(() => controller.abort(), TIMEOUT_MS);

    let response;
    try {
      response = await fetch(`${ML_SERVICE_URL}/predict`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ url }),
        signal:  controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      console.warn(`[SpamCheck] ML service returned ${response.status} — allowing URL through`);
      req.spamResult = { isSpam: false, confidence: null, reasons: [], mlAvailable: false };
      return next();
    }

    const result = await response.json();
    console.log(`[SpamCheck] ${url} → isSpam: ${result.isSpam}, confidence: ${result.confidence}`);

    if (result.isSpam && result.confidence >= SPAM_THRESHOLD) {
      return res.status(422).json({
        error:      "This URL has been flagged as potentially malicious and cannot be shortened.",
        confidence: result.confidence,
        reasons:    result.reasons || [],
      });
    }

    req.spamResult = {
      isSpam:      false,
      confidence:  result.confidence,
      reasons:     result.reasons || [],
      mlAvailable: true,
    };
    next();

  } catch (err) {
    if (err.name === "AbortError") {
      console.warn("[SpamCheck] ML service timed out — allowing URL through (fail open)");
    } else {
      console.warn("[SpamCheck] ML service unreachable:", err.message, "— allowing URL through");
    }
    req.spamResult = { isSpam: false, confidence: null, reasons: [], mlAvailable: false };
    next();
  }
};

export { spamCheck };