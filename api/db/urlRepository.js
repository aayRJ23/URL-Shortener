/**
 * db/urlRepository.js
 *
 * DATA ACCESS LAYER — the only place in the app that directly talks to Firestore.
 *
 * Fix: getMyURLs no longer uses orderBy("createdAt") together with
 * where("userId") because that combination requires a Firestore composite
 * index to be manually created in the console.
 * Instead we sort the results in JavaScript after fetching — simpler and
 * works immediately without any index setup.
 *
 * Functions exported:
 *  - createShortURL(originalURL, shortURL, userId, username)
 *  - findURLByShortCode(shortURL)
 *  - getRecentURLs()
 *  - getMyURLs(userId)
 *  - deleteURL(docId, userId)
 */

import {
  collection,
  addDoc,
  getDoc,
  getDocs,
  deleteDoc,
  doc,
  query,
  where,
  orderBy,
  limit,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../config/firebase.js";

const URLS_COLLECTION = "urls";

/**
 * createShortURL
 *
 * Saves a new URL mapping to Firestore with userId and username.
 * Throws "ALIAS_TAKEN" if the shortURL already exists.
 *
 * @param {string} originalURL
 * @param {string} shortURL
 * @param {string} userId
 * @param {string} username
 */
const createShortURL = async (originalURL, shortURL, userId, username) => {
  // Check: is this alias already taken?
  const duplicateCheck = query(
    collection(db, URLS_COLLECTION),
    where("shortURL", "==", shortURL)
  );
  const existingDocs = await getDocs(duplicateCheck);

  if (!existingDocs.empty) {
    throw new Error("ALIAS_TAKEN");
  }

  const docRef = await addDoc(collection(db, URLS_COLLECTION), {
    url:         originalURL,
    shortURL:    shortURL,
    tracknumber: 0,
    userId:      userId,            // owner's Firebase UID
    username:    username,          // owner's display name
    createdAt:   serverTimestamp(),
  });

  console.log(`[DB] New URL saved. Doc ID: ${docRef.id}, Owner: ${username} (${userId})`);
};

/**
 * findURLByShortCode
 *
 * Looks up a short URL, increments click counter, returns original URL.
 * Public — no auth required.
 *
 * @param {string} shortURL
 * @returns {{ originalURL, tracknumber } | null}
 */
const findURLByShortCode = async (shortURL) => {
  const q = query(
    collection(db, URLS_COLLECTION),
    where("shortURL", "==", shortURL)
  );
  const snapshot = await getDocs(q);

  if (snapshot.empty) return null;

  const docSnap      = snapshot.docs[0];
  const currentCount = docSnap.data().tracknumber || 0;
  const updatedCount = currentCount + 1;

  await updateDoc(docSnap.ref, { tracknumber: updatedCount });

  return {
    originalURL: docSnap.data().url,
    tracknumber: updatedCount,
  };
};

/**
 * getRecentURLs
 *
 * Returns 10 most recent URLs globally. Public. Unchanged.
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
    username:    doc.data().username    || null,
    createdAt:   doc.data().createdAt?.toDate().toISOString() || null,
  }));
};

/**
 * getMyURLs  (fixed)
 *
 * Returns all URLs for a specific user.
 * Uses only where("userId") — no orderBy — to avoid needing
 * a composite Firestore index.
 * Sorting is done in JavaScript after fetching.
 *
 * @param {string} userId
 */
const getMyURLs = async (userId) => {
  console.log(`[DB] Fetching URLs for userId: ${userId}`);

  // Only filter by userId — no orderBy to avoid composite index requirement
  const q = query(
    collection(db, URLS_COLLECTION),
    where("userId", "==", userId)
  );
  const snapshot = await getDocs(q);

  console.log(`[DB] Found ${snapshot.docs.length} docs for user ${userId}`);

  const results = snapshot.docs.map((doc) => ({
    id:          doc.id,
    originalURL: doc.data().url,
    shortURL:    doc.data().shortURL,
    tracknumber: doc.data().tracknumber || 0,
    createdAt:   doc.data().createdAt?.toDate().toISOString() || null,
  }));

  // Sort newest first in JavaScript — no Firestore index needed
  results.sort((a, b) => {
    if (!a.createdAt) return 1;
    if (!b.createdAt) return -1;
    return new Date(b.createdAt) - new Date(a.createdAt);
  });

  return results;
};

/**
 * deleteURL  (unchanged)
 *
 * Deletes a URL doc by ID after ownership check.
 *
 * @param {string} docId
 * @param {string} userId
 */
const deleteURL = async (docId, userId) => {
  const docRef  = doc(db, URLS_COLLECTION, docId);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) {
    throw new Error("NOT_FOUND");
  }

  if (docSnap.data().userId !== userId) {
    throw new Error("FORBIDDEN");
  }

  await deleteDoc(docRef);
  console.log(`[DB] Deleted doc: ${docId} by user: ${userId}`);
};

export { createShortURL, findURLByShortCode, getRecentURLs, getMyURLs, deleteURL };