/**
 * db/urlRepository.js
 *
 * This is the DATA ACCESS LAYER — the only place in the app that
 * directly talks to Firestore.
 *
 * Think of it like a mini-ORM for the "urls" collection.
 * Controllers never import Firestore functions directly; they use
 * these repository functions instead.
 *
 * Functions exported:
 *  - createShortURL(originalURL, shortURL)  → writes a new document
 *  - findURLByShortCode(shortURL)           → looks up + increments click count
 *  - getRecentURLs()                        → returns last 10 created URLs
 */

import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../config/firebase.js";

// The Firestore collection name — change in one place if ever renamed
const URLS_COLLECTION = "urls";

/**
 * createShortURL
 *
 * Saves a new URL mapping to Firestore.
 * Throws "ALIAS_TAKEN" error if the shortURL already exists,
 * so the controller can return the right HTTP response.
 *
 * @param {string} originalURL - The full URL to redirect to
 * @param {string} shortURL    - The short code / custom alias
 */
const createShortURL = async (originalURL, shortURL) => {
  // First check: is this alias already taken?
  const duplicateCheck = query(
    collection(db, URLS_COLLECTION),
    where("shortURL", "==", shortURL)
  );
  const existingDocs = await getDocs(duplicateCheck);

  if (!existingDocs.empty) {
    throw new Error("ALIAS_TAKEN");
  }

  // Safe to write — create the document
  const docRef = await addDoc(collection(db, URLS_COLLECTION), {
    url:         originalURL,
    shortURL:    shortURL,
    tracknumber: 0,                // click counter starts at zero
    createdAt:   serverTimestamp(), // Firestore server time for consistency
  });

  console.log(`[DB] New URL saved. Doc ID: ${docRef.id}`);
};

/**
 * findURLByShortCode
 *
 * Looks up a short URL in Firestore, increments its click counter,
 * and returns the original URL + updated count.
 *
 * Returns null if no match is found (controller will 404).
 *
 * @param {string} shortURL - The short code to look up
 * @returns {{ originalURL: string, tracknumber: number } | null}
 */
const findURLByShortCode = async (shortURL) => {
  const q = query(
    collection(db, URLS_COLLECTION),
    where("shortURL", "==", shortURL)
  );
  const snapshot = await getDocs(q);

  if (snapshot.empty) {
    return null; // short URL doesn't exist
  }

  const docSnap = snapshot.docs[0];
  const currentCount = docSnap.data().tracknumber || 0;
  const updatedCount = currentCount + 1;

  // Increment click counter each time this short URL is visited
  await updateDoc(docSnap.ref, { tracknumber: updatedCount });

  return {
    originalURL: docSnap.data().url,
    tracknumber: updatedCount,
  };
};

/**
 * getRecentURLs
 *
 * Returns the 10 most recently created short URLs,
 * ordered by creation time (newest first).
 *
 * @returns {Array<{ id, originalURL, shortURL, tracknumber, createdAt }>}
 */
const getRecentURLs = async () => {
  const q = query(
    collection(db, URLS_COLLECTION),
    orderBy("createdAt", "desc"),
    limit(10)
  );
  const snapshot = await getDocs(q);

  return snapshot.docs.map((doc) => ({
    id:          doc.id,
    originalURL: doc.data().url,
    shortURL:    doc.data().shortURL,
    tracknumber: doc.data().tracknumber || 0,
    // toDate() converts Firestore Timestamp → JS Date → ISO string
    createdAt:   doc.data().createdAt?.toDate().toISOString() || null,
  }));
};

export { createShortURL, findURLByShortCode, getRecentURLs };