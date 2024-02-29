import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc } from "firebase/firestore";

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

const writeData = async (currentURL) => {
    try {
      const docRef = await addDoc(collection(db, "samples"), {
        url:currentURL,
        shorturl : 'abc',
      });
      console.log("Document written with ID: ", docRef.id);
    } catch (e) {
      console.error("Error adding document: ", e);
    }
  };


export { writeData as default, firebaseApp,db };
