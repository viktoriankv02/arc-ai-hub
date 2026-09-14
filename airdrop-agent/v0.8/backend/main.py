from __future__ import annotations

import json
import urllib.error
import urllib.request
from pathlib import Path

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from .opportunity_engine import get_opportunity, list_opportunities
from .opportunity_sources import discover_live_opportunities
from .wallet_adapter import CHAINS, normalize_address, wallet_status
from .transaction_guard import make_proposal

app = FastAPI(title="ARC AI HUB Airdrop Agent v0.9", version="0.9.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

DATA = Path(__file__).resolve().parent / "data"
DATA.mkdir(exist_ok=True)
TX_FILE = DATA / "tx_proposals.json"
OPP_FILE = DATA / "opportunities.json"
SOURCE_FILE = DATA / "source_status.json"


def load_tx():
    if not TX_FILE.exists(): return []
    try: return json.loads(TX_FILE.read_text(encoding="utf-8"))
    except Exception: return []


def save_tx(items):
    TX_FILE.write_text(json.dumps(items, ensure_ascii=False, indent=2), encoding="utf-8")


def load_live_opportunities():
    if not OPP_FILE.exists(): return []
    try:
        value = json.loads(OPP_FILE.read_text(encoding="utf-8"))
        return value if isinstance(value, list) else []
    except (OSError, json.JSONDecodeError): return []


def save_source_status(value):
    SOURCE_FILE.write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding="utf-8")


def rpc_call(chain: str, method: str, params: list):
    config = CHAINS.get(chain)
    if config is None: raise KeyError(f"Unsupported chain: {chain}")
    payload = json.dumps({"jsonrpc": "2.0", "id": 1, "method": method, "params": params}).encode()
    request = urllib.request.Request(config.rpc_url, data=payload, headers={"Content-Type": "application/json", "User-Agent": "ARC-AI-HUB/0.9"}, method="POST")
    with urllib.request.urlopen(request, timeout=8) as response:
        body = json.loads(response.read().decode("utf-8"))
    if "error" in body: raise RuntimeError(body["error"].get("message", "RPC error"))
    return body.get("result")


class WalletRequest(BaseModel):
    address: str
    chains: list[str] = Field(default_factory=lambda: ["arc-testnet"])

class WalletInspectRequest(BaseModel):
    address: str
    chain: str = "arc-testnet"

class TxRequest(BaseModel):
    proposal_id: str
    chain: str
    to: str
    value_wei: str = "0"
    data: str = "0x"
    purpose: str = ""


@app.get("/api/health")
def health():
    return {"ok": True, "version": "0.9.0", "mode": "approval-only"}

@app.get("/api/wallet/chains")
def chains():
    return {"chains": [c.__dict__ for c in CHAINS.values()]}

@app.post("/api/wallet/validate")
def validate_wallet(req: WalletRequest):
    try: return {"ok": True, **wallet_status(req.address, req.chains)}
    except (ValueError, KeyError) as e: raise HTTPException(400, str(e))

@app.post("/api/wallet/inspect")
def inspect_wallet(req: WalletInspectRequest):
    try:
        address = normalize_address(req.address)
        chain = req.chain.strip().lower()
        block_hex = rpc_call(chain, "eth_blockNumber", [])
        balance_hex = rpc_call(chain, "eth_getBalance", [address, "latest"])
        chain_id_hex = rpc_call(chain, "eth_chainId", [])
        balance_wei = int(balance_hex, 16)
        return {"ok": True, "address": address, "chain": chain, "chain_id": int(chain_id_hex, 16), "block_number": int(block_hex, 16), "balance_wei": str(balance_wei), "balance_native": balance_wei / 10**18}
    except (ValueError, KeyError) as e: raise HTTPException(400, str(e))
    except (urllib.error.URLError, TimeoutError, OSError, RuntimeError, json.JSONDecodeError) as e: raise HTTPException(502, f"RPC unavailable: {e}")

@app.get("/api/testnet/status")
def testnet_status():
    try:
        chain_id_hex = rpc_call("arc-testnet", "eth_chainId", [])
        block_hex = rpc_call("arc-testnet", "eth_blockNumber", [])
        actual = int(chain_id_hex, 16)
        expected = CHAINS["arc-testnet"].chain_id
        return {"ok": actual == expected, "network": CHAINS["arc-testnet"].name, "chain_id": actual, "expected_chain_id": expected, "block_number": int(block_hex, 16), "rpc": CHAINS["arc-testnet"].rpc_url}
    except (KeyError, urllib.error.URLError, TimeoutError, OSError, RuntimeError, json.JSONDecodeError) as e:
        raise HTTPException(502, f"Testnet RPC unavailable: {e}")

@app.get("/api/opportunities")
def opportunities(category: str | None = Query(default=None), chain: str | None = Query(default=None), max_cost: float | None = Query(default=None, ge=0)):
    items = load_live_opportunities() + list_opportunities(category=None, chain=None, max_cost=None)
    unique = {item.get("id"): item for item in items if item.get("id")}
    items = list(unique.values())
    if category: items = [x for x in items if x.get("category") == category]
    if chain: items = [x for x in items if x.get("chain") == chain]
    if max_cost is not None: items = [x for x in items if float(x.get("estimated_cost", 0)) <= max_cost]
    return {"items": sorted(items, key=lambda x: x.get("opportunity_score", 0), reverse=True)}

@app.post("/api/opportunities/refresh")
def refresh_opportunities():
    items, status = discover_live_opportunities()
    if items:
        OPP_FILE.write_text(json.dumps(items, ensure_ascii=False, indent=2), encoding="utf-8")
    save_source_status(status)
    return {"ok": bool(items), "count": len(items), "sources": status, "items": items}

@app.get("/api/opportunities/sources")
def opportunity_sources():
    if not SOURCE_FILE.exists(): return {"sources": {"cryptorank": "not_run", "incrypted": "not_run", "errors": []}}
    try: return {"sources": json.loads(SOURCE_FILE.read_text(encoding="utf-8"))}
    except (OSError, json.JSONDecodeError): return {"sources": {"errors": ["Invalid source status cache"]}}

@app.get("/api/opportunities/{opportunity_id}")
def opportunity(opportunity_id: str):
    item = next((x for x in load_live_opportunities() if x.get("id") == opportunity_id), None) or get_opportunity(opportunity_id)
    if item is None: raise HTTPException(404, "Opportunity not found")
    return {"opportunity": item}

@app.post("/api/tx/proposal")
def create_proposal(req: TxRequest):
    try: proposal = make_proposal(req.proposal_id, req.chain, req.to, req.value_wei, req.data, req.purpose)
    except (ValueError, KeyError) as e: raise HTTPException(400, str(e))
    items = [x for x in load_tx() if x.get("proposal_id") != proposal.proposal_id]
    items.insert(0, proposal.as_dict())
    save_tx(items)
    return {"ok": True, "proposal": proposal.as_dict()}

@app.get("/api/tx/proposals")
def proposals(): return {"items": load_tx()}

@app.get("/api/tx/proposal/{proposal_id}")
def proposal(proposal_id: str):
    for item in load_tx():
        if item.get("proposal_id") == proposal_id: return {"proposal": item}
    raise HTTPException(404, "Proposal not found")

@app.get("/api/demo/testnet")
def demo_testnet():
    return {"network": "ARC Testnet", "chain_id": 57001, "rpc": "https://rpc.testnet.arc.network", "explorer": "https://testnet.arcscan.app", "status": "ready"}
