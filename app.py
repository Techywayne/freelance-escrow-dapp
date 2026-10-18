import os
import re

from flask import Flask, jsonify, render_template

ETHEREUM_ADDRESS = re.compile(r"^0x[a-fA-F0-9]{40}$")


def create_app(test_config=None):
    app = Flask(__name__)
    app.config.from_mapping(
        CONTRACT_ADDRESS=os.environ.get("CONTRACT_ADDRESS", "").strip(),
        CHAIN_ID=int(os.environ.get("CHAIN_ID", "11155111")),
        NETWORK_NAME=os.environ.get("NETWORK_NAME", "Sepolia").strip(),
        EXPLORER_URL=os.environ.get("EXPLORER_URL", "https://sepolia.etherscan.io").rstrip("/"),
    )

    if test_config:
        app.config.update(test_config)

    contract_address = app.config["CONTRACT_ADDRESS"]
    if contract_address and not ETHEREUM_ADDRESS.fullmatch(contract_address):
        raise ValueError("CONTRACT_ADDRESS must be a valid 0x Ethereum address")

    @app.after_request
    def add_security_headers(response):
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        return response

    @app.get("/")
    def home():
        return render_template("index.html")

    @app.get("/api/config")
    def public_config():
        return jsonify(
            contractAddress=app.config["CONTRACT_ADDRESS"],
            chainId=app.config["CHAIN_ID"],
            networkName=app.config["NETWORK_NAME"],
            explorerUrl=app.config["EXPLORER_URL"],
        )

    @app.get("/api/health")
    def health():
        return jsonify(status="ok")

    return app


app = create_app()


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", "5000")), debug=False)
