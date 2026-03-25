# ml_service/train.py
#
# Training pipeline for the phishing URL classifier.
#
# FIX (v2): Trains on URL-only features ONLY (55 features).
#
# Root cause of original bug:
#   Old model used 87 features including page-level features
#   (google_index, page_rank, web_traffic, nb_hyperlinks) which were
#   the top 4 most important features (~40% combined importance).
#   At prediction time these were always 0 (no page fetching),
#   so the model flagged every URL — even youtube.com — as phishing.
#
# Fix:
#   Train only on the 55 features that extract_features() can compute
#   from the URL string alone. Gives ~91% accuracy honestly.
#
# Usage:
#   pip install pandas scikit-learn joblib
#   python train.py
#   python train.py --data dataset_phishing.csv --model model.pkl --trees 200

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

# ── URL-only feature columns — must match extract_features() return order ─────
URL_ONLY_FEATURE_COLS = [
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
    "suspecious_tld",
]


def _bar(value, width=40, fill="█", empty="░"):
    filled = int(round(value * width))
    return fill * filled + empty * (width - filled)


def _section(title, width=60):
    pad = (width - len(title) - 2) // 2
    return "\n" + "─" * pad + f" {title} " + "─" * pad


def _log(msg, lines):
    print(msg)
    lines.append(msg)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--data",  default="dataset_phishing.csv")
    parser.add_argument("--model", default="model.pkl")
    parser.add_argument("--trees", type=int, default=200)
    parser.add_argument("--depth", type=int, default=20)
    parser.add_argument("--report", default="model_training_report.txt")
    args = parser.parse_args()

    lines = []

    header = "=" * 60 + "\n  PHISHING URL CLASSIFIER — TRAINING REPORT (v2: URL-only)\n" + "=" * 60
    _log(header, lines)

    # ── Load dataset ──────────────────────────────────────────────────────────
    _log(_section("Dataset"), lines)
    df = pd.read_csv(args.data)
    y  = (df["status"] == "phishing").astype(int)
    X  = df[URL_ONLY_FEATURE_COLS]

    n_total   = len(df)
    n_phish   = int(y.sum())
    n_legit   = int((y == 0).sum())
    n_feats   = X.shape[1]
    n_train   = int(n_total * 0.8)
    n_test    = n_total - n_train

    _log(f"  File          : {args.data}",             lines)
    _log(f"  Feature mode  : URL-only (55 features)",  lines)
    _log(f"  Total samples : {n_total:,}",             lines)
    _log(f"  Phishing      : {n_phish:,}  ({n_phish/n_total*100:.1f}%)", lines)
    _log(f"  Legitimate    : {n_legit:,}  ({n_legit/n_total*100:.1f}%)", lines)
    _log(f"  Features      : {n_feats}",               lines)
    _log(f"  Train split   : {n_train:,} (80%)",       lines)
    _log(f"  Test split    : {n_test:,}  (20%)",       lines)

    # ── Train ─────────────────────────────────────────────────────────────────
    _log(_section("Training"), lines)
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    clf = RandomForestClassifier(
        n_estimators=args.trees,
        max_depth=args.depth,
        class_weight="balanced",
        random_state=42,
        n_jobs=-1,
    )

    _log(f"  Algorithm     : Random Forest",       lines)
    _log(f"  Trees         : {args.trees}",        lines)
    _log(f"  Max depth     : {args.depth}",        lines)
    _log(f"  Class weight  : balanced",            lines)
    _log(f"  Status        : training …",          lines)

    t0 = time.time()
    clf.fit(X_train, y_train)
    elapsed = time.time() - t0
    _log(f"  Done in       : {elapsed:.1f}s",      lines)

    # ── Evaluate ──────────────────────────────────────────────────────────────
    _log(_section("Evaluation — Hold-out Test Set (20%)"), lines)

    y_pred  = clf.predict(X_test)
    y_proba = clf.predict_proba(X_test)[:, 1]

    acc  = accuracy_score(y_test, y_pred)
    auc  = roc_auc_score(y_test, y_proba)
    cm   = confusion_matrix(y_test, y_pred)
    rep  = classification_report(y_test, y_pred, target_names=["legitimate", "phishing"])

    prec_l = cm[0, 0] / (cm[0, 0] + cm[1, 0]) if (cm[0,0]+cm[1,0]) else 0
    rec_l  = cm[0, 0] / (cm[0, 0] + cm[0, 1]) if (cm[0,0]+cm[0,1]) else 0
    prec_p = cm[1, 1] / (cm[0, 1] + cm[1, 1]) if (cm[0,1]+cm[1,1]) else 0
    rec_p  = cm[1, 1] / (cm[1, 0] + cm[1, 1]) if (cm[1,0]+cm[1,1]) else 0
    f1     = 2 * prec_p * rec_p / (prec_p + rec_p) if (prec_p + rec_p) else 0

    _log(f"\n  Accuracy      :  {acc*100:.2f}%   {_bar(acc)}", lines)
    _log(f"  ROC-AUC       :  {auc*100:.2f}%   {_bar(auc)}", lines)
    _log(f"  Precision     :  {prec_p*100:.2f}%   {_bar(prec_p)}", lines)
    _log(f"  Recall        :  {rec_p*100:.2f}%   {_bar(rec_p)}", lines)
    _log(f"  F1-Score      :  {f1*100:.2f}%   {_bar(f1)}", lines)
    _log(f"\n  Confusion Matrix:", lines)
    _log(f"                   Predicted",           lines)
    _log(f"                Legit   Phishing",       lines)
    _log(f"  Actual Legit  {cm[0,0]:6d}   {cm[0,1]:6d}", lines)
    _log(f"  Actual Phish  {cm[1,0]:6d}   {cm[1,1]:6d}", lines)
    _log(f"\n  False Positives (legit flagged as phish): {cm[0,1]}", lines)
    _log(f"  False Negatives (phish missed)          : {cm[1,0]}", lines)
    _log(f"\n  Full Classification Report:\n{rep}", lines)

    # ── Cross-validation ──────────────────────────────────────────────────────
    _log(_section("5-Fold Cross-Validation"), lines)
    _log("  Running 5-fold CV on full dataset …", lines)
    cv = cross_val_score(clf, X, y, cv=5, scoring="accuracy", n_jobs=-1)
    _log(f"  Fold scores   : {' | '.join(f'{s*100:.2f}%' for s in cv)}", lines)
    _log(f"  Mean          : {cv.mean()*100:.2f}%", lines)
    _log(f"  Std dev       : ±{cv.std()*100:.2f}%", lines)

    # ── Feature importances ───────────────────────────────────────────────────
    _log(_section("Top 15 Feature Importances"), lines)
    imps = sorted(zip(URL_ONLY_FEATURE_COLS, clf.feature_importances_),
                  key=lambda x: x[1], reverse=True)
    for i, (name, imp) in enumerate(imps[:15], 1):
        _log(f"  {i:2d}. {name:<35} {imp:.4f}  {_bar(imp/imps[0][1], 30)}", lines)

    # ── Save ──────────────────────────────────────────────────────────────────
    _log(_section("Saving"), lines)
    joblib.dump(clf, args.model)
    _log(f"  Model saved   → {args.model}", lines)

    with open(args.report, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))
    _log(f"  Report saved  → {args.report}", lines)


if __name__ == "__main__":
    main()