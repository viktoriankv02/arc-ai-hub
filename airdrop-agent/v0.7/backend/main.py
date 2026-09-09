from contextlib import asynccontextmanager
from datetime import datetime, timezone
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from . import db
from .models import *
from .pipeline import enrich, canonical_url
from .orchestrator import build_queue
from .scheduler import SchedulerService


def seed_demo():
    return [
        Opportunity(id="tempo-superboard", project="Tempo Superboard", category=Category.TESTNET, chain="Tempo", reward="Points / potential future rewards", source="INCRYPTED", official_url="https://tempo.xyz/", estimated_time=35, risk_score=18, source_confidence=82, opportunity_score=82, tasks=[Task(id="tempo-discord", title="Join project Discord", type=TaskType.JOIN_DISCORD, time_minutes=5, approval_required=True), Task(id="tempo-research", title="Read official campaign rules", type=TaskType.INFORMATIONAL, time_minutes=10)]),
        Opportunity(id="overlayer-testnet", project="Overlayer", category=Category.TESTNET, chain="Ethereum", reward="Points / potential token allocation", source="INCRYPTED", official_url="https://overlayer.io/", estimated_time=45, risk_score=25, source_confidence=80, opportunity_score=78, tasks=[Task(id="overlayer-wallet", title="Connect wallet", type=TaskType.CONNECT_WALLET, approval_required=True), Task(id="overlayer-manual", title="Complete manual campaign steps", type=TaskType.MANUAL, time_minutes=30, approval_required=True)]),
        Opportunity(id="example-points", project="Example Points Program", category=Category.POINTS, chain="Ethereum", reward="Points", source="DEMO", official_url="https://example.com/", estimated_cost=2, estimated_time=20, risk_score=35, source_confidence=55, opportunity_score=54, tasks=[Task(id="points-swap", title="Example swap", type=TaskType.SWAP, cost_usd=2, time_minutes=10, approval_required=True)])
    ]


def notify(title, message, level="INFO", data=None):
    db.append_record("notifications", {"title": title, "message": message, "level": level, "data": data or {}, "created_at": datetime.now(timezone.utc).isoformat(), "read": False})


async def scheduled_scan():
    results = {}
    try:
        from .sources.incrypted import discover
        from .normalizer import from_incrypted
        raw = await discover("TESTNET")
        for item in raw:
            db.save_opportunity(enrich(from_incrypted(item)))
        results["INCRYPTED_TESTNET"] = len(raw)
    except Exception as exc:
        results["INCRYPTED_error"] = str(exc)
    notify("Scheduled scan complete", "Opportunity monitoring finished.", "INFO", results)
    return results


scheduler_service = None


@asynccontextmanager
async def lifespan(app):
    global scheduler_service
    db.init_db()
    if not db.list_opportunities():
        for op in seed_demo():
            db.save_opportunity(enrich(op))
    scheduler_service = SchedulerService(scheduled_scan)
    yield
    if scheduler_service is not None:
        await scheduler_service.stop()


