import pytest

from app import create_app


@pytest.fixture()
def client():
    app = create_app(
        {
            "TESTING": True,
            "CONTRACT_ADDRESS": "0x1111111111111111111111111111111111111111",
            "CHAIN_ID": 11155111,
            "NETWORK_NAME": "Sepolia",
            "EXPLORER_URL": "https://sepolia.etherscan.io",
        }
    )
    return app.test_client()


def test_home_page(client):
    response = client.get("/")
    assert response.status_code == 200
    assert b"FairPay Escrow" in response.data


def test_public_config_contains_browser_safe_values(client):
    response = client.get("/api/config")
    assert response.status_code == 200
    assert response.json == {
        "chainId": 11155111,
        "contractAddress": "0x1111111111111111111111111111111111111111",
        "explorerUrl": "https://sepolia.etherscan.io",
        "networkName": "Sepolia",
    }


def test_health_and_security_headers(client):
    response = client.get("/api/health")
    assert response.json == {"status": "ok"}
    assert response.headers["X-Content-Type-Options"] == "nosniff"
    assert response.headers["X-Frame-Options"] == "DENY"


def test_invalid_contract_address_is_rejected():
    with pytest.raises(ValueError, match="CONTRACT_ADDRESS"):
        create_app({"CONTRACT_ADDRESS": "not-an-address"})
