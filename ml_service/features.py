# ml_service/features.py  (v3 — fixed false-positive bugs)
#
# Changes from v2:
#  - _random_domain: real-word allowlist added; consonant-run 4→5; entropy 3.8→4.2
#  - _has_path_extension: .html/.htm removed (docs sites use them legitimately)
#  - PHISH_HINTS: removed "admin" and "support" (too many FPs on legit SaaS URLs)
#  - SHORTENING_SERVICES: removed appspot.com (legitimate Google App Engine hosting)
#  - SUSPICIOUS_TLDS: narrowed to only heavily-abused Freenom TLDs + .pw/.icu
#  - FEATURE_NAMES order unchanged (no retraining needed for live-prediction fix)

import re
import math
import ipaddress
from urllib.parse import urlparse

SHORTENING_SERVICES = {
    "bit.ly", "tinyurl.com", "t.co", "goo.gl", "ow.ly", "is.gd",
    "buff.ly", "adf.ly", "bit.do", "mcaf.ee", "su.pr", "twit.ac",
    "hyperphp.com",
}

SUSPICIOUS_TLDS = {
    ".tk", ".ml", ".ga", ".cf", ".gq",
    ".pw", ".icu",
}

BRANDS = [
    "paypal", "apple", "amazon", "microsoft", "google", "facebook",
    "instagram", "netflix", "ebay", "wellsfargo", "bankofamerica",
    "chase", "citibank", "dhl", "fedex", "whatsapp", "twitter",
]

PHISH_HINTS = [
    "login", "signin", "sign-in", "verify", "secure", "account",
    "update", "confirm", "banking", "password", "credential",
    "webscr", "wp-admin", "recover", "unlock",
    "suspended", "billing", "invoice",
]

_REAL_WORDS = {
    "github", "gitlab", "bitbucket", "stackoverflow", "stackexchange",
    "npmjs", "pypi", "python", "reactjs", "nextjs", "nodejs", "vuejs",
    "angular", "svelte", "webpack", "rollup", "vite", "tailwindcss",
    "bootstrap", "jquery", "typescript", "javascript", "golang",
    "rustlang", "kotlinlang", "flutter", "android", "vercel", "netlify",
    "railway", "render", "heroku", "glitch", "replit", "codepen",
    "codesandbox", "jsfiddle", "stackblitz",
    "medium", "substack", "hashnode", "devto", "youtube", "vimeo",
    "twitch", "spotify", "soundcloud", "imgur", "flickr", "pinterest",
    "dribbble", "behance", "figma", "canva",
    "cloudflare", "fastly", "akamai", "digitalocean", "linode",
    "vultr", "ovh", "hetzner", "mongodb", "firebase", "supabase",
    "planetscale", "neon", "upstash", "sendgrid", "mailchimp",
    "stripe", "twilio", "algolia", "elastic", "grafana", "datadog",
    "wikipedia", "wikimedia", "archive", "ycombinator", "producthunt",
    "techcrunch", "theverge", "wired", "notion", "airtable", "asana",
    "trello", "linear", "jira", "confluence", "slack", "discord",
    "telegram", "signal", "zoom", "loom", "calendly", "typeform",
    "shopify", "wordpress", "blogger", "wix", "squarespace", "webflow",
}

FEATURE_NAMES = [
    "length_url", "length_hostname", "ip", "nb_dots", "nb_hyphens",
    "nb_at", "nb_qm", "nb_and", "nb_or", "nb_eq", "nb_underscore",
    "nb_tilde", "nb_percent", "nb_slash", "nb_star", "nb_colon",
    "nb_comma", "nb_semicolumn", "nb_dollar", "nb_space",
    "nb_www", "nb_com", "nb_dslash", "http_in_path", "https_token",
    "ratio_digits_url", "ratio_digits_host",
    "punycode", "port", "tld_in_path", "tld_in_subdomain",
    "abnormal_subdomain", "nb_subdomains", "prefix_suffix",
    "random_domain", "shortening_service", "path_extension",
    "nb_redirection", "nb_external_redirection",
    "length_words_raw", "char_repeat",
    "shortest_words_raw", "shortest_word_host", "shortest_word_path",
    "longest_words_raw", "longest_word_host", "longest_word_path",
    "avg_words_raw", "avg_word_host", "avg_word_path",
    "phish_hints", "domain_in_brand", "brand_in_subdomain", "brand_in_path",
    "suspecious_tld",
]


def _is_ip(hostname):
    try:
        ipaddress.ip_address(hostname)
        return 1
    except ValueError:
        return 0


