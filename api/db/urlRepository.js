/**
 * db/urlRepository.js
 * FIXED: All Firestore operations use Firebase Admin SDK.
 *
 * Key fix in this version:
 *  - isUsernameTaken now accepts an optional `claimerUid` param.
 *  - When the Auth scan finds a match, if match.uid === claimerUid, it means
 *    the user just set their own displayName and is legitimately claiming it.
 *    In that case we do NOT treat it as taken — we just write the doc directly.
 *  - claimUsername passes its uid into isUsernameTaken so the above applies.
 *  - This fixes the bug where signup always failed because the Auth scan found
 *    the just-created user and incorrectly blocked their own username claim.
 *
 *  - Also: orphaned username docs (backfilled:true but no matching Auth user)
 *    are cleaned up automatically during isUsernameTaken checks.
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

const db = admin.firestore();

const URLS_COLLECTION      = "urls";
const USERNAMES_COLLECTION = "usernames";

// ── Username uniqueness ───────────────────────────────────────────────────────

/**
 * isUsernameTaken
 *
 * @param {string} username     - already lowercased
 * @param {string} [claimerUid] - UID of the user trying to claim this name.
 *                                If the Auth scan finds this UID owning the name,
 *                                it is NOT considered taken (they set their own displayName).
 * @returns {Promise<boolean>}
 */
export const isUsernameTaken = async (username, claimerUid = null) => {
  // ── Check 1: Firestore reservation doc ───────────────────────────────────
  const docRef  = db.collection(USERNAMES_COLLECTION).doc(username);
  const docSnap = await docRef.get();

  if (docSnap.exists) {
    const data = docSnap.data();

    // If the doc belongs to the claimer themselves, not taken for them
    if (claimerUid && data.uid === claimerUid) {
      console.log(`[DB] Username "${username}" doc already owned by claimer ${claimerUid} — allowing`);
      return false;
    }

    // Orphan cleanup: if doc is a backfill, verify the user still exists in Auth
    if (data.backfilled) {
      try {
        await admin.auth().getUser(data.uid);
        console.log(`[DB] Username "${username}" found in usernames collection (backfilled, user exists)`);
        return true;
      } catch {
        // User was deleted (rollback) — orphaned doc, clean it up
        console.log(`[DB] Username "${username}" orphan doc detected (user deleted) — removing`);
        await docRef.delete();
        // Fall through to Auth scan below
      }
    } else {
      console.log(`[DB] Username "${username}" found in usernames collection`);
      return true;
    }
  }

  // ── Check 2: Firebase Admin Auth — find any user with this displayName ────
  try {
    const listResult = await admin.auth().listUsers(1000);
    const match = listResult.users.find(
      (u) => u.displayName?.toLowerCase() === username
    );

    if (match) {
      // If this is the claimer's own account, NOT taken
      if (claimerUid && match.uid === claimerUid) {
        console.log(`[DB] Username "${username}" found in Auth but belongs to claimer — allowing`);
        return false;
      }

      console.log(`[DB] Username "${username}" found in Firebase Auth (uid: ${match.uid})`);
      // Backfill Firestore doc for fast future checks
      await db.collection(USERNAMES_COLLECTION).doc(username).set({
        uid:        match.uid,
        createdAt:  admin.firestore.FieldValue.serverTimestamp(),
        backfilled: true,
      });
      return true;
    }
  } catch (err) {
    console.error("[DB] Admin listUsers failed during username check:", err.message);
  }

  return false;
};

/**
 * claimUsername
 * Reserves a username doc in Firestore.
 * Throws "USERNAME_TAKEN" if taken by someone else.
 *
 * @param {string} username - lowercased
 * @param {string} uid      - Firebase Auth UID of the claimer
 */
export const claimUsername = async (username, uid) => {
  // Pass uid so isUsernameTaken allows the claimer's own name through
  const taken = await isUsernameTaken(username, uid);
  if (taken) throw new Error("USERNAME_TAKEN");

  await db.collection(USERNAMES_COLLECTION).doc(username).set({
    uid,
    createdAt:  admin.firestore.FieldValue.serverTimestamp(),
    backfilled: false,
  });

  console.log(`[DB] Username reserved: "${username}" → ${uid}`);
};

// ── URL operations ────────────────────────────────────────────────────────────

export const createShortURL = async (originalURL, shortURL, userId, username) => {
  const snapshot = await db.collection(URLS_COLLECTION)
    .where("shortURL", "==", shortURL)
    .get();

  if (!snapshot.empty) throw new Error("ALIAS_TAKEN");

  const docRef = await db.collection(URLS_COLLECTION).add({
    url:         originalURL,
    shortURL:    shortURL,
    tracknumber: 0,
    userId:      userId,
    username:    username,
    createdAt:   admin.firestore.FieldValue.serverTimestamp(),
  });

  console.log(`[DB] New URL saved. Doc ID: ${docRef.id}, Owner: ${username} (${userId})`);
};

export const findURLByShortCode = async (shortURL) => {
  const snapshot = await db.collection(URLS_COLLECTION)
    .where("shortURL", "==", shortURL)
    .get();

  if (snapshot.empty) return null;

  const docSnap      = snapshot.docs[0];
  const currentCount = docSnap.data().tracknumber || 0;
  const updatedCount = currentCount + 1;
  await docSnap.ref.update({ tracknumber: updatedCount });

  return {
    originalURL: docSnap.data().url,
    tracknumber: updatedCount,
  };
};

export const getRecentURLs = async () => {
  const snapshot = await db.collection(URLS_COLLECTION)
    .orderBy("createdAt", "desc")
    .limit(10)
    .get();

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
  const snapshot = await db.collection(URLS_COLLECTION)
    .where("userId", "==", userId)
    .get();

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
  const docRef  = db.collection(URLS_COLLECTION).doc(docId);
  const docSnap = await docRef.get();
  if (!docSnap.exists)                  throw new Error("NOT_FOUND");
  if (docSnap.data().userId !== userId) throw new Error("FORBIDDEN");
  await docRef.delete();
  console.log(`[DB] Deleted doc: ${docId} by user: ${userId}`);
};