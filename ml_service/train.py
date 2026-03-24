# ml_service/train.py
#
# Training pipeline for the spam/phishing URL classifier.
#
# Dataset:
#   Download from Kaggle: "Web page Phishing Detection Dataset"
#   https://www.kaggle.com/datasets/shashwatwork/web-page-phishing-detection-dataset
#   File: dataset_phishing.csv
#   Columns: url (string), status ("phishing" | "legitimate")
#
# OR use the simpler PhiUSIIL dataset:
#   https://www.kaggle.com/datasets/harisudhan411/phishing-and-legitimate-urls
#   Columns: url, label (1 = phishing, 0 = legitimate)
#
# Usage:
#   pip install pandas scikit-learn joblib
#   python train.py --data dataset_phishing.csv
#
# Output:
#   model.pkl  — trained Random Forest saved with joblib

import argparse
import os
import pandas as pd
import joblib
from sklearn.ensemble         import RandomForestClassifier
from sklearn.model_selection  import train_test_split
from sklearn.metrics          import classification_report, accuracy_score
from features                 import extract_features, FEATURE_NAMES


def load_dataset(path: str) -> pd.DataFrame:
    """
    Load CSV and normalise to two columns: url (str) and label (int, 1=spam).
    Handles the two most common public phishing datasets automatically.
    """
    df = pd.read_csv(path)

    # ── Format 1: status column ("phishing" / "legitimate") ──────────────────
    if "status" in df.columns:
        df["label"] = (df["status"] == "phishing").astype(int)

    # ── Format 2: label column (1 / 0) ───────────────────────────────────────
    elif "label" in df.columns:
        df["label"] = df["label"].astype(int)

    # ── Format 3: type column (1 / 0 or "bad"/"good") ────────────────────────
    elif "type" in df.columns:
        df["label"] = df["type"].apply(lambda x: 1 if str(x) in ["1", "bad", "phishing"] else 0)

    else:
        raise ValueError(
            "Cannot find label column. Expected 'status', 'label', or 'type'. "
            f"Columns found: {list(df.columns)}"
        )

    if "url" not in df.columns:
        raise ValueError(f"Cannot find 'url' column. Columns found: {list(df.columns)}")

    df = df[["url", "label"]].dropna()
    print(f"[Train] Dataset loaded: {len(df)} rows | spam: {df['label'].sum()} | legit: {(df['label']==0).sum()}")
    return df


def build_feature_matrix(df: pd.DataFrame):
    """Extract features for every URL row. Returns X (numpy array) and y (series)."""
    print("[Train] Extracting features (this may take a moment)…")
    X = df["url"].apply(extract_features).tolist()
    y = df["label"].tolist()
    return X, y


def train(data_path: str, model_output: str = "model.pkl"):
    df   = load_dataset(data_path)
    X, y = build_feature_matrix(df)

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    print(f"[Train] Training set: {len(X_train)} | Test set: {len(X_test)}")

    # ── Random Forest ─────────────────────────────────────────────────────────
    # n_estimators=200 gives good accuracy without being slow.
    # class_weight="balanced" handles imbalanced datasets automatically.
    clf = RandomForestClassifier(
        n_estimators=200,
        max_depth=20,
        min_samples_split=5,
        class_weight="balanced",
        random_state=42,
        n_jobs=-1,          # use all CPU cores
    )

    clf.fit(X_train, y_train)

    # ── Evaluation ────────────────────────────────────────────────────────────
    y_pred = clf.predict(X_test)
    acc    = accuracy_score(y_test, y_pred)
    print(f"\n[Train] Accuracy: {acc:.4f}")
    print(classification_report(y_test, y_pred, target_names=["legitimate", "spam"]))

    # ── Feature importance ────────────────────────────────────────────────────
    importances = sorted(
        zip(FEATURE_NAMES, clf.feature_importances_),
        key=lambda x: x[1], reverse=True
    )
    print("\n[Train] Feature importances:")
    for name, imp in importances:
        bar = "█" * int(imp * 50)
        print(f"  {name:<25} {imp:.4f}  {bar}")

    # ── Save model ────────────────────────────────────────────────────────────
    joblib.dump(clf, model_output)
    print(f"\n[Train] Model saved → {model_output}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Train phishing URL classifier")
    parser.add_argument("--data",  required=True, help="Path to CSV dataset")
    parser.add_argument("--model", default="model.pkl", help="Output model path")
    args = parser.parse_args()

    if not os.path.exists(args.data):
        raise FileNotFoundError(f"Dataset not found: {args.data}")

    train(args.data, args.model)