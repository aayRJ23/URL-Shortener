/**
 * middlewares/authMiddleware.js
 *
 * Verifies Firebase ID token from Authorization header.
 * Attaches req.user = { uid, email, username } for controllers to use.
 *
 * Key fix: instead of reading displayName from the token claims
 * (which requires a token refresh after signup to appear),
 * we use admin.auth().getUser(uid) to fetch the user record directly
 * from Firebase — this always has the latest displayName.
 */

import admin from "firebase-admin";
import dotenv from "dotenv";

dotenv.config();

// Initialize Firebase Admin SDK once (guard against re-initialization)
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId:   process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey:  process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
  });
}

const verifyToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  // Check: Authorization header must be present and follow "Bearer <token>" format
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized. No token provided." });
  }

  const idToken = authHeader.split("Bearer ")[1];

  try {
    // Step 1: Verify the token is valid and not expired
    const decodedToken = await admin.auth().verifyIdToken(idToken);

    // Step 2: Fetch the full user record from Firebase Admin
    // This is more reliable than token claims for displayName
    // because token claims only update after a token refresh
    const userRecord = await admin.auth().getUser(decodedToken.uid);

    // Username priority:
    // 1. displayName from user record (most reliable, always up to date)
    // 2. email prefix as fallback
    const username = userRecord.displayName || decodedToken.email.split("@")[0];

    // Attach user info to req — controllers read from here
    req.user = {
      uid:      decodedToken.uid,
      email:    decodedToken.email,
      username: username,
    };

    console.log(`[Auth] Verified user: ${username} (${decodedToken.uid})`);

    next();

  } catch (error) {
    console.error("[Auth] Token verification failed:", error.message);
    return res.status(401).json({ error: "Unauthorized. Invalid or expired token." });
  }
};

export { verifyToken };