def _entropy(s):
    if not s:
        return 0.0
    freq = {}
    for ch in s:
        freq[ch] = freq.get(ch, 0) + 1
    n = len(s)
    return -sum((c / n) * math.log2(c / n) for c in freq.values())


def _word_tokens(text):
    return [w for w in re.split(r"[^a-zA-Z0-9]", text) if w]


def _max_char_repeat(s):
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


def _has_path_extension(path):
    # .html/.htm removed — used by many legitimate documentation sites
    extensions = {".php", ".asp", ".aspx", ".jsp", ".cgi", ".pl", ".exe", ".sh"}
    last = path.rsplit("/", 1)[-1].lower()
    return int(any(last.endswith(ext) for ext in extensions))


def _random_domain(hostname):
    parts = hostname.split(".")
    registered = parts[-2] if len(parts) >= 2 else hostname
    label = registered.lower()

    # Known real words are never random
    if label in _REAL_WORDS:
        return 0

    # Consonant run of 5+ is a strong randomness signal (raised from 4)
    if re.search(r"[bcdfghjklmnpqrstvwxyz]{5,}", label, re.I):
        return 1

    # High entropy only for longer labels (raised thresholds)
    if len(label) >= 7 and _entropy(label) > 4.2:
        return 1

    return 0


_COMMON_TLDS = {
    "com", "net", "org", "edu", "gov", "io", "co",
    "uk", "de", "fr", "it", "ru", "cn", "jp", "br",
}


def _tld_in_part(part):
    tokens = _word_tokens(part.lower())
    return int(any(t in _COMMON_TLDS for t in tokens))


def extract_features(url):
    try:
        parsed = urlparse(url)
    except Exception:
        return [0] * len(FEATURE_NAMES)

    hostname  = (parsed.hostname or "").lower()
    path      = parsed.path or ""
    query     = parsed.query or ""
    path_q    = (path + "?" + query).lower()
    url_lower = url.lower()

    parts      = hostname.split(".")
    reg_domain = ".".join(parts[-2:]) if len(parts) >= 2 else hostname
    subdomain  = ".".join(parts[:-2]) if len(parts) > 2 else ""

    words_raw  = _word_tokens(url_lower)
    words_host = _word_tokens(hostname)
    words_path = _word_tokens(path_q)

    def _word_stats(words):
        if not words:
            return 0, 0, 0, 0
        lengths = [len(w) for w in words]
        return (sum(lengths), min(lengths), max(lengths),
                round(sum(lengths) / len(lengths), 2))

    total_raw,  short_raw,  long_raw,  avg_raw  = _word_stats(words_raw)
    total_host, short_host, long_host, avg_host = _word_stats(words_host)
    total_path, short_path, long_path, avg_path = _word_stats(words_path)

    has_port = 0
    if parsed.port and parsed.port not in (80, 443):
        has_port = 1

    phish_count        = sum(kw in path_q for kw in PHISH_HINTS)
    domain_in_brand    = int(any(b == reg_domain.split(".")[0] for b in BRANDS))
    brand_in_subdomain = int(any(b in subdomain for b in BRANDS))
    brand_in_path      = int(not domain_in_brand and any(b in path_q for b in BRANDS))

    tld = "." + parts[-1] if parts else ""
    suspicious_tld = int(tld in SUSPICIOUS_TLDS)

    ratio_digits_url  = round(sum(c.isdigit() for c in url)     / max(len(url), 1),      4)
    ratio_digits_host = round(sum(c.isdigit() for c in hostname) / max(len(hostname), 1), 4)

    return [
        len(url), len(hostname), _is_ip(hostname),
        url.count("."), url.count("-"), url.count("@"),
        url.count("?"), url.count("&"), url.count("|"),
        url.count("="), url.count("_"), url.count("~"),
        url.count("%"), url.count("/"), url.count("*"),
        url.count(":"), url.count(","), url.count(";"),
        url.count("$"), url.count(" "),
        url_lower.count("www"), url_lower.count(".com"), url.count("//"),
        int("http" in path_q), int("https" in path_q),
        ratio_digits_url, ratio_digits_host,
        int("xn--" in hostname), has_port,
        _tld_in_part(path), _tld_in_part(subdomain),
        int(bool(re.match(r"\d", subdomain))),
        hostname.count("."), int("-" in hostname),
        _random_domain(hostname),
        int(any(s in hostname for s in SHORTENING_SERVICES)),
        _has_path_extension(path),
        path.count("//"), path_q.count("http"),
        total_raw, _max_char_repeat(url),
        short_raw, short_host, short_path,
        long_raw, long_host, long_path,
        avg_raw, avg_host, avg_path,
        phish_count, domain_in_brand, brand_in_subdomain, brand_in_path,
        suspicious_tld,
    ]