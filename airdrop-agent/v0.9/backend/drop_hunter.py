from __future__ import annotations

import json
import os
import re
import time
import uuid
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any
from urllib.request import Request, urlopen

DATA_DIR = Path(__file__).resolve().parent / "data"
DATA_DIR.mkdir(exist_ok=True)
DB_FILE = DATA_DIR / "opportunities.json"
FEEDBACK_FILE = DATA_DIR / "agent_feedback.jsonl"

CRYPTORANK_URL = "https://api.cryptorank.io/v2/drophunting/activities"
INCRYPTED_AIRDROPS_URL = "https://incrypted.com/en/airdrops/"
INCRYPTED_TESTNETS_URL = "https://incrypted.com/en/airdrops/activity-testnet/"

TASK_TYPES: dict[str, str] = {
    "CHECK-IN": "CHECK_IN", "CHECKIN": "CHECK_IN", "CONTENT": "CREATE_CONTENT",
    "FOLLOW": "FOLLOW_X", "FOLLOW_X": "FOLLOW_X", "SOCIAL": "SOCIAL_ACTION",
    "DISCORD": "JOIN_DISCORD", "TELEGRAM": "JOIN_TELEGRAM", "BRIDGE": "BRIDGE",
    "SWAP": "SWAP", "STAKE": "STAKE", "NODE": "RUN_NODE", "DEPLOY": "DEPLOY_CONTRACT",
    "NFT": "MINT_NFT", "REFERRAL": "REFERRAL",
}

APPROVAL_REQUIRED = {
    "CHECK_IN", "FOLLOW_X", "SOCIAL_ACTION", "JOIN_DISCORD", "JOIN_TELEGRAM", "BRIDGE",
    "SWAP", "STAKE", "RUN_NODE", "DEPLOY_CONTRACT", "MINT_NFT", "CLAIM",
}

SAFE_AUTOMATION = {"CHECK_ELIGIBILITY", "OPEN_URL", "PARSE_TASKS", "CALCULATE_SCORE", "RECORD_PROOF", "REMINDER"}

@dataclass
class Task:
    id: str
    title: str
    type: str
    status: str = "TODO"
    cost: str = "0"
    time_minutes: int = 5
    url: str = ""
    description: str = ""
    approval_required: bool = True
    agent_can_prepare: bool = True
    agent_can_execute: bool = False
    proof: dict[str, Any] = field(default_factory=dict)

@dataclass
class Opportunity:
    id: str
    project: str
    category: str
    chain: str
    reward: str
    deadline: str
    source: str
    official_url: str
    estimated_cost: float
    estimated_time: int
    risk_score: int
    source_confidence: int
    strategic_value: int
    reward_potential: int
    opportunity_score: int
    eligibility: dict[str, Any] = field(default_factory=dict)
    tasks: list[Task] = field(default_factory=list)
    tags: list[str] = field(default_factory=list)
    status: str = "DISCOVERED"
    last_updated: int = field(default_factory=lambda: int(time.time()))
    analysis: str = ""

def _save(items: list[dict[str, Any]]) -> None:
    DB_FILE.write_text(json.dumps(items, ensure_ascii=False, indent=2), encoding="utf-8")

def _load() -> list[dict[str, Any]]:
    if not DB_FILE.exists(): return []
    try:
        raw = json.loads(DB_FILE.read_text(encoding="utf-8"))
        return raw if isinstance(raw, list) else []
    except Exception:
        return []

def _request_json(url: str, headers: dict[str, str] | None = None, timeout: int = 12) -> Any:
    req = Request(url, headers=headers or {"User-Agent": "ARC-AI-HUB-Drop-Hunter/0.9"})
    with urlopen(req, timeout=timeout) as response:
        return json.loads(response.read().decode("utf-8"))

def _request_html(url: str, timeout: int = 12) -> str:
    req = Request(url, headers={"User-Agent": "ARC-AI-HUB-Drop-Hunter/0.9"})
    with urlopen(req, timeout=timeout) as response:
        return response.read().decode("utf-8", errors="ignore")

def normalize_task(raw: dict[str, Any], index: int, opportunity_id: str) -> Task:
    raw_type = str(raw.get("type") or raw.get("title") or raw.get("name") or "MANUAL").strip().upper()
    task_type = TASK_TYPES.get(raw_type, "MANUAL")
    title = str(raw.get("title") or raw.get("name") or raw.get("type") or "Manual task").strip()
    cost = str(raw.get("cost") or "0")
    try: minutes = int(float(str(raw.get("timeMinutes") or raw.get("time_minutes") or 5)))
    except ValueError: minutes = 5
    url = str(raw.get("externalLink") or raw.get("url") or "")
    approval = task_type in APPROVAL_REQUIRED or task_type == "MANUAL"
    return Task(
        id=f"{opportunity_id}-t{index + 1}", title=title, type=task_type, cost=cost,
        time_minutes=max(1, minutes), url=url, description=str(raw.get("content") or ""),
        approval_required=approval, agent_can_prepare=True, agent_can_execute=task_type in SAFE_AUTOMATION,
    )

