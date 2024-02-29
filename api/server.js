import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
// import { firebaseApp } from "./firebase";
import firebase from "./firebase.js";

const app = express();

app.use(
  cors({
    origin: "http://localhost:3000",
  })
);

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("static"));

app.get("/", (req, res) => {
  res.send("OK");
});

app.post("/shorten", (req, res) => {
  //console.log(req.body.currentURL);
  const { currentURL } = req.body;

  //url shorten karo

  //then firestore me save krlo
  firebase(currentURL);

  res.status(201).send({shortedurl:'abc' });
});

const PORT = 4010;
app.listen(PORT, () => {
  console.log(`Server is running on the PORT ${PORT}`);
});
