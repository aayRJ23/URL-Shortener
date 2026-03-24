# ml_service/app.py
#
# Flask ML microservice — spam/phishing URL detection
# Run: python app.py  (default port 5001)

from flask import Flask, request, jsonify
from urllib.parse import urlparse
from predictor import predict_url

app = Flask(__name__)

ALLOWED_SCHEMES = {"http", "https"}


# ── Health check ──────────────────────────────────────────────────────────────

@app.route("/health", methods=["GET"])
def health():
    return jsonify({"success": True, "status": "ok"})


# ── Predict ───────────────────────────────────────────────────────────────────

@app.route("/predict", methods=["POST"])
def predict():
    data = request.get_json(force=True, silent=True)

    if not data:
        return jsonify({"success": False, "error": "Request body must be JSON"}), 400

    url = data.get("url", "").strip()

    if not url:
        return jsonify({"success": False, "error": "'url' field is required"}), 400

    # Validate scheme — block javascript:, file://, data: etc.
    try:
        scheme = urlparse(url).scheme.lower()
    except Exception:
        return jsonify({"success": False, "error": "Malformed URL"}), 400

    if scheme not in ALLOWED_SCHEMES:
        return jsonify({
            "success": False,
            "error": f"Unsupported URL scheme '{scheme}'. Only http and https are accepted.",
        }), 400

    result = predict_url(url)

    return jsonify({"success": True, **result}), 200


# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    # Never run with debug=True in production
    app.run(host="0.0.0.0", port=5001, debug=False)