app = FastAPI(title="ARC AI HUB — Airdrop Agent", version="0.7.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


@app.get("/health")
def health():
    return {"ok": True, "version": "0.7.0"}


@app.get("/api/opportunities")
def opportunities():
    items = [enrich(o) for o in db.list_opportunities()]
    items.sort(key=lambda x: x.final_score, reverse=True)
    for o in items:
        db.save_opportunity(o)
    return items


@app.get("/api/opportunities/{oid}")
def opportunity(oid: str):
    op = db.get_opportunity(oid)
    if not op:
        raise HTTPException(404, "Opportunity not found")
    return enrich(op)


@app.get("/api/profile")
def profile():
    return db.get_wallet()


@app.post("/api/profile")
def profile_save(x: WalletProfile):
    db.save_wallet(x)
    return x


@app.get("/api/eligibility/{oid}")
def eligibility(oid: str):
    op = db.get_opportunity(oid)
    if not op:
        raise HTTPException(404, "Opportunity not found")
    w = db.get_wallet()
    reasons = []
    if not w:
        reasons.append("Wallet profile is not configured")
    else:
        if op.chain and op.chain not in w.chains:
            reasons.append(f"Required chain not configured: {op.chain}")
        if w.balance_usd < op.estimated_cost:
            reasons.append("Declared balance is below estimated cost")
        if op.estimated_cost > w.capital_limit:
            reasons.append("Opportunity exceeds capital limit")
    return {"eligible": not reasons, "reasons": reasons or ["No blocking rule detected"]}


@app.post("/api/task-status")
def task_status(x: TaskStatusUpdate):
    db.set_task_status(x.opportunity_id, x.task_id, x.status)
    return {"ok": True}


@app.post("/api/approval")
def approval(x: ApprovalRequest):
    db.append_record("approvals", x.model_dump())
    return {"ok": True, "recorded": True}


@app.post("/api/proof")
def proof(x: ProofEvent):
    db.append_record("proofs", x.model_dump())
    return {"ok": True, "recorded": True}


@app.get("/api/proofs")
def proofs():
    return db.list_records("proofs")


@app.post("/api/reward")
def reward(x: RewardEvent):
    db.append_record("rewards", x.model_dump())
    return {"ok": True, "recorded": True}


@app.get("/api/rewards")
def rewards():
    return db.list_records("rewards")


@app.get("/api/queue")
def queue(limit: int = 20):
    items = [enrich(o) for o in db.list_opportunities()]
    q = build_queue(items, limit)
    db.save_queue(q)
    return {"count": len(q), "items": q}


@app.post("/api/orchestrator/run")
def orchestrator_run(limit: int = 20):
    items = [enrich(o) for o in db.list_opportunities()]
    q = build_queue(items, limit)
    db.save_queue(q)
    notify("Task queue rebuilt", f"{len(q)} actionable tasks queued.", "INFO", {"count": len(q)})
    return {"ok": True, "count": len(q), "items": q}


@app.get("/api/scheduler/status")
def scheduler_status():
    return scheduler_service.status() if scheduler_service else {"initialized": False, "running": False}


@app.post("/api/scheduler/start")
def scheduler_start():
    if not scheduler_service:
        raise HTTPException(503, "Scheduler not initialized")
    scheduler_service.start()
    notify("Scheduler started", "Automatic monitoring is active.")
    return scheduler_service.status()


@app.post("/api/scheduler/stop")
async def scheduler_stop():
    if not scheduler_service:
        raise HTTPException(503, "Scheduler not initialized")
    await scheduler_service.stop()
    notify("Scheduler stopped", "Automatic monitoring is paused.")
    return scheduler_service.status()


@app.get("/api/notifications")
def notifications():
    items = db.list_records("notifications")
    return {"unread": sum(1 for x in items if not x.get("read")), "items": items}


@app.post("/api/notifications/read/{notification_id}")
def notification_read(notification_id: int):
    items = db.list_records("notifications")
    for idx, item in enumerate(items):
        if idx + 1 == notification_id:
            item["read"] = True
            db.append_record("notifications", item)
            return item
    raise HTTPException(404, "Notification not found")


@app.post("/api/dedupe")
def dedupe():
    items = db.list_opportunities()
    seen = {}
    duplicates = []
    for op in items:
        key = canonical_url(op.official_url)
        if key and key in seen:
            duplicates.append({"duplicate": op.id, "canonical": seen[key], "url": key})
        elif key:
            seen[key] = op.id
    return {"ok": True, "duplicate_count": len(duplicates), "duplicates": duplicates}


@app.get("/api/evidence/{oid}")
def evidence(oid: str):
    op = db.get_opportunity(oid)
    if not op:
        raise HTTPException(404, "Opportunity not found")
    return enrich(op).provenance.model_dump()


@app.get("/api/top")
def top(limit: int = 10):
    items = [enrich(o) for o in db.list_opportunities() if o.risk_verdict != "BLOCK"]
    items.sort(key=lambda x: x.final_score, reverse=True)
    return {"count": len(items), "items": [{"id": o.id, "project": o.project, "final_score": o.final_score, "priority": o.priority, "source": o.source, "risk": o.risk_score, "freshness": o.freshness_score} for o in items[:max(1, min(limit, 50))]}


@app.post("/api/ingest/incrypted")
async def ingest_incrypted(category: str = "TESTNET"):
    from .sources.incrypted import discover
    from .normalizer import from_incrypted
    try:
        raw = await discover(category)
    except Exception as exc:
        raise HTTPException(502, f"INCRYPTED request failed: {exc}")
    for item in raw:
        db.save_opportunity(enrich(from_incrypted(item)))
    return {"ok": True, "source": "INCRYPTED", "saved": len(raw), "category": category.upper()}


@app.post("/api/ingest/cryptorank")
async def ingest_cryptorank(status: str | None = None, reward: str | None = None, limit: int = 100, skip: int = 0):
    from .sources.cryptorank import fetch_activities
    from .normalizer import from_cryptorank
    try:
        payload = await fetch_activities(status=status, reward=reward, limit=limit, skip=skip)
    except Exception as exc:
        raise HTTPException(502, f"CryptoRank request failed: {exc}")
    raw = payload.get("data", payload)
    if isinstance(raw, dict):
        raw = raw.get("data", [])
    if not isinstance(raw, list):
        raw = []
    for item in raw:
        if isinstance(item, dict):
            db.save_opportunity(enrich(from_cryptorank(item)))
    return {"ok": True, "source": "CryptoRank", "saved": len(raw)}


@app.post("/api/refresh")
async def refresh():
    return await scheduled_scan()
