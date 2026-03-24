/**
 * config/firebase.js
 *
 * Responsible ONLY for initializing the Firebase app and exporting
 * the Firestore database instance.
 *
 * No business logic lives here — just setup.
 * Import `db` anywhere you need to talk to Firestore.
 */

import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
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

// db is the single Firestore instance used across the whole app
const db = getFirestore(firebaseApp);

export { firebaseApp, db };