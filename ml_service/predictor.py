# ml_service/predictor.py
#
# Loads the trained Random Forest model on startup (once, not per-request)
# and exposes predict_url() for use by app.py.
#
# Also contains a rule-based fallback so the service degrades gracefully
# if model.pkl is missing (e.g. before training has been run).

import os
import joblib
from features import extract_features, FEATURE_NAMES, PHISH_HINTS, SUSPICIOUS_TLDS
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
    proba     = _model.predict_proba([features])[0]   # [prob_legit, prob_phish]
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
    Heuristic scoring used when model.pkl is not available.
    HTTP alone is NOT penalised — it must combine with other signals.
    """
    (
        length_url, length_hostname, ip, nb_dots, nb_hyphens,
        nb_at, nb_qm, nb_and, nb_or, nb_eq, nb_underscore,
        nb_tilde, nb_percent, nb_slash, nb_star, nb_colon,
        nb_comma, nb_semicolumn, nb_dollar, nb_space,
        nb_www, nb_com, nb_dslash, http_in_path, https_token,
        ratio_digits_url, ratio_digits_host,
        punycode, port, tld_in_path, tld_in_subdomain,
        abnormal_subdomain, nb_subdomains, prefix_suffix,
        random_domain, shortening_service, path_extension,
        nb_redirection, nb_external_redirection,
        length_words_raw, char_repeat,
        shortest_words_raw, shortest_word_host, shortest_word_path,
        longest_words_raw, longest_word_host, longest_word_path,
        avg_words_raw, avg_word_host, avg_word_path,
        phish_hints, domain_in_brand, brand_in_subdomain, brand_in_path,
        suspicious_tld, statistical_report,
        *_page_features   # page-level features not used in rule fallback
    ) = features

    parsed   = urlparse(url)
    is_https = int(parsed.scheme == "https")

    score = 0.0

    if nb_at:               score += 0.35   # @ in URL — almost always phishing
    if ip:                  score += 0.40   # raw IP instead of domain
    if punycode:            score += 0.30   # homograph attack
    if suspicious_tld:      score += 0.20   # .tk / .ml / .link etc.
    if shortening_service:  score += 0.20   # bit.ly, appspot, etc.
    if random_domain:       score += 0.20   # gibberish domain name
    if phish_hints > 0:     score += 0.15   # login/verify/update in path
    if brand_in_subdomain:  score += 0.20   # apple.evilsite.com
    if tld_in_subdomain:    score += 0.20   # apple.com.evilsite.com
    if nb_subdomains > 3:   score += 0.15   # too many subdomain levels
    if length_url > 100:    score += 0.10   # very long URL
    if nb_dots > 5:         score += 0.10   # excessive dots
    if port:                score += 0.15   # non-standard port
    if http_in_path:        score += 0.15   # embedded redirect in path

    # HTTP is only penalised when combined with another signal
    if not is_https and score > 0:
        score += 0.10

    score   = min(score, 1.0)
    is_spam = score >= 0.50

    return {
        "isSpam":     is_spam,
        "confidence": round(score, 4),
        "reasons":    reasons if is_spam else [],
    }


# ── Human-readable reason builder ────────────────────────────────────────────

def _build_reasons(url: str, features: list) -> list:
    """
    Build a list of human-readable strings explaining why a URL looks suspicious.
    Runs regardless of whether the ML or rule-based path is used.
    """
    (
        length_url, length_hostname, ip, nb_dots, nb_hyphens,
        nb_at, nb_qm, nb_and, nb_or, nb_eq, nb_underscore,
        nb_tilde, nb_percent, nb_slash, nb_star, nb_colon,
        nb_comma, nb_semicolumn, nb_dollar, nb_space,
        nb_www, nb_com, nb_dslash, http_in_path, https_token,
        ratio_digits_url, ratio_digits_host,
        punycode, port, tld_in_path, tld_in_subdomain,
        abnormal_subdomain, nb_subdomains, prefix_suffix,
        random_domain, shortening_service, path_extension,
        nb_redirection, nb_external_redirection,
        length_words_raw, char_repeat,
        shortest_words_raw, shortest_word_host, shortest_word_path,
        longest_words_raw, longest_word_host, longest_word_path,
        avg_words_raw, avg_word_host, avg_word_path,
        phish_hints, domain_in_brand, brand_in_subdomain, brand_in_path,
        suspicious_tld, statistical_report,
        *_page_features
    ) = features

    parsed    = urlparse(url)
    is_https  = parsed.scheme == "https"
    url_lower = url.lower()
    path_q    = ((parsed.path or "") + "?" + (parsed.query or "")).lower()

    reasons = []

    if nb_at:
        reasons.append("Contains '@' symbol — used to disguise the real destination domain")

    if ip:
        reasons.append("Hostname is a raw IP address instead of a domain name")

    if punycode:
        reasons.append("Uses Punycode (xn--) encoding — possible homograph/lookalike attack")

    if suspicious_tld:
        tld = "." + (parsed.hostname or "").split(".")[-1]
        reasons.append(f"Uses a suspicious free/abused TLD: '{tld}'")

    if shortening_service:
        reasons.append("Hostname belongs to a known URL-shortening or free-hosting service")

    if random_domain:
        reasons.append("Domain name appears randomly generated (high consonant density)")

    if phish_hints > 0:
        matched = [kw for kw in PHISH_HINTS if kw in path_q]
        reasons.append(f"Path contains phishing-hint keywords: {', '.join(matched)}")

    if brand_in_subdomain:
        reasons.append("A well-known brand name appears in the subdomain — possible impersonation")

    if tld_in_subdomain:
        reasons.append("A TLD (.com/.net/…) appears in the subdomain — classic domain-spoofing trick")

    if nb_subdomains > 3:
        reasons.append(f"Excessive subdomain depth ({nb_subdomains}) — common in phishing infrastructure")

    if port:
        reasons.append(f"Uses a non-standard port — legitimate sites use 80 or 443")

    if http_in_path:
        reasons.append("Another URL is embedded in the path — possible open-redirect abuse")

    if not is_https and ip:
        reasons.append("Uses plain HTTP with a raw IP address — high-risk combination")
    elif not is_https and nb_subdomains > 3:
        reasons.append("Uses plain HTTP alongside deep subdomain nesting")

    if length_url > 150:
        reasons.append(f"Unusually long URL ({length_url} characters) — often used to hide the real destination")

    if ratio_digits_url > 0.3:
        reasons.append(f"High proportion of digits in URL ({ratio_digits_url:.0%}) — unusual for legitimate sites")

    return reasons