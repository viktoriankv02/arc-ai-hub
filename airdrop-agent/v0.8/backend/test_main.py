from fastapi.testclient import TestClient

from . import main

client = TestClient(main.app)


def test_health():
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["ok"] is True
    assert response.json()["version"] == "0.9.0"


def test_wallet_validation():
    address = "0x3e46DE6fDe4565e999fBa1EB72e027E2894823B8"
    response = client.post("/api/wallet/validate", json={"address": address, "chains": ["arc-testnet"]})
    assert response.status_code == 200
    body = response.json()
    assert body["ok"] is True
    assert body["address"] == address.lower()
    assert body["chains"][0]["chain_id"] == 57001


def test_invalid_wallet_is_rejected():
    response = client.post("/api/wallet/validate", json={"address": "0x123", "chains": ["arc-testnet"]})
    assert response.status_code == 400


def test_testnet_status(monkeypatch):
    def fake_rpc(chain, method, params):
        return {"eth_chainId": "0xdea9", "eth_blockNumber": "0x1234"}[method]

    monkeypatch.setattr(main, "rpc_call", fake_rpc)
    response = client.get("/api/testnet/status")
    assert response.status_code == 200
    body = response.json()
    assert body["ok"] is True
    assert body["chain_id"] == 57001
    assert body["block_number"] == 4660


def test_wallet_inspect(monkeypatch):
    def fake_rpc(chain, method, params):
        return {"eth_chainId": "0xdea9", "eth_blockNumber": "0x20", "eth_getBalance": "0xde0b6b3a7640000"}[method]

    monkeypatch.setattr(main, "rpc_call", fake_rpc)
    response = client.post("/api/wallet/inspect", json={"address": "0x3e46DE6fDe4565e999fBa1EB72e027E2894823B8", "chain": "arc-testnet"})
    assert response.status_code == 200
    body = response.json()
    assert body["chain_id"] == 57001
    assert body["block_number"] == 32
    assert body["balance_native"] == 1.0


def test_create_test_proposal():
    response = client.post("/api/tx/proposal", json={"proposal_id": "pytest-test-proposal", "chain": "arc-testnet", "to": "0x3e46DE6fDe4565e999fBa1EB72e027E2894823B8", "value_wei": "0", "data": "0x", "purpose": "pytest frontend integration"})
    assert response.status_code == 200
    proposal = response.json()["proposal"]
    assert proposal["status"] == "PENDING_APPROVAL"
    assert proposal["approval_required"] is True
    assert proposal["risk_level"] == "LOW"


def test_opportunity_board():
    response = client.get("/api/opportunities")
    assert response.status_code == 200
    items = response.json()["items"]
    assert items
    assert items[0]["opportunity_score"] >= items[-1]["opportunity_score"]
    assert "tasks" in items[0]
    assert "eligibility" in items[0]


def test_opportunity_filter():
    response = client.get("/api/opportunities", params={"category": "testnet", "max_cost": 0})
    assert response.status_code == 200
    items = response.json()["items"]
    assert all(item["category"] == "testnet" and item["estimated_cost"] == 0 for item in items)
