// App.jsx
// Root component.
// Architecture:
//   ToastProvider (index.js)
//     └─ App
//          └─ AuthProvider (receives onAuthEvent → fires toasts)
//               └─ AppContent (reads useAuth + useUrlShortener)

import "./App.css";
import { AuthProvider } from "./context/AuthContext";
import { useToast }     from "./context/ToastContext";
import AppContent       from "./components/AppContent";

function App() {
  const { showToast } = useToast();

  function handleAuthEvent(type, name) {
    if (type === "signup") showToast(`Welcome, @${name}! Account created 🎉`, "success");
    if (type === "login")  showToast(`Welcome back, @${name}! 👋`, "success");
    if (type === "logout") showToast("Logged out. See you soon!", "info");
  }

  return (
    <AuthProvider onAuthEvent={handleAuthEvent}>
      <AppContent />
    </AuthProvider>
  );
}

export default App;