from __future__ import annotations

import json
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from .analytics_engine import summarize
from .monitoring_scheduler_service import MonitoringSchedulerService
from .opportunity_engine import get_opportunity, list_opportunities
from .opportunity_sources import discover_live_opportunities
from .reward_engine import RewardStatus, make_history_event, make_reward_record, validate_reward_transition
from .task_engine import TaskStatus, build_task_plan, validate_proof, validate_transition
from .transaction_guard import make_proposal
from .wallet_adapter import CHAINS, normalize_address, wallet_status

app = FastAPI(title="ARC AI HUB Airdrop Agent v0.9", version="0.9.1")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])
DATA = Path(__file__).resolve().parent / "data"
DATA.mkdir(exist_ok=True)
TX_FILE = DATA / "tx_proposals.json"
OPP_FILE = DATA / "opportunities.json"
SOURCE_FILE = DATA / "source_status.json"
TASK_FILE = DATA / "task_state.json"
REWARD_FILE = DATA / "reward_state.json"
HISTORY_FILE = DATA / "history.json"
SCHEDULER_FILE = DATA / "scheduler_state.json"


def load_json(path: Path, default):
    if not path.exists(): return default
    try: return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError): return default


def save_json(path: Path, value): path.write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding="utf-8")


def load_tx(): return load_json(TX_FILE, [])
def save_tx(items): save_json(TX_FILE, items)
def load_live_opportunities(): return load_json(OPP_FILE, [])


def refresh_live_sources():
    items, status = discover_live_opportunities()
    if items: save_json(OPP_FILE, items)
    save_json(SOURCE_FILE, status)
    return items, status


def rpc_call(chain: str, method: str, params: list):
    config = CHAINS.get(chain)
    if config is None: raise KeyError(f"Unsupported chain: {chain}")
    payload = json.dumps({"jsonrpc": "2.0", "id": 1, "method": method, "params": params}).encode()
    request = urllib.request.Request(config.rpc_url, data=payload, headers={"Content-Type": "application/json", "User-Agent": "ARC-AI-HUB/0.9"}, method="POST")
    with urllib.request.urlopen(request, timeout=8) as response: body = json.loads(response.read().decode("utf-8"))
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
class TaskPlanRequest(BaseModel):
    opportunity_id: str
    wallet_connected: bool = False
class TaskTransitionRequest(BaseModel):
    opportunity_id: str
    task_id: str
    target_status: str
class ProofRequest(BaseModel):
    opportunity_id: str
    task_id: str
    proof_type: str
    value: str
class RewardRequest(BaseModel):
    opportunity_id: str
    status: str
    amount: str = ""
    token: str = ""
    claim_url: str = ""
    tx_hash: str = ""
    notes: str = ""
class RewardTransitionRequest(BaseModel):
    opportunity_id: str
    target_status: str
class SchedulerConfigRequest(BaseModel):
    interval_minutes: int | None = Field(default=None, ge=5)
    enabled: bool | None = None


def opportunity_for(opportunity_id: str) -> dict:
    item = next((x for x in load_live_opportunities() if x.get("id") == opportunity_id), None) or get_opportunity(opportunity_id)
    if item is None: raise HTTPException(404, "Opportunity not found")
    return item


def _scheduler_state():
    return load_json(SCHEDULER_FILE, {"interval_minutes": 60, "enabled": True, "last_run": None, "last_result": None})


def _persist_scheduler(service: MonitoringSchedulerService):
    save_json(SCHEDULER_FILE, {"interval_minutes": service.config.interval_minutes, "enabled": service.config.enabled, "last_run": service.last_run, "last_result": service.last_result})


def _build_scheduler():
    state = _scheduler_state()
    service = MonitoringSchedulerService(refresh=refresh_live_sources, interval_minutes=state.get("interval_minutes", 60), enabled=state.get("enabled", True))
    service.last_run = state.get("last_run")
    service.last_result = state.get("last_result")
    return service


@app.get("/api/health")
def health(): return {"ok": True, "version": "0.9.1", "mode": "approval-only"}

@app.get("/api/wallet/chains")
def chains(): return {"chains": [c.__dict__ for c in CHAINS.values()]}

@app.post("/api/wallet/validate")
def validate_wallet(req: WalletRequest):
    try: return {"ok": True, **wallet_status(req.address, req.chains)}
    except (ValueError, KeyError) as e: raise HTTPException(400, str(e))

@app.post("/api/wallet/inspect")
def inspect_wallet(req: WalletInspectRequest):
    try:
        address = normalize_address(req.address); chain = req.chain.strip().lower()
        block_hex = rpc_call(chain, "eth_blockNumber", []); balance_hex = rpc_call(chain, "eth_getBalance", [address, "latest"]); chain_id_hex = rpc_call(chain, "eth_chainId", [])
        balance_wei = int(balance_hex, 16)
        return {"ok": True, "address": address, "chain": chain, "chain_id": int(chain_id_hex, 16), "block_number": int(block_hex, 16), "balance_wei": str(balance_wei), "balance_native": balance_wei / 10**18}
    except (ValueError, KeyError) as e: raise HTTPException(400, str(e))
    except (urllib.error.URLError, TimeoutError, OSError, RuntimeError, json.JSONDecodeError) as e: raise HTTPException(502, f"RPC unavailable: {e}")

