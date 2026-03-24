/**
 * middlewares/validateURL.js
 *
 * Express middleware that validates the `currentURL` field
 * from the request body before it reaches the controller.
 *
 * Why a middleware?
 *  - Keeps validation logic separate from business logic
 *  - Reusable: attach to any route that accepts a URL
 *  - Controller can assume `req.body.currentURL` is valid if this passes
 *
 * Usage in routes:
 *   router.post("/shorten", validateURL, urlController.shorten);
 */

const validateURL = (req, res, next) => {
  const { currentURL } = req.body;

  // Check 1: URL must be present
  if (!currentURL || currentURL.trim() === "") {
    return res.status(400).json({ error: "URL is required." });
  }

  // Check 2: URL must be a valid format (using the built-in URL parser)
  try {
    new URL(currentURL);
  } catch {
    return res.status(400).json({ error: "Invalid URL format. Please include http:// or https://" });
  }

  // All good — pass control to the next handler
  next();
};

export { validateURL };