import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  query,
  where,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBCVpGHpeTIV7cBuHG2Hu3NvWhIl-mvqfA",
  authDomain: "url-shortener-4921b.firebaseapp.com",
  projectId: "url-shortener-4921b",
  storageBucket: "url-shortener-4921b.appspot.com",
  messagingSenderId: "213271496074",
  appId: "1:213271496074:web:9ba10eeb5bc32483d53473",
};

const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);

const writeData = async (currentURL, shortURL) => {
  try {
    const docRef = await addDoc(collection(db, "urls"), {
      url: currentURL,
      shorturl: shortURL,
    });
    console.log("Document written with ID: ", docRef.id);
  } catch (e) {
    console.error("Error adding document: ", e);
  }
};

const findURL = async (shortURL) => {
  try {
    const q = query(collection(db, "urls"), where("shorturl", "==", shortURL));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      console.log("No matching document found for the short URL");
      return null;
    }
    const doc = querySnapshot.docs[0];
    const originalURL = doc.data().url;
    return originalURL;
  } catch (error) {
    console.error("Error retrieving document:", error);
  }
};

export { writeData, findURL, firebaseApp, db };
