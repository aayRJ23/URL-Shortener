// hooks/useUrlShortener.js
// ─────────────────────────────────────────────────────────────
// Custom hook that owns ALL state and logic for the app.
// Your components stay "dumb" — they only handle rendering.
//
// When you revisit this project, this is the first place to
// look if something behaves unexpectedly.
// ─────────────────────────────────────────────────────────────

import { useState, useEffect, useRef } from "react";
import { fetchRecentLinks, shortenURL } from "../api/urlApi";

export function useUrlShortener() {
  // ── Form state ──────────────────────────────────────────────
  const [currentURL, setCurrentURL]   = useState("");
  const [customAlias, setCustomAlias] = useState("");
  const [error, setError]             = useState("");
  const [loading, setLoading]         = useState(false);

  // ── Result state ─────────────────────────────────────────────
  const [shortURL, setShortURL]       = useState("");
  const [showResult, setShowResult]   = useState(false);
  const [copied, setCopied]           = useState(false);

  // ── History state ─────────────────────────────────────────────
  const [history, setHistory]               = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  // ── Refs ──────────────────────────────────────────────────────
  const inputRef = useRef(null);

  // Load history and focus the input on first render
  useEffect(() => {
    loadHistory();
    inputRef.current?.focus();
  }, []);

  // ── Actions ───────────────────────────────────────────────────

  async function loadHistory() {
    setHistoryLoading(true);
    try {
      const data = await fetchRecentLinks();
      setHistory(data);
    } catch {
      // Silently fail — history is non-critical
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
      const data = await shortenURL(currentURL, customAlias);
      setShortURL(data.shortedurl);
      setShowResult(true);
      setCopied(false);
      loadHistory(); // Refresh history after a new link is created
    } catch (err) {
      setError(err.message || "Could not connect to server. Is the API running?");
    } finally {
      setLoading(false);
    }
  }

  function handleCopy(fullURL) {
    navigator.clipboard.writeText(fullURL).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function handleAliasChange(value) {
    // Disallow spaces in the alias field
    setCustomAlias(value.replace(/\s/g, ""));
  }

  function handleURLChange(value) {
    setCurrentURL(value);
    setError(""); // Clear error as user types
  }

  // Return everything the components need
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
  };
}
