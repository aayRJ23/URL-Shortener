// hooks/useUrlShortener.js
// ─────────────────────────────────────────────────────────────
// Custom hook that owns ALL state and logic for the shortener.
//
// Fix: use user.getIdToken(true) to force a token refresh
// so displayName is always present in the token after signup.
// Also clears history on logout.
// ─────────────────────────────────────────────────────────────

import { useState, useEffect, useRef } from "react";
import { fetchMyLinks, shortenURL, deleteLink } from "../api/urlApi";
import { useAuth } from "../context/AuthContext";

export function useUrlShortener() {
  // ── Auth ─────────────────────────────────────────────────────
  const { user } = useAuth();

  // ── Form state ────────────────────────────────────────────────
  const [currentURL,  setCurrentURL]  = useState("");
  const [customAlias, setCustomAlias] = useState("");
  const [error,       setError]       = useState("");
  const [loading,     setLoading]     = useState(false);

  // ── Result state ──────────────────────────────────────────────
  const [shortURL,    setShortURL]    = useState("");
  const [showResult,  setShowResult]  = useState(false);
  const [copied,      setCopied]      = useState(false);

  // ── History state ─────────────────────────────────────────────
  const [history,        setHistory]        = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  // ── Refs ───────────────────────────────────────────────────────
  const inputRef = useRef(null);

  // Load history when user logs in, clear when logs out
  useEffect(() => {
    if (user) {
      loadHistory();
    } else {
      setHistory([]);
      setHistoryLoading(false);
    }
    inputRef.current?.focus();
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Actions ────────────────────────────────────────────────────

  /**
   * getFreshToken
   * Always forces a token refresh (true param).
   * This ensures the token always has the latest displayName
   * even right after signup.
   */
  async function getFreshToken() {
    if (!user) return null;
    // forceRefresh = true → Firebase issues a new token
    // ensuring displayName set during signup is included
    return user.getIdToken(true);
  }

  /**
   * loadHistory
   * Fetches the current user's own links from GET /my-links.
   */
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

  /**
   * handleSubmit
   * Sends the URL + alias to POST /shorten with a fresh token.
   */
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
      loadHistory(); // Refresh list after creating a new link
    } catch (err) {
      setError(err.message || "Could not connect to server. Is the API running?");
    } finally {
      setLoading(false);
    }
  }

  /**
   * handleDelete
   * Deletes a link by its Firestore document ID.
   * Refreshes history after deletion.
   *
   * @param {string} docId - item.id from the history list
   */
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
    // Form
    currentURL,
    customAlias,
    error,
    loading,
    inputRef,
    handleSubmit,
    handleURLChange,
    handleAliasChange,

    // Result
    shortURL,
    showResult,
    copied,
    handleCopy,

    // History
    history,
    historyLoading,
    loadHistory,
    handleDelete,
  };
}