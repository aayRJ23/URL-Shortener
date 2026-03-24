# ml_service/train.py
#
# Training pipeline for the spam/phishing URL classifier.
#
# Dataset:
#   Download from Kaggle: "Web page Phishing Detection Dataset"
#   https://www.kaggle.com/datasets/shashwatwork/web-page-phishing-detection-dataset
#   File: dataset_phishing.csv  |  Columns: url, status ("phishing"|"legitimate")
#
# Usage:
#   pip install pandas scikit-learn joblib
#   python train.py --data dataset_phishing.csv
#   python train.py --data dataset_phishing.csv --model my_model.pkl --trees 300
#
# Output:
#   model.pkl          — trained Random Forest saved with joblib
#   training_report.txt — full metrics saved for project description / README

import argparse
import os
import time
import joblib
import numpy as np
import pandas as pd

from sklearn.ensemble        import RandomForestClassifier
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.metrics         import (
    accuracy_score, classification_report,
    confusion_matrix, roc_auc_score,
)

# Dataset column names that are the 87 pre-computed features
# (everything except 'url' and 'status')
DATASET_FEATURE_COLS = [
    "length_url", "length_hostname", "ip", "nb_dots", "nb_hyphens",
    "nb_at", "nb_qm", "nb_and", "nb_or", "nb_eq", "nb_underscore",
    "nb_tilde", "nb_percent", "nb_slash", "nb_star", "nb_colon",
    "nb_comma", "nb_semicolumn", "nb_dollar", "nb_space", "nb_www",
    "nb_com", "nb_dslash", "http_in_path", "https_token",
    "ratio_digits_url", "ratio_digits_host", "punycode", "port",
    "tld_in_path", "tld_in_subdomain", "abnormal_subdomain",
    "nb_subdomains", "prefix_suffix", "random_domain",
    "shortening_service", "path_extension", "nb_redirection",
    "nb_external_redirection", "length_words_raw", "char_repeat",
    "shortest_words_raw", "shortest_word_host", "shortest_word_path",
    "longest_words_raw", "longest_word_host", "longest_word_path",
    "avg_words_raw", "avg_word_host", "avg_word_path", "phish_hints",
    "domain_in_brand", "brand_in_subdomain", "brand_in_path",
    "suspecious_tld", "statistical_report", "nb_hyperlinks",
    "ratio_intHyperlinks", "ratio_extHyperlinks", "ratio_nullHyperlinks",
    "nb_extCSS", "ratio_intRedirection", "ratio_extRedirection",
    "ratio_intErrors", "ratio_extErrors", "login_form",
    "external_favicon", "links_in_tags", "submit_email",
    "ratio_intMedia", "ratio_extMedia", "sfh", "iframe",
    "popup_window", "safe_anchor", "onmouseover", "right_clic",
    "empty_title", "domain_in_title", "domain_with_copyright",
    "whois_registered_domain", "domain_registration_length",
    "domain_age", "web_traffic", "dns_record", "google_index",
    "page_rank",
]


# ── Pretty print helpers ──────────────────────────────────────────────────────

def _bar(value: float, width: int = 40, fill: str = "█", empty: str = "░") -> str:
    filled = int(round(value * width))
    return fill * filled + empty * (width - filled)


def _section(title: str, width: int = 60) -> str:
    pad = (width - len(title) - 2) // 2
    return "\n" + "─" * pad + f" {title} " + "─" * pad


def _print_and_log(msg: str, log_lines: list) -> None:
    print(msg)
    log_lines.append(msg)


# ── Dataset loader ────────────────────────────────────────────────────────────

