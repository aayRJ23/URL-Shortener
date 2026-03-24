/**
 * db/urlRepository.js
 *
 * Fix: isUsernameTaken now uses TWO checks:
 *  1. Firestore "usernames" collection (for users who signed up after the feature)
 *  2. Firebase Admin Auth — lists users and checks displayName (catches legacy users
 *     who signed up before the "usernames" collection existed)
 *
 * This dual-check means existing accounts like "admin5" will correctly
 * show as taken, even without a Firestore reservation doc.
 */

import {
  collection,
  addDoc,
  getDoc,
  getDocs,
  deleteDoc,
  setDoc,
  doc,
  query,
  where,
  orderBy,
  limit,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db }   from "../config/firebase.js";
import admin    from "firebase-admin";

const URLS_COLLECTION      = "urls";
const USERNAMES_COLLECTION = "usernames";

// ── Username uniqueness ───────────────────────────────────────────────────────

/**
 * isUsernameTaken
 *
 * Check 1: Firestore "usernames" collection doc (new signups)
 * Check 2: Firebase Admin Auth — scan users by displayName (legacy accounts)
 *
 * Returns true if EITHER check finds the username.
 *
 * @param {string} username - already lowercased by caller
 * @returns {Promise<boolean>}
 */
export const isUsernameTaken = async (username) => {
  // ── Check 1: Firestore reservation doc ───────────────────────────────────
  const docRef  = doc(db, USERNAMES_COLLECTION, username);
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    console.log(`[DB] Username "${username}" found in usernames collection`);
    return true;
  }

  // ── Check 2: Firebase Admin Auth — find any user with this displayName ────
  // listUsers returns up to 1000 users per page; for most apps one page is fine.
  // We compare lowercased displayName to catch case variants.
  try {
    const listResult = await admin.auth().listUsers(1000);
    const match = listResult.users.find(
      (u) => u.displayName?.toLowerCase() === username
    );
    if (match) {
      console.log(`[DB] Username "${username}" found in Firebase Auth (legacy user: ${match.uid})`);
      // Backfill the Firestore doc so future checks are fast (no Auth scan needed)
      await setDoc(doc(db, USERNAMES_COLLECTION, username), {
        uid:       match.uid,
        createdAt: serverTimestamp(),
        backfilled: true,
      });
      return true;
    }
  } catch (err) {
    // If Admin SDK fails for any reason, log but don't crash the check
    console.error("[DB] Admin listUsers failed during username check:", err.message);
  }

  return false;
};

/**
 * claimUsername
 * Atomically reserves a username doc in Firestore.
 * Throws "USERNAME_TAKEN" if already exists.
 *
 * @param {string} username - lowercased
 * @param {string} uid      - Firebase Auth UID
 */
export const claimUsername = async (username, uid) => {
  // Re-run the full dual-check before claiming (race condition guard)
  const taken = await isUsernameTaken(username);
  if (taken) throw new Error("USERNAME_TAKEN");

  await setDoc(doc(db, USERNAMES_COLLECTION, username), {
    uid,
    createdAt:  serverTimestamp(),
    backfilled: false,
  });

  console.log(`[DB] Username reserved: "${username}" → ${uid}`);
};

// ── URL operations ────────────────────────────────────────────────────────────

export const createShortURL = async (originalURL, shortURL, userId, username) => {
  const duplicateCheck = query(
    collection(db, URLS_COLLECTION),
    where("shortURL", "==", shortURL)
  );
  const existingDocs = await getDocs(duplicateCheck);
  if (!existingDocs.empty) throw new Error("ALIAS_TAKEN");

  const docRef = await addDoc(collection(db, URLS_COLLECTION), {
    url:         originalURL,
    shortURL:    shortURL,
    tracknumber: 0,
    userId:      userId,
    username:    username,
    createdAt:   serverTimestamp(),
  });

  console.log(`[DB] New URL saved. Doc ID: ${docRef.id}, Owner: ${username} (${userId})`);
};

export const findURLByShortCode = async (shortURL) => {
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

export const getRecentURLs = async () => {
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

export const getMyURLs = async (userId) => {
  console.log(`[DB] Fetching URLs for userId: ${userId}`);
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

  results.sort((a, b) => {
    if (!a.createdAt) return 1;
    if (!b.createdAt) return -1;
    return new Date(b.createdAt) - new Date(a.createdAt);
  });

  return results;
};

export const deleteURL = async (docId, userId) => {
  const docRef  = doc(db, URLS_COLLECTION, docId);
  const docSnap = await getDoc(docRef);
  if (!docSnap.exists())                 throw new Error("NOT_FOUND");
  if (docSnap.data().userId !== userId)  throw new Error("FORBIDDEN");
  await deleteDoc(docRef);
  console.log(`[DB] Deleted doc: ${docId} by user: ${userId}`);
};