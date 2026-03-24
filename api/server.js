/**
 * server.js
 *
 * The entry point of the API.
 *
 * This file is intentionally kept minimal — its only job is to:
 *  1. Create the Express app
 *  2. Register global middleware (CORS, body parsing)
 *  3. Mount the route definitions
 *  4. Start listening on a port
 *
 * All actual logic lives in:
 *  - config/firebase.js    → Firebase setup
 *  - db/urlRepository.js   → Firestore queries
 *  - controllers/          → Business logic
 *  - routes/               → URL path definitions
 *  - middlewares/          → Reusable request guards
 */

import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import urlRoutes from "./routes/urlRoutes.js";

// Load environment variables from .env file
dotenv.config();

const app = express();

// ─── Global Middleware ────────────────────────────────────────────────────────

// Allow requests from the frontend (configured via CLIENT_URL in .env)
app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:3000",
  })
);

// Parse JSON and URL-encoded request bodies
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Serve any files in /static as public assets (optional)
app.use(express.static("static"));

// ─── Health Check ─────────────────────────────────────────────────────────────

app.get("/", (req, res) => {
  res.send("URL Shortener API is running.");
});

// ─── Routes ───────────────────────────────────────────────────────────────────

// All URL-related routes are handled by urlRoutes
// This covers: POST /shorten, GET /recent, GET /:shortURL
app.use("/", urlRoutes);

// ─── Start Server ─────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 4010;

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});