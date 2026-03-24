# ml_service/features.py
#
# URL feature extraction for the phishing / spam classifier.
#
# TWO modes:
#   1. DATASET MODE  — used during training with dataset_phishing.csv.
#                      The CSV already has 87 pre-computed features per row.
#                      train.py reads those columns directly (no extraction needed).
#
#   2. LIVE MODE     — used at prediction time (predictor.py / app.py).
#                      extract_features(url) computes the same 87 features
#                      from a raw URL string so the trained model can score it.
#
# FEATURE_NAMES must stay in the same order as the CSV columns used during
# training (see DATASET_FEATURE_COLS in train.py).  Never insert / delete
# in the middle — retrain whenever you change this list.

import re
import math
import ipaddress
from urllib.parse import urlparse, parse_qs

# ── Known URL-shortening / free-hosting hostnames ─────────────────────────────

SHORTENING_SERVICES = {
    "bit.ly", "tinyurl.com", "t.co", "goo.gl", "ow.ly", "is.gd",
    "buff.ly", "adf.ly", "bit.do", "mcaf.ee", "su.pr", "twit.ac",
    "appspot.com", "hyperphp.com", "r.appspot.com",
}

# ── Suspicious TLDs ────────────────────────────────────────────────────────────

SUSPICIOUS_TLDS = {
    ".tk", ".ml", ".ga", ".cf", ".gq",          # Freenom free TLDs
    ".link", ".asia", ".xyz", ".top", ".pw",
    ".club", ".online", ".site", ".icu",
}

# ── Brand names (used for brand-in-path / brand-in-subdomain checks) ──────────

BRANDS = [
    "paypal", "apple", "amazon", "microsoft", "google", "facebook",
    "instagram", "netflix", "ebay", "wellsfargo", "bankofamerica",
    "chase", "citibank", "dhl", "fedex", "whatsapp", "twitter",
]

# ── Phishing hint keywords ─────────────────────────────────────────────────────
# Only checked in PATH + QUERY, not in the hostname, to avoid flagging
# legitimate brand domains like amazon.com or google.com.

PHISH_HINTS = [
    "login", "signin", "sign-in", "verify", "secure", "account",
    "update", "confirm", "banking", "password", "credential",
    "webscr", "wp-admin", "admin", "recover", "unlock",
    "suspended", "billing", "invoice", "support",
]

# ── Feature names — order must match extract_features() return list ───────────

FEATURE_NAMES = [
    # ── URL surface features ───────────────────────────────────────────────
    "length_url",               # total character count of the URL
    "length_hostname",          # character count of the hostname
    "ip",                       # 1 if hostname is a raw IPv4/IPv6 address
    "nb_dots",                  # '.' count in the full URL
    "nb_hyphens",               # '-' count in the full URL
    "nb_at",                    # '@' count in the full URL
    "nb_qm",                    # '?' count in the full URL
    "nb_and",                   # '&' count in the full URL
    "nb_or",                    # '|' count in the full URL
    "nb_eq",                    # '=' count in the full URL
    "nb_underscore",            # '_' count in the full URL
    "nb_tilde",                 # '~' count in the full URL
    "nb_percent",               # '%' count in the full URL
    "nb_slash",                 # '/' count in the full URL
    "nb_star",                  # '*' count in the full URL
    "nb_colon",                 # ':' count in the full URL
    "nb_comma",                 # ',' count in the full URL
    "nb_semicolumn",            # ';' count in the full URL
    "nb_dollar",                # '$' count in the full URL
    "nb_space",                 # ' ' / %20 count in the full URL
    # ── Token-level features ───────────────────────────────────────────────
    "nb_www",                   # number of 'www' tokens in the URL
    "nb_com",                   # number of '.com' tokens in the URL
    "nb_dslash",                # number of '//' occurrences in the URL
    "http_in_path",             # 1 if 'http' appears in the path/query
    "https_token",              # 1 if 'https' token appears in path (not scheme)
    "ratio_digits_url",         # digits / total URL length
    "ratio_digits_host",        # digits / hostname length
    # ── Domain-level features ──────────────────────────────────────────────
    "punycode",                 # 1 if hostname contains 'xn--' (homograph attack)
    "port",                     # 1 if a non-standard port is present
    "tld_in_path",              # 1 if a TLD token (.com/.net/…) appears in path
    "tld_in_subdomain",         # 1 if a TLD token appears in the subdomain part
    "abnormal_subdomain",       # 1 if subdomain starts with digits or looks random
    "nb_subdomains",            # number of dots in the hostname
    "prefix_suffix",            # 1 if hostname contains '-' (prefix/suffix trick)
    "random_domain",            # 1 if domain looks randomly generated (high consonant run)
    "shortening_service",       # 1 if hostname matches a known shortener
    "path_extension",           # 1 if path has a file extension (.php/.html/…)
    "nb_redirection",           # number of '//' in path (extra redirections)
    "nb_external_redirection",  # number of 'http' occurrences in path
    # ── Word / lexical features ────────────────────────────────────────────
    "length_words_raw",         # total characters across all words in URL
    "char_repeat",              # max run of a single repeated character
    "shortest_words_raw",       # length of the shortest word token
    "shortest_word_host",       # length of the shortest word in hostname
    "shortest_word_path",       # length of the shortest word in path
    "longest_words_raw",        # length of the longest word token
    "longest_word_host",        # length of the longest word in hostname
    "longest_word_path",        # length of the longest word in path
    "avg_words_raw",            # mean word length across full URL
    "avg_word_host",            # mean word length in hostname
    "avg_word_path",            # mean word length in path
    # ── Semantic / brand features ──────────────────────────────────────────
    "phish_hints",              # count of phishing-hint keywords in path+query
    "domain_in_brand",          # 1 if registered domain matches a known brand
    "brand_in_subdomain",       # 1 if a brand name appears in the subdomain
    "brand_in_path",            # 1 if a brand name appears in the path
    "suspecious_tld",           # 1 if TLD is in the suspicious-TLD list
    # NOTE: statistical_report and all page/WHOIS/DNS/reputation features removed.
    # They were always 0 at prediction time (no page fetching), which caused the
    # model to flag every URL as phishing. Model now uses 55 URL-only features.
]