@app.get("/api/testnet/status")
def testnet_status():
    try:
        chain_id_hex = rpc_call("arc-testnet", "eth_chainId", []); block_hex = rpc_call("arc-testnet", "eth_blockNumber", []); actual = int(chain_id_hex, 16); expected = CHAINS["arc-testnet"].chain_id
        return {"ok": actual == expected, "network": CHAINS["arc-testnet"].name, "chain_id": actual, "expected_chain_id": expected, "block_number": int(block_hex, 16), "rpc": CHAINS["arc-testnet"].rpc_url}
    except (KeyError, urllib.error.URLError, TimeoutError, OSError, RuntimeError, json.JSONDecodeError) as e: raise HTTPException(502, f"Testnet RPC unavailable: {e}")

@app.get("/api/opportunities")
def opportunities(category: str | None = Query(default=None), chain: str | None = Query(default=None), max_cost: float | None = Query(default=None, ge=0)):
    live = load_live_opportunities()
    if not live: live, _ = refresh_live_sources()
    items = live + list_opportunities(category=None, chain=None, max_cost=None)
    unique = {item.get("id"): item for item in items if item.get("id")}
    items = list(unique.values())
    if category: items = [x for x in items if x.get("category") == category]
    if chain: items = [x for x in items if x.get("chain") == chain]
    if max_cost is not None: items = [x for x in items if float(x.get("estimated_cost", 0)) <= max_cost]
    return {"items": sorted(items, key=lambda x: x.get("opportunity_score", 0), reverse=True)}

@app.post("/api/opportunities/refresh")
def refresh_opportunities():
    items, status = refresh_live_sources()
    return {"ok": bool(items), "count": len(items), "sources": status, "items": items}

@app.get("/api/opportunities/sources")
def opportunity_sources(): return {"sources": load_json(SOURCE_FILE, {"cryptorank": "not_run", "incrypted": "not_run", "errors": []})}

@app.get("/api/opportunities/{opportunity_id}")
def opportunity(opportunity_id: str): return {"opportunity": opportunity_for(opportunity_id)}

@app.get("/api/monitoring")
def monitoring():
    service = _build_scheduler()
    return {"ok": True, "monitoring": service.monitor(load_live_opportunities()), "scheduler": service.status()}

@app.post("/api/monitoring/run")
def monitoring_run():
    service = _build_scheduler()
    items = load_live_opportunities()
    result = service.monitor(items)
    return {"ok": True, "monitoring": result}

@app.get("/api/scheduler/status")
def scheduler_status(): return {"ok": True, "scheduler": _build_scheduler().status()}

@app.post("/api/scheduler/configure")
def scheduler_configure(req: SchedulerConfigRequest):
    service = _build_scheduler()
    try: status = service.configure(req.interval_minutes, req.enabled)
    except ValueError as e: raise HTTPException(400, str(e))
    _persist_scheduler(service)
    return {"ok": True, "scheduler": status}

@app.post("/api/scheduler/run")
def scheduler_run():
    service = _build_scheduler()
    result = service.run_if_due()
    _persist_scheduler(service)
    return {"ok": True, **result}

@app.post("/api/tasks/plan")
def task_plan(req: TaskPlanRequest):
    item = opportunity_for(req.opportunity_id); plan = build_task_plan(item, req.wallet_connected)
    state = load_json(TASK_FILE, {}); state[req.opportunity_id] = {"tasks": plan}; save_json(TASK_FILE, state)
    return {"ok": True, "opportunity_id": req.opportunity_id, "tasks": plan, "safety": "approval-only"}

@app.get("/api/tasks/{opportunity_id}")
def get_task_plan(opportunity_id: str):
    state = load_json(TASK_FILE, {})
    if opportunity_id in state: return {"opportunity_id": opportunity_id, **state[opportunity_id]}
    return {"opportunity_id": opportunity_id, "tasks": build_task_plan(opportunity_for(opportunity_id))}

@app.post("/api/tasks/transition")
def transition_task(req: TaskTransitionRequest):
    state = load_json(TASK_FILE, {}); record = state.get(req.opportunity_id)
    if not record: raise HTTPException(404, "Task plan not found; call /api/tasks/plan first")
    task = next((t for t in record["tasks"] if t["id"] == req.task_id), None)
    if task is None: raise HTTPException(404, "Task not found")
    current = task.get("status", TaskStatus.PENDING.value); target = req.target_status.upper(); ok, reason = validate_transition(current, target)
    if not ok: raise HTTPException(409, reason)
    if target == TaskStatus.COMPLETED.value and task.get("approval_required") and current != TaskStatus.APPROVED.value: raise HTTPException(403, "Explicit approval required before completion")
    task["status"] = target; save_json(TASK_FILE, state)
    return {"ok": True, "task": task}

