// index.js
// ─────────────────────────────────────────────────────────────
// Entry point of the React app.
//
// Changes from v1:
//  - Wrapped <App /> with <AuthProvider> so every component
//    in the tree can access auth state via useAuth()
// ─────────────────────────────────────────────────────────────

import React            from "react";
import ReactDOM         from "react-dom/client";
import "./index.css";
import App              from "./App";
import { AuthProvider } from "./context/AuthContext";  // NEW
import reportWebVitals  from "./reportWebVitals";

const root = ReactDOM.createRoot(document.getElementById("root"));

root.render(
  <React.StrictMode>
    {/* AuthProvider must wrap App so useAuth() works everywhere */}
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>
);

reportWebVitals();