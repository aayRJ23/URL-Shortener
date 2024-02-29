import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import { writeData } from "./firebase.js";
import { findURL } from "./firebase.js";
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
  writeData(currentURL, shortURL);
  // shorted url ko return krdo
  res.status(201).send({ shortedurl: shortURL });
});

app.get("/:shortURL", async (req, res) => {
  const shortURL = req.params.shortURL;

  try {
    const originalURL = await findURL(shortURL);

    if (originalURL === null) {
      return res.status(404).send("Not Found");
    }

    console.log("Redirecting to:", originalURL);
    res.redirect(originalURL);
  } catch (error) {
    console.error("Error redirecting to original URL:", error);
    res.status(500).send("Internal Server Error");
  }
});

const PORT = 4010;
app.listen(PORT, () => {
  console.log(`Server is running on the PORT ${PORT}`);
});
