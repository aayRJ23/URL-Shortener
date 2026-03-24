// components/AppContent.jsx
// The actual UI — split from App.jsx so it sits inside AuthProvider.

import Header      from "./Header";
import ShortenForm from "./ShortenForm";
import ResultBox   from "./ResultBox";
import HistoryList from "./HistoryList";
import Footer      from "./Footer";
import AuthForm    from "./AuthForm";

import { useUrlShortener } from "../hooks/useUrlShortener";
import { useAuth }         from "../context/AuthContext";

function AppContent() {
  const { user } = useAuth();

  const {
    currentURL, customAlias, error, loading,
    inputRef, handleSubmit, handleURLChange, handleAliasChange,
    shortURL, showResult, copied, handleCopy,
    history, historyLoading, loadHistory,
    handleDelete,
  } = useUrlShortener();

  return (
    <div className="app">
      <Header />
      <main className="main">
        {!user ? (
          <AuthForm />
        ) : (
          <>
            <ShortenForm
              currentURL={currentURL}
              customAlias={customAlias}
              error={error}
              loading={loading}
              inputRef={inputRef}
              onSubmit={handleSubmit}
              onURLChange={handleURLChange}
              onAliasChange={handleAliasChange}
              username={user.displayName}
            />

            {showResult && (
              <ResultBox
                shortURL={shortURL}
                copied={copied}
                onCopy={handleCopy}
              />
            )}

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

export default AppContent;