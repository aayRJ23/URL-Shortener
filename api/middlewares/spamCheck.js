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

import fetch from "node-fetch";          // already installed in most setups
                                         // if not: npm install node-fetch@3

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || "http://localhost:5001";
const TIMEOUT_MS     = 3000; // 3 s — keep UX snappy

// Confidence threshold above which we reject
const SPAM_THRESHOLD = 0.5;

const spamCheck = async (req, res, next) => {
  const url = req.body.currentURL;

  try {
    // AbortController gives us a timeout on fetch (node-fetch v3 supports it)
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
      // Flask returned an error response — fail open
      console.warn(`[SpamCheck] ML service returned ${response.status} — allowing URL through`);
      req.spamResult = { isSpam: false, confidence: null, reasons: [], mlAvailable: false };
      return next();
    }

    const result = await response.json();
    // result = { isSpam: bool, confidence: float, reasons: string[] }

    console.log(`[SpamCheck] ${url} → isSpam: ${result.isSpam}, confidence: ${result.confidence}`);

    if (result.isSpam && result.confidence >= SPAM_THRESHOLD) {
      return res.status(422).json({
        error:      "This URL has been flagged as potentially malicious and cannot be shortened.",
        confidence: result.confidence,
        reasons:    result.reasons || [],
      });
    }

    // Safe — attach result so controller can persist it
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
    // Fail open: don't block the user because the ML service is down
    req.spamResult = { isSpam: false, confidence: null, reasons: [], mlAvailable: false };
    next();
  }
};

export { spamCheck };