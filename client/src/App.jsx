// App.jsx
// ─────────────────────────────────────────────────────────────
// Root component — layout only.
//
// All state and logic → useUrlShortener (hooks/useUrlShortener.js)
// All API calls       → urlApi          (api/urlApi.js)
// All components      → components/
// All helper fns      → utils/formatters.js
//
// If you need to understand the app flow, start in the hook.
// If you need to change the UI, look in the components folder.
// ─────────────────────────────────────────────────────────────

import "./App.css";

import Header      from "./components/Header";
import ShortenForm from "./components/ShortenForm";
import ResultBox   from "./components/ResultBox";
import HistoryList from "./components/HistoryList";
import Footer      from "./components/Footer";

import { useUrlShortener } from "./hooks/useUrlShortener";

function App() {
  // Pull everything we need from the custom hook
  const {
    currentURL, customAlias, error, loading,
    inputRef, handleSubmit, handleURLChange, handleAliasChange,
    shortURL, showResult, copied, handleCopy,
    history, historyLoading, loadHistory,
  } = useUrlShortener();

  return (
    <div className="app">

      <Header />

      <main className="main">
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

        {/* Recent links history */}
        <HistoryList
          history={history}
          historyLoading={historyLoading}
          onRefresh={loadHistory}
        />
      </main>

      <Footer />

    </div>
  );
}

export default App;