@app.post("/api/tasks/proof")
def add_proof(req: ProofRequest):
    ok, reason = validate_proof(req.proof_type, req.value)
    if not ok: raise HTTPException(400, reason)
    state = load_json(TASK_FILE, {}); record = state.get(req.opportunity_id)
    if not record: raise HTTPException(404, "Task plan not found")
    task = next((t for t in record["tasks"] if t["id"] == req.task_id), None)
    if task is None: raise HTTPException(404, "Task not found")
    task["proof"] = {"type": req.proof_type, "value": req.value.strip(), "status": "RECORDED"}; save_json(TASK_FILE, state)
    history = load_json(HISTORY_FILE, []); history.insert(0, make_history_event("PROOF_RECORDED", req.opportunity_id, {"task_id": req.task_id, "proof_type": req.proof_type})); save_json(HISTORY_FILE, history[:500])
    return {"ok": True, "task": task, "submission": "manual"}

@app.post("/api/rewards")
def create_or_update_reward(req: RewardRequest):
    item = opportunity_for(req.opportunity_id)
    try: RewardStatus(req.status.upper())
    except ValueError: raise HTTPException(400, "Unsupported reward status")
    rewards = load_json(REWARD_FILE, {}); existing = rewards.get(req.opportunity_id)
    if existing:
        current = existing.get("status", RewardStatus.UNKNOWN.value); ok, reason = validate_reward_transition(current, req.status.upper())
        if not ok and current != req.status.upper(): raise HTTPException(409, reason)
        record = existing; record.update({"status": req.status.upper(), "amount": req.amount, "token": req.token, "claim_url": req.claim_url, "tx_hash": req.tx_hash, "notes": req.notes, "updated_at": datetime.now(timezone.utc).isoformat()})
    else:
        record = make_reward_record(item, req.status.upper()).as_dict(); record.update({"amount": req.amount, "token": req.token, "claim_url": req.claim_url, "tx_hash": req.tx_hash, "notes": req.notes})
    rewards[req.opportunity_id] = record; save_json(REWARD_FILE, rewards)
    history = load_json(HISTORY_FILE, []); history.insert(0, make_history_event("REWARD_STATUS_CHANGED", req.opportunity_id, {"status": record["status"], "amount": record.get("amount", ""), "token": record.get("token", "")})); save_json(HISTORY_FILE, history[:500])
    return {"ok": True, "reward": record}

@app.get("/api/rewards")
def rewards(): return {"items": list(load_json(REWARD_FILE, {}).values())}
@app.get("/api/rewards/{opportunity_id}")
def reward(opportunity_id: str):
    record = load_json(REWARD_FILE, {}).get(opportunity_id)
    if record is None: raise HTTPException(404, "Reward record not found")
    return {"reward": record}
@app.post("/api/rewards/transition")
def transition_reward(req: RewardTransitionRequest):
    rewards = load_json(REWARD_FILE, {}); record = rewards.get(req.opportunity_id)
    if record is None: raise HTTPException(404, "Reward record not found")
    target = req.target_status.upper(); current = record.get("status", RewardStatus.UNKNOWN.value); ok, reason = validate_reward_transition(current, target)
    if not ok: raise HTTPException(409, reason)
    record["status"] = target; record["updated_at"] = datetime.now(timezone.utc).isoformat(); save_json(REWARD_FILE, rewards)
    history = load_json(HISTORY_FILE, []); history.insert(0, make_history_event("REWARD_STATUS_CHANGED", req.opportunity_id, {"from": current, "to": target})); save_json(HISTORY_FILE, history[:500])
    return {"ok": True, "reward": record}

@app.get("/api/history")
def history(limit: int = Query(default=50, ge=1, le=500), opportunity_id: str | None = None):
    items = load_json(HISTORY_FILE, [])
    if opportunity_id: items = [x for x in items if x.get("opportunity_id") == opportunity_id]
    return {"items": items[:limit]}

@app.get("/api/analytics")
def analytics(): return {"ok": True, "summary": summarize(load_live_opportunities(), load_json(TASK_FILE, {}), load_json(REWARD_FILE, {}))}

@app.post("/api/tx/proposal")
def create_proposal(req: TxRequest):
    try: proposal = make_proposal(req.proposal_id, req.chain, req.to, req.value_wei, req.data, req.purpose)
    except (ValueError, KeyError) as e: raise HTTPException(400, str(e))
    items = [x for x in load_tx() if x.get("proposal_id") != proposal.proposal_id]; items.insert(0, proposal.as_dict()); save_tx(items)
    return {"ok": True, "proposal": proposal.as_dict()}
@app.get("/api/tx/proposals")
def proposals(): return {"items": load_tx()}
@app.get("/api/tx/proposal/{proposal_id}")
def proposal(proposal_id: str):
    for item in load_tx():
        if item.get("proposal_id") == proposal_id: return {"proposal": item}
    raise HTTPException(404, "Proposal not found")
@app.get("/api/demo/testnet")
def demo_testnet(): return {"network": "ARC Testnet", "chain_id": 57001, "rpc": "https://rpc.testnet.arc.network", "explorer": "https://testnet.arcscan.app", "status": "ready"}
