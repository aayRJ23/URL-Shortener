# ml_service/app.py
# Flask ML microservice — spam/phishing URL detection
# Run: python app.py  (default port 5001)

from flask import Flask, request, jsonify
from predictor import predict_url

app = Flask(__name__)


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"})


@app.route("/predict", methods=["POST"])
def predict():
    data = request.get_json(force=True)
    url  = data.get("url", "").strip()

    if not url:
        return jsonify({"error": "url is required"}), 400

    result = predict_url(url)
    return jsonify(result), 200


if __name__ == "__main__":
    # Never run with debug=True in production
    app.run(host="0.0.0.0", port=5001, debug=False)