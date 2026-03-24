/**
 * config/firebase.js
 *
 * Responsible ONLY for initializing the Firebase app and exporting:
 *  - db   → Firestore database instance (used by urlRepository)
 *  - auth → Firebase Auth instance (used by authMiddleware)
 *
 * No business logic lives here — just setup.
 */

import { initializeApp } from "firebase/app";
import { getFirestore }   from "firebase/firestore";
import { getAuth }        from "firebase/auth";
import dotenv from "dotenv";

dotenv.config();

const firebaseConfig = {
  apiKey:            process.env.FIREBASE_API_KEY,
  authDomain:        process.env.FIREBASE_AUTH_DOMAIN,
  projectId:         process.env.FIREBASE_PROJECT_ID,
  storageBucket:     process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId:             process.env.FIREBASE_APP_ID,
};

const firebaseApp = initializeApp(firebaseConfig);

// db   → used in db/urlRepository.js for all Firestore queries
// auth → used in middlewares/authMiddleware.js to verify tokens
const db   = getFirestore(firebaseApp);
const auth = getAuth(firebaseApp);

export { firebaseApp, db, auth };