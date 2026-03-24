import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App";
import { ToastProvider } from "./context/ToastContext";
import { AuthProvider }  from "./context/AuthContext";

// ToastProvider must be outside AuthProvider so the auth event
// callback (which calls showToast) can be wired in App.jsx.
// AuthProvider wraps App so every component can useAuth().

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <ToastProvider>
      <App />
    </ToastProvider>
  </React.StrictMode>
);