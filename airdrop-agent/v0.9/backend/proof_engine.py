from __future__ import annotations

import hashlib
import json
import time
import uuid
from pathlib import Path
from typing import Any

DATA_DIR = Path(__file__).resolve().parent / "data"
PROOF_FILE = DATA_DIR / "task_proofs.jsonl"
REWARD_FILE = DATA_DIR / "reward_events.jsonl"


def _append(path: Path, record: dict[str, Any]) -> dict[str, Any]:
    path.parent.mkdir(exist_ok=True)
    with path.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(record, ensure_ascii=False) + "\n")
    return record


def _read(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        return []
    rows: list[dict[str, Any]] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        try:
            value = json.loads(line)
            if isinstance(value, dict):
                rows.append(value)
        except json.JSONDecodeError:
            continue
    return rows


def evidence_digest(payload: Any) -> str:
    encoded = json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode()
    return hashlib.sha256(encoded).hexdigest()


def record_proof(opportunity_id: str, task_id: str, kind: str, payload: dict[str, Any] | None = None,
                 status: str = "RECORDED") -> dict[str, Any]:
    evidence = payload or {}
    record = {
        "proof_id": f"proof-{uuid.uuid4().hex[:12]}",
        "opportunity_id": opportunity_id,
        "task_id": task_id,
        "kind": kind.upper(),
        "status": status.upper(),
        "created_at": int(time.time()),
        "digest": evidence_digest(evidence),
        "evidence": evidence,
    }
    return _append(PROOF_FILE, record)


def task_proofs(opportunity_id: str, task_id: str | None = None) -> list[dict[str, Any]]:
    rows = [x for x in _read(PROOF_FILE) if x.get("opportunity_id") == opportunity_id]
    if task_id:
        rows = [x for x in rows if x.get("task_id") == task_id]
    return rows


def record_reward_event(opportunity_id: str, task_id: str | None, event_type: str,
                        amount: str = "", asset: str = "", tx_hash: str = "",
                        note: str = "") -> dict[str, Any]:
    record = {
        "event_id": f"reward-{uuid.uuid4().hex[:12]}",
        "opportunity_id": opportunity_id,
        "task_id": task_id,
        "event_type": event_type.upper(),
        "amount": str(amount),
        "asset": str(asset),
        "tx_hash": str(tx_hash),
        "note": str(note),
        "created_at": int(time.time()),
    }
    return _append(REWARD_FILE, record)


def reward_events(opportunity_id: str) -> list[dict[str, Any]]:
    return [x for x in _read(REWARD_FILE) if x.get("opportunity_id") == opportunity_id]


def build_proof_summary(opportunity_id: str) -> dict[str, Any]:
    proofs = task_proofs(opportunity_id)
    rewards = reward_events(opportunity_id)
    return {
        "opportunity_id": opportunity_id,
        "proof_count": len(proofs),
        "verified_count": sum(1 for x in proofs if x.get("status") == "VERIFIED"),
        "pending_count": sum(1 for x in proofs if x.get("status") == "PENDING"),
        "reward_event_count": len(rewards),
        "proofs": proofs,
        "rewards": rewards,
    }
