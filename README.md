# 🔗 TrimLynk - URL Shortener — AI-Powered with Phishing Detection

<div align="center">

![URL Shortener Banner](https://img.shields.io/badge/URL%20Shortener-AI%20Powered-6366f1?style=for-the-badge&logo=link&logoColor=white)

[![React](https://img.shields.io/badge/React-18.2-61DAFB?style=flat-square&logo=react)](https://reactjs.org/)
[![Node.js](https://img.shields.io/badge/Node.js-Express-339933?style=flat-square&logo=node.js)](https://nodejs.org/)
[![Python](https://img.shields.io/badge/Python-Flask-3776AB?style=flat-square&logo=python)](https://flask.palletsprojects.com/)
[![Firebase](https://img.shields.io/badge/Firebase-Firestore%20%2B%20Auth-FFCA28?style=flat-square&logo=firebase)](https://firebase.google.com/)
[![ML](https://img.shields.io/badge/ML-Random%20Forest%2091%25%20Acc-FF6B6B?style=flat-square&logo=scikit-learn)](https://scikit-learn.org/)
[![License](https://img.shields.io/badge/License-ISC-blue?style=flat-square)](LICENSE)

**A full-stack URL shortener with a built-in machine learning phishing detector, custom usernames, and Firebase authentication — including Google Sign-In.**


</div>

---

## ✨ Features

### 🔐 Authentication
- Email/Password sign-up with **username reservation** (atomic, conflict-safe)
- **Google Sign-In** with new-user username-picker flow
- Firebase ID Token verification on every protected API route
- Automatic rollback if username reservation fails after account creation

### 🔗 URL Shortening
- Shorten any valid `http`/`https` URL instantly
- **Custom alias** support — your short URLs look like `domain/username-my-link`
- Auto-generated 5-character short codes via `nanoid` when no alias is given
- Alias conflict detection with clear error messaging
- **Visit tracking** — every redirect increments a counter

### 🛡️ AI Phishing Detection
- **Random Forest ML model** (91.12% accuracy, 97.05% ROC-AUC)
- 55 URL-structure features extracted in real-time
- Tuned spam threshold (0.70) separates real phishing (0.85–0.99) from borderline-legit (0.55–0.69)
- **Trusted domain fast-pass** — 100+ known-good domains skip ML entirely
- **Punycode hard block** — catches homograph/lookalike attacks instantly
- Fail-open design: if ML service is down, URLs are allowed through (no false blocks)
- Spam panel in UI shows confidence % and specific reason list

### 📋 Link Management
- Personal dashboard showing all your shortened links
- Click count / visit tracker per link
- One-click delete (owner-only, enforced server-side)
- **Copy to clipboard** with 2-second confirmation feedback

### ✅ URL Validation (Multi-layer)
- Protocol whitelist (only `http`/`https`)
- Blocked protocols: `javascript:`, `data:`, `ftp:`, `mailto:`, `blob:`, etc.
- Max URL length: 2048 characters
- Private/loopback IP blocking (`localhost`, `127.x`, `192.168.x`, `10.x`, `169.254.x`)
- Domain format validation with regex
- Punycode hostname detection

---

## 🏗️ Architecture

```
URL-Shortener/
│
├── client/                     # React 18 Frontend (CRA)
│   └── src/
│       ├── components/         # UI Components
│       │   ├── AppContent.jsx  # Main layout orchestrator
│       │   ├── AuthForm.jsx    # Login/Signup/Google flow
│       │   ├── ShortenForm.jsx # URL input + alias + spam panel
│       │   ├── ResultBox.jsx   # Short URL result + QR code
│       │   ├── HistoryList.jsx # Personal link dashboard
│       │   ├── Header.jsx
│       │   └── Footer.jsx
│       ├── context/
│       │   ├── AuthContext.jsx # Firebase auth state + Google flow
│       │   └── ToastContext.jsx
│       ├── hooks/
│       │   └── useUrlShortener.js  # All shortening logic
│       ├── api/
│       │   └── urlApi.js       # API calls to backend
│       └── utils/
│           └── formatters.js
│
├── api/                        # Node.js / Express Backend
│   ├── server.js               # Entry point, CORS, routes
│   ├── routes/
│   │   └── urlRoutes.js        # Route definitions
│   ├── controllers/
│   │   └── urlController.js    # Business logic
│   ├── middlewares/
│   │   ├── authMiddleware.js   # Firebase token verification
│   │   ├── validateURL.js      # URL format validation
│   │   └── spamCheck.js        # ML service caller + trusted domain list
│   ├── db/
│   │   └── urlRepository.js    # Firestore CRUD operations
│   └── config/
│       └── firebase.js         # Firebase Admin SDK config
│
└── ml_service/                 # Python / Flask ML Microservice
    ├── app.py                  # Flask server (port 5001)
    ├── predictor.py            # Model loader + prediction logic
    ├── features.py             # 55-feature URL extractor
    ├── train.py                # Model training script
    ├── model.pkl               # Trained Random Forest model
    └── requirements.txt
```

### Request Flow

```
Browser → React Client
           │
           ▼
    POST /shorten
           │
    ┌──────▼──────────┐
    │  verifyToken    │  ← Firebase ID token check
    └──────┬──────────┘
    ┌──────▼──────────┐
    │  validateURL    │  ← Protocol, length, domain, private IP
    └──────┬──────────┘
    ┌──────▼──────────┐
    │   spamCheck     │  ← Trusted domain fast-pass OR ML service call
    └──────┬──────────┘
    ┌──────▼──────────┐
    │  shortenURL     │  ← Firestore write, nanoid/alias, response
    └─────────────────┘
```

---

## 🚀 Getting Started

### Prerequisites

| Tool | Version |
|------|---------|
| Node.js | 16+ |
| npm | 8+ |
| Python | 3.10+ |
| Firebase project | (with Firestore + Auth enabled) |

### 1. Clone the Repository

```bash
git clone https://github.com/your-username/url-shortener.git
cd url-shortener
```

### 2. Firebase Setup

1. Create a project at [Firebase Console](https://console.firebase.google.com/)
2. Enable **Authentication** → Email/Password + Google providers
3. Enable **Firestore Database**
4. Generate a **Service Account** key (Project Settings → Service Accounts → Generate new private key)

### 3. Backend Setup (`/api`)

```bash
cd api
npm install
```

Create `.env` in `/api`:

```env
PORT=4010
CLIENT_URL=http://localhost:3000
ML_SERVICE_URL=http://localhost:5001

# Firebase Admin SDK (from service account JSON)
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxx@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_KEY_HERE\n-----END PRIVATE KEY-----\n"
```

Start the API server:

```bash
npm run dev      # development (nodemon)
# or
npm start        # production
```

### 4. ML Service Setup (`/ml_service`)

```bash
cd ml_service
pip install -r requirements.txt
python app.py
```

The ML service runs on **port 5001** by default. The `model.pkl` is pre-trained and included — no re-training needed.

To retrain the model:

```bash
python train.py
```

### 5. Frontend Setup (`/client`)

```bash
cd client
npm install
```

Create `.env` in `/client`:

```env
REACT_APP_API_URL=http://localhost:4010

# Firebase Web SDK config (from Firebase Console → Project Settings → Web app)
REACT_APP_FIREBASE_API_KEY=your-api-key
REACT_APP_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=your-project-id
REACT_APP_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
REACT_APP_FIREBASE_APP_ID=your-app-id
```

Start the React dev server:

```bash
npm start
```

### 6. Open the App

| Service | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| API | http://localhost:4010 |
| ML Service | http://localhost:5001 |
| ML Health Check | http://localhost:5001/health |

---

## 📡 API Reference

### Public Endpoints

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/` | Health check |
| `GET` | `/recent` | Last 10 shortened URLs |
| `GET` | `/:shortURL` | Redirect to original URL |
| `GET` | `/check-username?username=` | Check username availability |

### Protected Endpoints (Bearer Token Required)

| Method | Route | Description |
|--------|-------|-------------|
| `POST` | `/shorten` | Shorten a URL |
| `GET` | `/my-links` | Get current user's links |
| `DELETE` | `/my-links/:id` | Delete a specific link |
| `GET` | `/has-username` | Check if current user has a username |
| `POST` | `/reserve-username` | Claim a username |

### POST `/shorten` — Request Body

```json
{
  "currentURL": "https://example.com/very/long/url",
  "customAlias": "my-link"   // optional
}
```

### POST `/shorten` — Success Response `201`

```json
{
  "shortedurl": "username-my-link"
}
```

### POST `/shorten` — Spam Detected `422`

```json
{
  "error": "This URL has been flagged as potentially malicious and cannot be shortened.",
  "confidence": 0.94,
  "reasons": ["Contains phishing keyword 'signin'", "Suspicious TLD (.tk)"]
}
```

---

## 🤖 ML Phishing Detector

### Model Details

| Property | Value |
|----------|-------|
| Algorithm | Random Forest (200 trees, max depth 20) |
| Dataset | 11,430 URLs (50% phishing / 50% legitimate) |
| Features | 55 URL-structure features |
| Accuracy | **91.12%** |
| ROC-AUC | **97.05%** |
| F1-Score | **91.15%** |
| CV Mean | 90.92% ± 0.71% |

### Top Predictive Features

1. `nb_www` — presence/count of www
2. `phish_hints` — phishing keyword count in path
3. `longest_word_path` — longest word in URL path
4. `length_url` — total URL length
5. `length_hostname` — hostname length
6. `ratio_digits_url` — ratio of digits in URL

### Detection Pipeline

```
URL Input
   │
   ├─ Trusted Domain? ──── YES ──→ Fast-pass (skip ML)
   │
   ├─ Punycode (xn--)? ─── YES ──→ Hard block (confidence: 1.0)
   │
   └─ ML Prediction
         │
         ├─ isSpam + confidence ≥ 0.70 ──→ Block (422)
         │
         └─ Safe or ML unavailable ──────→ Allow through
```

### ML Service Endpoints

```bash
# Health check
GET http://localhost:5001/health

# Predict
POST http://localhost:5001/predict
Content-Type: application/json

{ "url": "https://suspicious-site.tk/login/verify" }
```

---

## 🔒 Security

- All protected routes require a valid Firebase ID Token
- Tokens are verified server-side using Firebase Admin SDK
- Username ownership is enforced at the database layer
- Link deletion is owner-only (403 if not owner)
- Private/local IP URLs are blocked at validation
- URL protocol whitelist (http/https only)
- Atomic username reservation with conflict detection and rollback

---

## 🧪 Running Tests

```bash
# Frontend tests
cd client
npm test

# ML service health
curl http://localhost:5001/health

# API health
curl http://localhost:4010/
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Axios, qrcode.react, Firebase Web SDK |
| Backend | Node.js, Express.js, nanoid, node-fetch |
| Database | Firebase Firestore |
| Auth | Firebase Authentication (Email + Google) |
| ML Service | Python, Flask, scikit-learn, pandas, numpy |
| ML Model | Random Forest (joblib/pkl) |

---

## 📄 License

ISC License — see [LICENSE](LICENSE) for details.

---

<div align="center">
Made with ❤️ by Aayush Raj | Full-Stack · AI-Powered · Secure
</div>