def opportunity_score(reward_potential: int, source_confidence: int, strategic_value: int, capital_required: float, time_minutes: int, risk_score: int) -> int:
    capital_penalty = min(18, int(capital_required * 2))
    time_penalty = min(15, max(0, time_minutes // 30))
    raw = reward_potential * 1.25 + source_confidence * 0.25 + strategic_value * 0.9 - capital_penalty - time_penalty - risk_score * 0.45
    return max(0, min(100, int(round(raw))))

def _score_from_cryptorank(item: dict[str, Any]) -> Opportunity:
    coin = item.get("coin") or {}; funds = coin.get("funds") or []; xscore = coin.get("xScore") or {}
    task_rows = item.get("tasks") or []; project = str(coin.get("name") or item.get("key") or "Unknown Project")
    symbol = str(coin.get("symbol") or ""); reward = str(item.get("reward") or "Unknown"); status = str(item.get("status") or "POTENTIAL")
    total_raise_raw = str(coin.get("totalRaise") or "0")
    try: total_raise = float(re.sub(r"[^0-9.]", "", total_raise_raw) or 0)
    except ValueError: total_raise = 0.0
    try: xs = float(str(xscore.get("score") or 0))
    except ValueError: xs = 0.0
    funding_points = min(20, int(total_raise / 10_000_000)); social_points = min(15, int(xs / 7))
    reward_points = 20 if reward.lower() in {"airdrop", "tokens", "points"} else 12
    source_confidence = 88; strategic_value = min(20, 8 + funding_points // 2)
    reward_potential = min(30, reward_points + funding_points // 2 + social_points // 3)
    risk_score = 35
    if not item.get("links", {}).get("claim") and not item.get("links", {}).get("verify"): risk_score += 8
    if total_raise <= 0: risk_score += 8
    if status == "INACTIVE": risk_score += 35
    costs: list[float] = []; times: list[int] = []; normalized_tasks: list[Task] = []
    opp_id = f"cr-{item.get('id') or uuid.uuid4().hex[:8]}"
    for idx, task in enumerate(task_rows):
        t = normalize_task(task, idx, opp_id); normalized_tasks.append(t)
        try: costs.append(float(re.sub(r"[^0-9.]", "", t.cost) or 0))
        except ValueError: costs.append(0.0)
        times.append(t.time_minutes)
    estimated_cost = round(sum(costs), 4); estimated_time = max(1, sum(times))
    chains = []
    for task in task_rows:
        for b in task.get("blockchains") or []:
            name = str(b.get("name") or "").strip()
            if name and name not in chains: chains.append(name)
    score = opportunity_score(reward_potential, source_confidence, strategic_value, estimated_cost, estimated_time, risk_score)
    return Opportunity(
        id=opp_id, project=project, category="AIR_DROP", chain=", ".join(chains) if chains else "Multi-chain",
        reward=f"{reward}{f' · {symbol}' if symbol else ''}", deadline="", source="CryptoRank",
        official_url=str((item.get("links") or {}).get("claim") or (item.get("links") or {}).get("verify") or "https://cryptorank.io/drophunting"),
        estimated_cost=estimated_cost, estimated_time=estimated_time, risk_score=min(100, risk_score),
        source_confidence=source_confidence, strategic_value=strategic_value, reward_potential=reward_potential,
        opportunity_score=score, eligibility={}, tasks=normalized_tasks,
        tags=[status, reward.upper(), "CRYPTORANK"] + ([symbol] if symbol else []),
        status="ACTIVE" if status != "INACTIVE" else "INACTIVE",
        analysis=f"CryptoRank: funding≈${total_raise:,.0f}; X score≈{xs:g}; {len(normalized_tasks)} tasks detected.",
    )

def _parse_incrypted_names(html: str) -> list[str]:
    patterns = [r'<(?:h2|h3)[^>]*>\s*(?:<[^>]+>\s*)?([^<]{2,80})\s*</(?:h2|h3)>', r'alt=["\']([^"\']{2,80})["\']']
    names: list[str] = []
    for pattern in patterns:
        for match in re.findall(pattern, html, flags=re.IGNORECASE):
            name = re.sub(r"\s+", " ", match).strip(" -\t\r\n")
            if 2 <= len(name) <= 80 and name not in names: names.append(name)
    blocked = {"Incrypted", "Airdrops", "Testnets", "Current", "Popular", "Previous", "Everything"}
    return [n for n in names if n not in blocked][:80]

def _incrypted_candidates() -> list[Opportunity]:
    found: list[Opportunity] = []
    for category, url in [("AIR_DROP", INCRYPTED_AIRDROPS_URL), ("TESTNET", INCRYPTED_TESTNETS_URL)]:
        try: html = _request_html(url)
        except Exception: continue
        for idx, name in enumerate(_parse_incrypted_names(html)):
            opp_id = f"ic-{re.sub(r'[^a-z0-9]+', '-', name.lower()).strip('-')[:42]}"
            reward_potential = 15 if category == "TESTNET" else 13; source_confidence = 76; risk_score = 44
            strategic_value = 14 if category == "TESTNET" else 10
            task = Task(id=f"{opp_id}-t1", title="Open source guide and extract tasks", type="PARSE_TASKS", time_minutes=2, url=url,
                        description="AI agent should parse the public activity page and prepare a task checklist.", approval_required=False, agent_can_execute=True)
            found.append(Opportunity(
                id=opp_id, project=name, category=category, chain="Unknown", reward="Unknown", deadline="", source="INCRYPTED",
                official_url=url, estimated_cost=0, estimated_time=2, risk_score=risk_score, source_confidence=source_confidence,
                strategic_value=strategic_value, reward_potential=reward_potential,
                opportunity_score=opportunity_score(reward_potential, source_confidence, strategic_value, 0, 2, risk_score),
                eligibility={}, tasks=[task], tags=["INCRYPTED", category], status="DISCOVERED",
                analysis="Discovered from the public INCRYPTED activity index. Official project verification is required before execution.",
            ))
            if idx >= 39: break
    return found

def as_dict(opp: Opportunity) -> dict[str, Any]:
    data = asdict(opp); data["tasks"] = [asdict(t) for t in opp.tasks]; return data

def seed_demo() -> list[dict[str, Any]]:
    if _load(): return _load()
    item = Opportunity(
        id="demo-arc-testnet", project="ARC Testnet (Demo Workspace)", category="TESTNET", chain="ARC Testnet",
        reward="Potential ecosystem rewards", deadline="monitor continuously", source="LOCAL DEMO", official_url="https://docs.arc.io/",
        estimated_cost=0, estimated_time=25, risk_score=28, source_confidence=65, strategic_value=20, reward_potential=21,
        opportunity_score=57, eligibility={"wallet": True, "testnet_activity": True},
        tasks=[
            Task("demo-arc-testnet-t1", "Check eligibility", "CHECK_ELIGIBILITY", time_minutes=1, approval_required=False, agent_can_execute=True),
            Task("demo-arc-testnet-t2", "Prepare testnet checklist", "PARSE_TASKS", time_minutes=2, approval_required=False, agent_can_execute=True),
            Task("demo-arc-testnet-t3", "Daily check-in", "CHECK_IN", time_minutes=1, url="https://docs.arc.io/", approval_required=True, agent_can_execute=False),
            Task("demo-arc-testnet-t4", "Prepare contract deployment", "DEPLOY_CONTRACT", time_minutes=15, approval_required=True, agent_can_execute=False),
        ], tags=["DEMO", "TESTNET", "ARC"], analysis="Demo record for UI development. It must not be treated as evidence of a live reward.")
    result = [as_dict(item)]; _save(result); return result

def scan_sources() -> dict[str, Any]:
    existing = {x.get("id"): x for x in _load()}; discovered: list[dict[str, Any]] = []; cryptorank_status = "not_configured"
    key = os.getenv("CRYPTORANK_API_KEY", "").strip()
    if key:
        try:
            data = _request_json(CRYPTORANK_URL + "?limit=100&sortBy=lastStatusUpdate&sortDirection=DESC", headers={"X-Api-Key": key, "User-Agent": "ARC-AI-HUB-Drop-Hunter/0.9"})
            rows = data.get("data", []) if isinstance(data, dict) else []
            for row in rows:
                opp = _score_from_cryptorank(row); existing[opp.id] = as_dict(opp); discovered.append(as_dict(opp))
            cryptorank_status = f"ok:{len(rows)}"
        except Exception as exc: cryptorank_status = f"error:{type(exc).__name__}"
    else: cryptorank_status = "missing_CRYPTO_RANK_API_KEY"
    for opp in _incrypted_candidates():
        existing[opp.id] = as_dict(opp); discovered.append(as_dict(opp))
    if not existing: seed_demo(); existing = {x.get("id"): x for x in _load()}
    items = sorted(existing.values(), key=lambda x: int(x.get("opportunity_score", 0)), reverse=True); _save(items)
    return {"items": items, "new": len(discovered), "cryptorank": cryptorank_status}

def get_opportunities(category: str | None = None, min_score: int = 0, status: str | None = None) -> list[dict[str, Any]]:
    items = _load() or seed_demo(); result = []
    for item in items:
        if category and str(item.get("category", "")).upper() != category.upper(): continue
        if int(item.get("opportunity_score", 0)) < min_score: continue
        if status and str(item.get("status", "")).upper() != status.upper(): continue
        result.append(item)
    return sorted(result, key=lambda x: int(x.get("opportunity_score", 0)), reverse=True)

def get_opportunity(opportunity_id: str) -> dict[str, Any] | None:
    return next((x for x in (_load() or seed_demo()) if x.get("id") == opportunity_id), None)

def analyze_opportunity(opportunity_id: str) -> dict[str, Any]:
    item = get_opportunity(opportunity_id)
    if not item: raise KeyError("Opportunity not found")
    tasks = item.get("tasks") or []; safe = sum(1 for t in tasks if t.get("type") in SAFE_AUTOMATION and t.get("agent_can_execute")); approvals = sum(1 for t in tasks if t.get("approval_required"))
    item["analysis"] = f"Score {item.get('opportunity_score', 0)}/100. {len(tasks)} task(s): {safe} can be automated safely; {approvals} require explicit user approval. Verify official domain before signing or spending. Never store seed phrases/private keys."
    item["status"] = "ANALYZED"; item["last_updated"] = int(time.time()); _persist_item(item); return item

def prepare_task(opportunity_id: str, task_id: str) -> dict[str, Any]:
    item = get_opportunity(opportunity_id)
    if not item: raise KeyError("Opportunity not found")
    for task in item.get("tasks") or []:
        if task.get("id") != task_id: continue
        task["status"] = "READY_FOR_APPROVAL" if task.get("approval_required") else "READY"
        task["proof"] = {"prepared_at": int(time.time()), "mode": "agent_prepare_only"}
        _persist_item(item)
        return {"ok": True, "task": task, "action": "APPROVAL_REQUIRED" if task.get("approval_required") else "SAFE_AUTOMATION", "message": "Prepared; approval required before authenticated, financial, wallet, or blockchain actions." if task.get("approval_required") else "Prepared for safe agent automation."}
    raise KeyError("Task not found")

def approve_task(opportunity_id: str, task_id: str, approved: bool) -> dict[str, Any]:
    item = get_opportunity(opportunity_id)
    if not item: raise KeyError("Opportunity not found")
    for task in item.get("tasks") or []:
        if task.get("id") != task_id: continue
        task["status"] = "APPROVED" if approved else "REJECTED"
        task["proof"] = {"decision_at": int(time.time()), "approved_by": "user"} if approved else {"decision_at": int(time.time()), "approved_by": "user"}
        _persist_item(item)
        return {"ok": True, "task": task, "executed": False, "next": "execution_adapter" if approved else None}
    raise KeyError("Task not found")

def record_feedback(opportunity_id: str, outcome: str, note: str = "") -> dict[str, Any]:
    row = {"timestamp": int(time.time()), "opportunity_id": opportunity_id, "outcome": outcome, "note": note[:2000]}
    with FEEDBACK_FILE.open("a", encoding="utf-8") as fh: fh.write(json.dumps(row, ensure_ascii=False) + "\n")
    return row

def _persist_item(item: dict[str, Any]) -> None:
    items = _load() or seed_demo()
    for idx, existing in enumerate(items):
        if existing.get("id") == item.get("id"): items[idx] = item; break
    else: items.append(item)
    _save(items)

def agent_catalog() -> list[dict[str, Any]]:
    return [
        {"id":"discovery-agent","name":"Discovery Agent","role":"Find projects, testnets, airdrops, quests and bounties from configured sources.","mode":"AUTO"},
        {"id":"research-agent","name":"Research & Risk Agent","role":"Normalize, score, estimate cost/time and flag risk or weak evidence.","mode":"AUTO"},
        {"id":"task-agent","name":"Task Planner Agent","role":"Turn project conditions into a deterministic checklist and proof plan.","mode":"AUTO"},
        {"id":"execution-agent","name":"Execution Agent","role":"Prepare browser/blockchain actions; execution stays behind explicit approval gates.","mode":"APPROVAL_GATE"},
        {"id":"learning-agent","name":"Learning & Memory Agent","role":"Store feedback and outcomes to improve future prioritization; no secret data is stored.","mode":"AUTO"},
    ]
