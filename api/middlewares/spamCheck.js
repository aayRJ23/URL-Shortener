/**
 * api/middlewares/spamCheck.js  (v3 — expanded trusted domains, tuned threshold)
 *
 * Changes from v2:
 *  - TRUSTED_DOMAINS massively expanded to cover developer platforms,
 *    hosting services, news sites, and SaaS tools that the ML model
 *    incorrectly flags due to structural URL patterns (short paths,
 *    numeric IDs, hosting TLDs like .app).
 *  - SPAM_THRESHOLD raised from 0.62 → 0.70. The retrained GradientBoosting
 *    model scores real phishing URLs 0.85-0.99 and borderline-legit URLs
 *    0.55-0.69, so 0.70 is a clean separation point.
 *  - isTrustedDomain now also checks for well-known hosting suffixes
 *    (.netlify.app, .vercel.app, .railway.app, .render.com, .pages.dev,
 *     .github.io, .gitlab.io, .heroku.com, .glitch.me) as a suffix match,
 *    so ALL subdomains of these platforms are trusted without listing each one.
 *
 * Behaviour (unchanged):
 *  - Trusted domain  → fast-pass (skip ML)
 *  - Punycode domain → hard block
 *  - ML isSpam + confidence ≥ SPAM_THRESHOLD → reject 422
 *  - ML unavailable / timeout → fail open (allow through)
 */

import fetch from "node-fetch";

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || "http://localhost:5001";
const TIMEOUT_MS     = 3000;

// Raised from 0.62 → 0.70.
// GradientBoosting model: real phish = 0.85-0.99, borderline legit = 0.55-0.69
const SPAM_THRESHOLD = 0.70;

// ── Trusted exact domains ─────────────────────────────────────────────────────
// These are high-traffic, well-known platforms. URL patterns on these domains
// (long IDs, numeric slugs, hyphens, @-mentions) routinely confuse URL-only models.

const TRUSTED_DOMAINS = new Set([
  // Search / productivity
  "google.com", "gmail.com", "docs.google.com", "drive.google.com",
  "mail.google.com", "calendar.google.com", "meet.google.com",
  "bing.com", "duckduckgo.com", "yahoo.com",

  // Social / media
  "youtube.com", "twitter.com", "x.com", "instagram.com",
  "facebook.com", "linkedin.com", "reddit.com", "tiktok.com",
  "pinterest.com", "snapchat.com", "discord.com", "telegram.org",
  "signal.org", "whatsapp.com", "twitch.tv",

  // Dev / code
  "github.com", "gitlab.com", "bitbucket.org",
  "stackoverflow.com", "stackexchange.com",
  "npmjs.com", "pypi.org", "crates.io", "rubygems.org",
  "packagist.org", "pub.dev",
  "leetcode.com", "hackerrank.com", "codewars.com",
  "geeksforgeeks.org", "dev.to", "hashnode.com", "medium.com",
  "substack.com",

  // Docs / wikis
  "docs.python.org", "developer.mozilla.org", "mdn.io",
  "docs.github.com", "docs.microsoft.com", "learn.microsoft.com",
  "developer.apple.com", "developer.android.com",
  "reactjs.org", "nextjs.org", "vuejs.org", "angularjs.org",
  "angular.io", "svelte.dev", "solidjs.com",
  "tailwindcss.com", "getbootstrap.com",
  "nodejs.org", "deno.land", "bun.sh",
  "typescriptlang.org", "rust-lang.org", "go.dev", "kotlinlang.org",
  "docs.oracle.com", "cppreference.com",
  "wikipedia.org", "wikimedia.org", "archive.org",

  // Hosting / deployment platforms
  "vercel.com", "vercel.app",
  "netlify.com", "netlify.app",
  "render.com",
  "railway.app",
  "heroku.com",
  "glitch.com", "glitch.me",
  "replit.com", "replit.dev",
  "github.io", "gitlab.io",
  "pages.dev", "workers.dev",    // Cloudflare
  "fly.dev", "fly.io",
  "digitalocean.com", "app.digitalocean.com",
  "surge.sh",
  "firebase.app", "firebaseapp.com", "web.app",

  // Infra / cloud
  "aws.amazon.com", "console.aws.amazon.com",
  "cloud.google.com", "console.cloud.google.com",
  "azure.microsoft.com", "portal.azure.com",
  "cloudflare.com",

  // E-commerce / finance
  "amazon.com", "amazon.in", "amazon.co.uk",
  "flipkart.com", "ebay.com", "etsy.com",
  "stripe.com", "paypal.com",   // legitimate paypal.com (not paypal-*.tk)
  "shopify.com",

  // Tools / SaaS
  "notion.so", "airtable.com", "trello.com", "asana.com",
  "linear.app", "jira.atlassian.com", "confluence.atlassian.com",
  "atlassian.com", "monday.com", "clickup.com",
  "figma.com", "canva.com", "dribbble.com", "behance.net",
  "zoom.us", "loom.com", "calendly.com", "typeform.com",
  "sendgrid.com", "mailchimp.com", "hubspot.com",
  "twilio.com", "stripe.com", "algolia.com",
  "grafana.com", "datadog.com", "sentry.io", "postman.com",
  "supabase.com", "supabase.io", "firebase.google.com",
  "mongodb.com", "planetscale.com", "neon.tech", "upstash.com",

  // News / reference
  "news.ycombinator.com", "ycombinator.com",
  "producthunt.com", "techcrunch.com", "theverge.com",
  "wired.com", "arstechnica.com",
]);

// ── Trusted hosting suffixes ──────────────────────────────────────────────────
// Any hostname ENDING with one of these is treated as trusted.
// Covers user-project subdomains like myapp.netlify.app, user.github.io, etc.

const TRUSTED_SUFFIXES = [
  ".netlify.app",
  ".vercel.app",
  ".railway.app",
  ".render.com",
  ".heroku.com",           // e.g. myapp-123.heroku.com
  ".glitch.me",
  ".replit.dev",
  ".replit.app",
  ".github.io",
  ".gitlab.io",
  ".pages.dev",            // Cloudflare Pages
  ".workers.dev",          // Cloudflare Workers
  ".fly.dev",
  ".fly.io",
  ".web.app",              // Firebase Hosting
  ".firebaseapp.com",
  ".surge.sh",
];

/**
 * Returns true if hostname matches a trusted exact domain OR trusted suffix.
 */
function isTrustedDomain(url) {
  try {
    const hostname = new URL(url).hostname.toLowerCase();

    // Exact match or subdomain of a trusted domain
    for (const trusted of TRUSTED_DOMAINS) {
      if (hostname === trusted || hostname.endsWith("." + trusted)) {
        return true;
      }
    }

    // Suffix match (hosting platforms)
    for (const suffix of TRUSTED_SUFFIXES) {
      if (hostname.endsWith(suffix)) {
        return true;
      }
    }
  } catch {
    // malformed URL — validateURL.js already caught these
  }
  return false;
}

const spamCheck = async (req, res, next) => {
  const url = req.body.currentURL;

  // ── Trusted domain fast-pass ──────────────────────────────────────────────
  if (isTrustedDomain(url)) {
    console.log(`[SpamCheck] Trusted domain — skipping ML check for: ${url}`);
    req.spamResult = { isSpam: false, confidence: 0, reasons: [], mlAvailable: true };
    return next();
  }

  // ── Punycode hard block ───────────────────────────────────────────────────
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
    // ignore
  }

  // ── ML check ─────────────────────────────────────────────────────────────
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