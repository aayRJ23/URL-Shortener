// hooks/useUrlShortener.js
// Fixes:
//  - showResult resets to false when user logs out (bug iii)
//  - exports user so AppContent can pass username to ShortenForm

import { useState, useEffect, useRef } from "react";
import { fetchMyLinks, shortenURL, deleteLink } from "../api/urlApi";
import { useAuth } from "../context/AuthContext";

export function useUrlShortener() {
  const { user } = useAuth();

  // Form state
  const [currentURL,  setCurrentURL]  = useState("");
  const [customAlias, setCustomAlias] = useState("");
  const [error,       setError]       = useState("");
  const [loading,     setLoading]     = useState(false);

  // Result state
  const [shortURL,   setShortURL]   = useState("");
  const [showResult, setShowResult] = useState(false);
  const [copied,     setCopied]     = useState(false);

  // History state
  const [history,        setHistory]        = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  const inputRef = useRef(null);

  // Load/clear history & RESET result box when auth state changes
  useEffect(() => {
    if (user) {
      loadHistory();
    } else {
      setHistory([]);
      setHistoryLoading(false);
      // Bug (iii) fix: clear result box on logout so it doesn't linger
      setShowResult(false);
      setShortURL("");
      setCopied(false);
      setCurrentURL("");
      setCustomAlias("");
      setError("");
    }
    inputRef.current?.focus();
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  async function getFreshToken() {
    if (!user) return null;
    return user.getIdToken(true);
  }

  async function loadHistory() {
    setHistoryLoading(true);
    try {
      const token = await getFreshToken();
      if (!token) return;
      const data = await fetchMyLinks(token);
      setHistory(data);
    } catch (err) {
      console.error("Failed to load history:", err.message);
    } finally {
      setHistoryLoading(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setShowResult(false);

    if (!currentURL.trim()) {
      setError("Please enter a URL.");
      return;
    }

    setLoading(true);
    try {
      const token = await getFreshToken();
      const data  = await shortenURL(currentURL, customAlias, token);
      setShortURL(data.shortedurl);
      setShowResult(true);
      setCopied(false);
      loadHistory();
    } catch (err) {
      setError(err.message || "Could not connect to server. Is the API running?");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(docId) {
    try {
      const token = await getFreshToken();
      await deleteLink(docId, token);
      loadHistory();
    } catch (err) {
      setError(err.message || "Failed to delete link.");
    }
  }

  function handleCopy(fullURL) {
    navigator.clipboard.writeText(fullURL).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function handleAliasChange(value) {
    setCustomAlias(value.replace(/\s/g, ""));
  }

  function handleURLChange(value) {
    setCurrentURL(value);
    setError("");
  }

  return {
    // Expose user for AppContent
    user,
    // Form
    currentURL, customAlias, error, loading,
    inputRef, handleSubmit, handleURLChange, handleAliasChange,
    // Result
    shortURL, showResult, copied, handleCopy,
    // History
    history, historyLoading, loadHistory, handleDelete,
  };
}