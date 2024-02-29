import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import firebase from "./firebase.js";
import shortid from "shortid";

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
  const hashed = shortid();
  var shortURL = hashed.slice(0, 4);
  console.log(`Short URL generated is : `, shortURL);
  // mapping is saved between encoded and original url , then firestore me save krlo
  firebase(currentURL, shortURL);
  // shorted url ko return krdo
  res.status(201).send({ shortedurl: shortURL });
});

const PORT = 4010;
app.listen(PORT, () => {
  console.log(`Server is running on the PORT ${PORT}`);
});
