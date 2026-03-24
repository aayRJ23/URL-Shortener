/**
 * config/firebase.js
 * FIXED: Server-side only uses Firebase Admin SDK.
 * The client SDK Firestore import is removed — all DB ops are in urlRepository.js
 * via Admin SDK. This file is now only needed if any route still imports from here.
 * Admin SDK is initialized in authMiddleware.js and urlRepository.js (guarded).
 */

import admin from "firebase-admin";
import dotenv from "dotenv";
dotenv.config();

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId:   process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey:  process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
  });
}

const db   = admin.firestore();
const auth = admin.auth();

export { db, auth };