def load_dataset(path: str):
    """
    Load CSV and return (X, y, feature_names).

    Handles two formats:
      • dataset_phishing.csv  — has pre-computed feature columns + 'status' column
      • Simple format         — has only 'url' + 'status'/'label' columns
    """
    df = pd.read_csv(path)

    # Normalise label column → 1 = phishing, 0 = legitimate
    if "status" in df.columns:
        y = (df["status"] == "phishing").astype(int)
    elif "label" in df.columns:
        y = df["label"].astype(int)
    else:
        raise ValueError(
            "Cannot find label column. Expected 'status' or 'label'. "
            f"Columns found: {list(df.columns)}"
        )

    # Prefer pre-computed features if available (much more accurate)
    available = [c for c in DATASET_FEATURE_COLS if c in df.columns]

    if len(available) >= 10:
        X = df[available].fillna(0)
        feature_names = available
        mode = "dataset (pre-computed features)"
    else:
        # Fall back to live URL extraction
        from features import extract_features, FEATURE_NAMES
        print("[Train] Pre-computed features not found — extracting from URLs …")
        if "url" not in df.columns:
            raise ValueError("No 'url' column found for feature extraction.")
        X = pd.DataFrame(
            df["url"].apply(extract_features).tolist(),
            columns=FEATURE_NAMES,
        )
        feature_names = FEATURE_NAMES
        mode = "URL extraction (fallback)"

    return X.values, y.values, feature_names, mode


# ── Main training function ────────────────────────────────────────────────────

