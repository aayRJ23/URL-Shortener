# ml_service/predictor.py
#
# Loads the trained Random Forest model on startup (once, not per-request)
# and exposes predict_url() for use by app.py.
#
# Also contains a rule-based fallback so the service degrades gracefully
# if model.pkl is missing (e.g. before training has been run).

import os
import joblib
from features import extract_features, FEATURE_NAMES, SUSPICIOUS_KEYWORDS
from urllib.parse import urlparse

MODEL_PATH = os.path.join(os.path.dirname(__file__), "model.pkl")

# ── Load model once at import time ───────────────────────────────────────────
_model = None

if os.path.exists(MODEL_PATH):
    try:
        _model = joblib.load(MODEL_PATH)
        print(f"[Predictor] Model loaded from {MODEL_PATH}")
    except Exception as e:
        print(f"[Predictor] WARNING: Failed to load model: {e}")
else:
    print(f"[Predictor] WARNING: model.pkl not found at {MODEL_PATH}. Using rule-based fallback.")


# ── Main prediction function ──────────────────────────────────────────────────

def predict_url(url: str) -> dict:
    """
    Analyse a URL and return:
      {
        "isSpam":     bool,
        "confidence": float (0.0 – 1.0),
        "reasons":    list[str]
      }

    Uses the ML model when available; falls back to rule-based heuristics otherwise.
    """
    features = extract_features(url)
    reasons  = _build_reasons(url, features)

    if _model is not None:
        return _ml_predict(url, features, reasons)
    else:
        return _rule_predict(url, features, reasons)


# ── ML prediction ─────────────────────────────────────────────────────────────

def _ml_predict(url: str, features: list, reasons: list) -> dict:
    proba     = _model.predict_proba([features])[0]  # [prob_legit, prob_spam]
    spam_prob = float(proba[1])
    is_spam   = spam_prob >= 0.5

    # Only surface reasons when classified as spam
    active_reasons = reasons if is_spam else []

    return {
        "isSpam":     is_spam,
        "confidence": round(spam_prob, 4),
        "reasons":    active_reasons,
    }


# ── Rule-based fallback (no model) ────────────────────────────────────────────

def _rule_predict(url: str, features: list, reasons: list) -> dict:
    """
    Simple heuristic scoring used when model.pkl is not available.
    Each rule adds a weight; total >= threshold → spam.
    """
    score = 0.0

    url_length, dot_count, slash_count, has_at, has_hyphen, is_ip, \
        is_https, digit_count, subdomain_count, sus_keyword, entropy, qparams = features

    if has_at:              score += 0.35
    if is_ip:               score += 0.40
    if not is_https:        score += 0.15
    if sus_keyword:         score += 0.20
    if url_length > 100:    score += 0.15
    if dot_count > 5:       score += 0.10
    if subdomain_count > 3: score += 0.15
    if entropy > 4.5:       score += 0.10

    score     = min(score, 1.0)
    is_spam   = score >= 0.5
    active    = reasons if is_spam else []

    return {
        "isSpam":     is_spam,
        "confidence": round(score, 4),
        "reasons":    active,
    }


# ── Human-readable reason builder ────────────────────────────────────────────

def _build_reasons(url: str, features: list) -> list:
    """
    Builds a list of human-readable strings explaining why the URL looks suspicious.
    Runs regardless of whether ML or rule-based path is used.
    """
    url_length, dot_count, slash_count, has_at, has_hyphen, is_ip, \
        is_https, digit_count, subdomain_count, sus_keyword, entropy, qparams = features

    reasons = []

    if has_at:
        reasons.append("URL contains '@' symbol — often used to disguise the real domain")
    if is_ip:
        reasons.append("Hostname is a raw IP address instead of a domain name")
    if not is_https:
        reasons.append("URL uses HTTP (not HTTPS) — connection is unencrypted")
    if sus_keyword:
        url_lower = url.lower()
        matched   = [kw for kw in SUSPICIOUS_KEYWORDS if kw in url_lower]
        reasons.append(f"Contains suspicious keywords: {', '.join(matched)}")
    if url_length > 100:
        reasons.append(f"Unusually long URL ({url_length} characters)")
    if dot_count > 5:
        reasons.append(f"Excessive dots in URL ({dot_count}) — possible subdomain abuse")
    if subdomain_count > 3:
        reasons.append(f"Too many subdomains ({subdomain_count}) — common in phishing")
    if entropy > 4.5:
        reasons.append(f"High URL entropy ({entropy:.2f}) — may be obfuscated or random")
    if digit_count > 10:
        reasons.append(f"High digit count ({digit_count}) in URL — unusual for legitimate sites")

    return reasons