# ── Helpers ────────────────────────────────────────────────────────────────────

def _is_ip(hostname: str) -> int:
    try:
        ipaddress.ip_address(hostname)
        return 1
    except ValueError:
        return 0


def _entropy(s: str) -> float:
    if not s:
        return 0.0
    freq = {}
    for ch in s:
        freq[ch] = freq.get(ch, 0) + 1
    n = len(s)
    return -sum((c / n) * math.log2(c / n) for c in freq.values())


def _word_tokens(text: str) -> list:
    """Split on non-alphanumeric characters and return non-empty tokens."""
    return [w for w in re.split(r"[^a-zA-Z0-9]", text) if w]


def _max_char_repeat(s: str) -> int:
    """Length of the longest run of a single repeated character."""
    if not s:
        return 0
    max_run = current = 1
    for i in range(1, len(s)):
        if s[i] == s[i - 1]:
            current += 1
            max_run = max(max_run, current)
        else:
            current = 1
    return max_run


def _has_path_extension(path: str) -> int:
    extensions = {".php", ".html", ".htm", ".asp", ".aspx", ".jsp",
                  ".cgi", ".pl", ".exe", ".sh"}
    last = path.rsplit("/", 1)[-1].lower()
    return int(any(last.endswith(ext) for ext in extensions))


def _random_domain(hostname: str) -> int:
    """
    Heuristic: a domain looks randomly generated if it has a consonant run ≥ 4
    or its entropy is unusually high (> 3.8 bits) for a short hostname.
    """
    registered = hostname.split(".")[-2] if hostname.count(".") >= 1 else hostname
    if re.search(r"[bcdfghjklmnpqrstvwxyz]{4,}", registered, re.I):
        return 1
    if len(registered) > 4 and _entropy(registered) > 3.8:
        return 1
    return 0


_COMMON_TLDS = {
    "com", "net", "org", "edu", "gov", "io", "co",
    "uk", "de", "fr", "it", "ru", "cn", "jp", "br",
}


def _tld_in_part(part: str) -> int:
    tokens = _word_tokens(part.lower())
    return int(any(t in _COMMON_TLDS for t in tokens))


# ── Main extraction function ───────────────────────────────────────────────────

