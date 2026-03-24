// App.jsx
// ─────────────────────────────────────────────────────────────
// Root component — layout + auth gate.
//
// Changes from v1:
//  - If user is not logged in → show AuthForm
//  - If user is logged in → show the full shortener UI
//  - handleDelete is now pulled from the hook and passed to HistoryList
//
// All state and logic → useUrlShortener (hooks/useUrlShortener.js)
// All API calls       → urlApi          (api/urlApi.js)
// Auth state          → AuthContext     (context/AuthContext.jsx)
// ─────────────────────────────────────────────────────────────

import "./App.css";

import Header      from "./components/Header";
import ShortenForm from "./components/ShortenForm";
import ResultBox   from "./components/ResultBox";
import HistoryList from "./components/HistoryList";
import Footer      from "./components/Footer";
import AuthForm    from "./components/AuthForm";  // NEW

import { useUrlShortener } from "./hooks/useUrlShortener";
import { useAuth }         from "./context/AuthContext";  // NEW

function App() {
  const { user } = useAuth(); // NEW: check if user is logged in

  const {
    currentURL, customAlias, error, loading,
    inputRef, handleSubmit, handleURLChange, handleAliasChange,
    shortURL, showResult, copied, handleCopy,
    history, historyLoading, loadHistory,
    handleDelete, // NEW
  } = useUrlShortener();

  return (
    <div className="app">

      <Header />

      <main className="main">
        {/* If not logged in, show auth form instead of the shortener */}
        {!user ? (
          <AuthForm />
        ) : (
          <>
            {/* URL input form */}
            <ShortenForm
              currentURL={currentURL}
              customAlias={customAlias}
              error={error}
              loading={loading}
              inputRef={inputRef}
              onSubmit={handleSubmit}
              onURLChange={handleURLChange}
              onAliasChange={handleAliasChange}
            />

            {/* Result shown after successful shortening */}
            {showResult && (
              <ResultBox
                shortURL={shortURL}
                copied={copied}
                onCopy={handleCopy}
              />
            )}

            {/* User's personal link history */}
            <HistoryList
              history={history}
              historyLoading={historyLoading}
              onRefresh={loadHistory}
              onDelete={handleDelete}
            />
          </>
        )}
      </main>

      <Footer />

    </div>
  );
}

export default App;