def train(data_path: str, model_output: str = "model.pkl", n_trees: int = 200):

    log_lines = []   # accumulates every printed line → saved to report

    # ── Header ────────────────────────────────────────────────────────────
    header = "=" * 60
    title  = "  PHISHING URL CLASSIFIER — TRAINING REPORT"
    _print_and_log(header, log_lines)
    _print_and_log(title,  log_lines)
    _print_and_log(header, log_lines)

    # ── Load data ─────────────────────────────────────────────────────────
    _print_and_log(_section("Dataset"), log_lines)
    t0 = time.time()

    X, y, feature_names, mode = load_dataset(data_path)
    n_total   = len(y)
    n_phish   = int(y.sum())
    n_legit   = n_total - n_phish
    n_features = X.shape[1]

    _print_and_log(f"  File          : {data_path}", log_lines)
    _print_and_log(f"  Feature mode  : {mode}", log_lines)
    _print_and_log(f"  Total samples : {n_total:,}", log_lines)
    _print_and_log(f"  Phishing      : {n_phish:,}  ({n_phish/n_total*100:.1f}%)", log_lines)
    _print_and_log(f"  Legitimate    : {n_legit:,}  ({n_legit/n_total*100:.1f}%)", log_lines)
    _print_and_log(f"  Features      : {n_features}", log_lines)

    # ── Train / test split ────────────────────────────────────────────────
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.20, random_state=42, stratify=y
    )
    _print_and_log(f"  Train split   : {len(X_train):,} (80%)", log_lines)
    _print_and_log(f"  Test split    : {len(X_test):,}  (20%)", log_lines)

    # ── Train model ───────────────────────────────────────────────────────
    _print_and_log(_section("Training"), log_lines)
    _print_and_log(f"  Algorithm     : Random Forest", log_lines)
    _print_and_log(f"  Trees         : {n_trees}", log_lines)
    _print_and_log(f"  Max depth     : 20", log_lines)
    _print_and_log(f"  Class weight  : balanced", log_lines)
    _print_and_log("  Status        : training …", log_lines)

    clf = RandomForestClassifier(
        n_estimators   = n_trees,
        max_depth      = 20,
        min_samples_split = 5,
        class_weight   = "balanced",
        random_state   = 42,
        n_jobs         = -1,
    )

    t_train = time.time()
    clf.fit(X_train, y_train)
    train_time = time.time() - t_train

    _print_and_log(f"  Done in       : {train_time:.1f}s", log_lines)

    # ── Evaluation ────────────────────────────────────────────────────────
    _print_and_log(_section("Evaluation — Hold-out Test Set (20%)"), log_lines)

    y_pred  = clf.predict(X_test)
    y_proba = clf.predict_proba(X_test)[:, 1]

    acc      = accuracy_score(y_test, y_pred)
    auc      = roc_auc_score(y_test, y_proba)
    cm       = confusion_matrix(y_test, y_pred)
    tn, fp, fn, tp = cm.ravel()
    precision_p = tp / (tp + fp) if (tp + fp) else 0
    recall_p    = tp / (tp + fn) if (tp + fn) else 0
    f1_p        = 2 * precision_p * recall_p / (precision_p + recall_p) if (precision_p + recall_p) else 0

    _print_and_log(f"\n  Accuracy      :  {acc*100:.2f}%   {_bar(acc)}", log_lines)
    _print_and_log(f"  ROC-AUC       :  {auc*100:.2f}%   {_bar(auc)}", log_lines)
    _print_and_log(f"  Precision     :  {precision_p*100:.2f}%   {_bar(precision_p)}", log_lines)
    _print_and_log(f"  Recall        :  {recall_p*100:.2f}%   {_bar(recall_p)}", log_lines)
    _print_and_log(f"  F1-Score      :  {f1_p*100:.2f}%   {_bar(f1_p)}", log_lines)

    _print_and_log("\n  Confusion Matrix:", log_lines)
    _print_and_log("                   Predicted", log_lines)
    _print_and_log("                Legit   Phishing", log_lines)
    _print_and_log(f"  Actual Legit  {tn:>6}   {fp:>8}", log_lines)
    _print_and_log(f"  Actual Phish  {fn:>6}   {tp:>8}", log_lines)
    _print_and_log(f"\n  False Positives (legit flagged as phish): {fp}", log_lines)
    _print_and_log(f"  False Negatives (phish missed)          : {fn}", log_lines)

    # Full sklearn report
    _print_and_log("\n  Full Classification Report:", log_lines)
    report = classification_report(y_test, y_pred, target_names=["legitimate", "phishing"])
    for line in report.splitlines():
        _print_and_log("    " + line, log_lines)

    # ── Cross-validation ──────────────────────────────────────────────────
    _print_and_log(_section("5-Fold Cross-Validation"), log_lines)
    _print_and_log("  Running 5-fold CV on full dataset …", log_lines)

    cv_scores = cross_val_score(clf, X, y, cv=5, scoring="accuracy", n_jobs=-1)
    _print_and_log(f"  Fold scores   : {' | '.join(f'{s*100:.2f}%' for s in cv_scores)}", log_lines)
    _print_and_log(f"  Mean          : {cv_scores.mean()*100:.2f}%", log_lines)
    _print_and_log(f"  Std dev       : ±{cv_scores.std()*100:.2f}%", log_lines)

    # ── Feature importances ───────────────────────────────────────────────
    _print_and_log(_section("Top 15 Feature Importances"), log_lines)
    importances = sorted(
        zip(feature_names, clf.feature_importances_),
        key=lambda x: x[1], reverse=True,
    )
    for rank, (name, imp) in enumerate(importances[:15], 1):
        bar = _bar(imp / importances[0][1], width=30)
        _print_and_log(f"  {rank:>2}. {name:<35} {imp:.4f}  {bar}", log_lines)

    # ── Save model ────────────────────────────────────────────────────────
    _print_and_log(_section("Saving"), log_lines)
    joblib.dump(clf, model_output)
    _print_and_log(f"  Model saved   → {model_output}", log_lines)

    # ── Save report ───────────────────────────────────────────────────────
    report_path = os.path.splitext(model_output)[0] + "_training_report.txt"
    with open(report_path, "w", encoding="utf-8") as f:
        f.write("\n".join(log_lines))
    _print_and_log(f"  Report saved  → {report_path}", log_lines)

    total_time = time.time() - t0
    _print_and_log(f"\n  Total time    : {total_time:.1f}s", log_lines)
    _print_and_log("=" * 60, log_lines)

    return clf


# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Train phishing URL classifier")
    parser.add_argument("--data",  required=True,           help="Path to CSV dataset")
    parser.add_argument("--model", default="model.pkl",     help="Output model path")
    parser.add_argument("--trees", default=200, type=int,   help="Number of RF trees (default 200)")
    args = parser.parse_args()

    if not os.path.exists(args.data):
        raise FileNotFoundError(f"Dataset not found: {args.data}")

    train(args.data, args.model, args.trees)