def extract_features(url: str) -> list:
    """
    Compute a feature vector from a raw URL string.

    Page-level features (hyperlinks, CSS, forms, …) cannot be derived
    from the URL alone and are set to 0.  The model was trained on a
    mix of URL and page features, so predictions on live URLs are
    slightly less accurate than on the full dataset — but still reliable
    for the strong URL-level signals.

    Parameters
    ----------
    url : str
        Raw URL including scheme (e.g. 'https://example.com/path').

    Returns
    -------
    list[float | int]
        87-element vector in FEATURE_NAMES order.
    """
    try:
        parsed = urlparse(url)
    except Exception:
        return [0] * len(FEATURE_NAMES)

    hostname  = (parsed.hostname or "").lower()
    path      = parsed.path or ""
    query     = parsed.query or ""
    path_q    = (path + "?" + query).lower()
    url_lower = url.lower()

    # ── Registered domain (last two labels) ───────────────────────────────
    parts = hostname.split(".")
    reg_domain = ".".join(parts[-2:]) if len(parts) >= 2 else hostname
    subdomain  = ".".join(parts[:-2]) if len(parts) > 2 else ""

    # ── Word tokens ───────────────────────────────────────────────────────
    words_raw  = _word_tokens(url_lower)
    words_host = _word_tokens(hostname)
    words_path = _word_tokens(path_q)

    def _word_stats(words):
        if not words:
            return 0, 0, 0, 0
        lengths = [len(w) for w in words]
        return (
            sum(lengths),
            min(lengths),
            max(lengths),
            round(sum(lengths) / len(lengths), 2),
        )

    total_raw,   short_raw,   long_raw,   avg_raw   = _word_stats(words_raw)
    total_host,  short_host,  long_host,  avg_host  = _word_stats(words_host)
    total_path,  short_path,  long_path,  avg_path  = _word_stats(words_path)

    # ── Port check ────────────────────────────────────────────────────────
    has_port = 0
    if parsed.port and parsed.port not in (80, 443):
        has_port = 1

    # ── Phish hints (path+query only) ─────────────────────────────────────
    phish_count = sum(kw in path_q for kw in PHISH_HINTS)

    # ── Brand checks ──────────────────────────────────────────────────────
    domain_in_brand   = int(any(b == reg_domain.split(".")[0] for b in BRANDS))
    brand_in_subdomain = int(any(b in subdomain  for b in BRANDS))
    # Only flag brand_in_path when the domain itself is not the brand (impersonation)
    # e.g. github.com/facebook/react → NOT phishing (domain is not a brand)
    # e.g. evil.com/apple/login      → IS suspicious
    brand_in_path = int(
        not domain_in_brand and any(b in path_q for b in BRANDS)
    )

    # ── TLD checks ────────────────────────────────────────────────────────
    tld = "." + parts[-1] if parts else ""
    suspicious_tld = int(tld in SUSPICIOUS_TLDS)

    # ── Digit ratios ──────────────────────────────────────────────────────
    ratio_digits_url  = round(sum(c.isdigit() for c in url)      / max(len(url), 1),      4)
    ratio_digits_host = round(sum(c.isdigit() for c in hostname)  / max(len(hostname), 1), 4)

    return [
        # ── URL surface ───────────────────────────────────────────────────
        len(url),                                       # length_url
        len(hostname),                                  # length_hostname
        _is_ip(hostname),                               # ip
        url.count("."),                                 # nb_dots
        url.count("-"),                                 # nb_hyphens
        url.count("@"),                                 # nb_at
        url.count("?"),                                 # nb_qm
        url.count("&"),                                 # nb_and
        url.count("|"),                                 # nb_or
        url.count("="),                                 # nb_eq
        url.count("_"),                                 # nb_underscore
        url.count("~"),                                 # nb_tilde
        url.count("%"),                                 # nb_percent
        url.count("/"),                                 # nb_slash
        url.count("*"),                                 # nb_star
        url.count(":"),                                 # nb_colon
        url.count(","),                                 # nb_comma
        url.count(";"),                                 # nb_semicolumn
        url.count("$"),                                 # nb_dollar
        url.count(" "),                                 # nb_space
        # ── Token-level ───────────────────────────────────────────────────
        url_lower.count("www"),                         # nb_www
        url_lower.count(".com"),                        # nb_com
        url.count("//"),                                # nb_dslash
        int("http" in path_q),                         # http_in_path
        int("https" in path_q),                        # https_token
        ratio_digits_url,                               # ratio_digits_url
        ratio_digits_host,                              # ratio_digits_host
        # ── Domain-level ──────────────────────────────────────────────────
        int("xn--" in hostname),                        # punycode
        has_port,                                       # port
        _tld_in_part(path),                             # tld_in_path
        _tld_in_part(subdomain),                        # tld_in_subdomain
        int(bool(re.match(r"\d", subdomain))),          # abnormal_subdomain
        hostname.count("."),                            # nb_subdomains
        int("-" in hostname),                           # prefix_suffix
        _random_domain(hostname),                       # random_domain
        int(any(s in hostname for s in SHORTENING_SERVICES)),  # shortening_service
        _has_path_extension(path),                      # path_extension
        path.count("//"),                               # nb_redirection
        path_q.count("http"),                           # nb_external_redirection
        # ── Word / lexical ────────────────────────────────────────────────
        total_raw,                                      # length_words_raw
        _max_char_repeat(url),                          # char_repeat
        short_raw,                                      # shortest_words_raw
        short_host,                                     # shortest_word_host
        short_path,                                     # shortest_word_path
        long_raw,                                       # longest_words_raw
        long_host,                                      # longest_word_host
        long_path,                                      # longest_word_path
        avg_raw,                                        # avg_words_raw
        avg_host,                                       # avg_word_host
        avg_path,                                       # avg_word_path
        # ── Semantic / brand ──────────────────────────────────────────────
        phish_count,                                    # phish_hints
        domain_in_brand,                                # domain_in_brand
        brand_in_subdomain,                             # brand_in_subdomain
        brand_in_path,                                  # brand_in_path
        suspicious_tld,                                 # suspecious_tld
    ]