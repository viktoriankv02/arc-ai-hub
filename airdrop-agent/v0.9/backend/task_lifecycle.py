from __future__ import annotations

import json
import time
import uuid
from pathlib import Path
from typing import Any

DATA_DIR = Path(__file__).resolve().parent / "data"
EVENT_FILE = DATA_DIR / "task_lifecycle.jsonl"

STATES = {
    "DISCOVERED",
    "PREPARED",
    "APPROVED",
    "EXECUTING",
    "PROOF_PENDING",
    "VERIFIED",
    "REWARD_PENDING",
    "REWARDED",
    "FAILED",
    "BLOCKED",
}

TRANSITIONS = {
    "DISCOVERED": {"PREPARED", "BLOCKED"},
    "PREPARED": {"APPROVED", "BLOCKED", "FAILED"},
    "APPROVED": {"EXECUTING", "BLOCKED", "FAILED"},
    "EXECUTING": {"PROOF_PENDING", "FAILED", "BLOCKED"},
    "PROOF_PENDING": {"VERIFIED", "FAILED", "BLOCKED"},
    "VERIFIED": {"REWARD_PENDING", "REWARDED"},
    "REWARD_PENDING": {"REWARDED", "FAILED"},
    "FAILED": {"PREPARED", "EXECUTING", "BLOCKED"},
    "BLOCKED": {"PREPARED"},
    "REWARDED": set(),
}

MAX_RETRIES = 3


def _append(event: dict[str, Any]) -> dict[str, Any]:
    DATA_DIR.mkdir(exist_ok=True)
    with EVENT_FILE.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(event, ensure_ascii=False) + "\n")
    return event


def _read() -> list[dict[str, Any]]:
    if not EVENT_FILE.exists():
        return []
    rows: list[dict[str, Any]] = []
    for line in EVENT_FILE.read_text(encoding="utf-8").splitlines():
        try:
            value = json.loads(line)
            if isinstance(value, dict):
                rows.append(value)
        except json.JSONDecodeError:
            continue
    return rows


def lifecycle_events(opportunity_id: str, task_id: str | None = None) -> list[dict[str, Any]]:
    rows = [x for x in _read() if x.get("opportunity_id") == opportunity_id]
    if task_id:
        rows = [x for x in rows if x.get("task_id") == task_id]
    return rows


def current_state(opportunity_id: str, task_id: str) -> dict[str, Any]:
    rows = lifecycle_events(opportunity_id, task_id)
    if not rows:
        return {"opportunity_id": opportunity_id, "task_id": task_id, "state": "DISCOVERED", "attempts": 0}
    latest = rows[-1]
    return {
        "opportunity_id": opportunity_id,
        "task_id": task_id,
        "state": latest.get("to_state", "DISCOVERED"),
        "attempts": int(latest.get("attempts", 0)),
        "updated_at": latest.get("created_at"),
    }


def transition(opportunity_id: str, task_id: str, to_state: str, note: str = "", force: bool = False) -> dict[str, Any]:
    target = str(to_state).upper()
    if target not in STATES:
        raise ValueError(f"Unknown task state: {target}")
    before = current_state(opportunity_id, task_id)
    source = before["state"]
    allowed = target in TRANSITIONS.get(source, set())
    if not allowed and not force:
        raise ValueError(f"Invalid transition: {source} -> {target}")
    attempts = int(before.get("attempts", 0))
    if target == "EXECUTING" and source in {"APPROVED", "FAILED"}:
        attempts += 1
        if attempts > MAX_RETRIES:
            target = "BLOCKED"
            note = note or "Retry limit exceeded"
    event = {
        "event_id": f"life-{uuid.uuid4().hex[:12]}",
        "opportunity_id": opportunity_id,
        "task_id": task_id,
        "from_state": source,
        "to_state": target,
        "attempts": attempts,
        "note": note,
        "created_at": int(time.time()),
    }
    return _append(event)


def mark_proof_pending(opportunity_id: str, task_id: str) -> dict[str, Any]:
    return transition(opportunity_id, task_id, "PROOF_PENDING", "Execution completed; awaiting evidence.")


def verify_from_proof(opportunity_id: str, task_id: str, verified: bool) -> dict[str, Any]:
    return transition(opportunity_id, task_id, "VERIFIED" if verified else "FAILED", "Proof verification result recorded.")


def mark_reward_pending(opportunity_id: str, task_id: str) -> dict[str, Any]:
    return transition(opportunity_id, task_id, "REWARD_PENDING", "Verified task awaiting reward event.")


def mark_rewarded(opportunity_id: str, task_id: str, note: str = "Reward event confirmed.") -> dict[str, Any]:
    return transition(opportunity_id, task_id, "REWARDED", note)


def recover_failed(opportunity_id: str, task_id: str) -> dict[str, Any]:
    state = current_state(opportunity_id, task_id)
    if state["state"] != "FAILED":
        raise ValueError("Only FAILED tasks can be recovered")
    if int(state.get("attempts", 0)) >= MAX_RETRIES:
        return transition(opportunity_id, task_id, "BLOCKED", "Retry limit reached during recovery.")
    return transition(opportunity_id, task_id, "PREPARED", "Recovery scheduled for retry.")


def task_summary(opportunity_id: str, task_ids: list[str]) -> dict[str, Any]:
    states = {task_id: current_state(opportunity_id, task_id) for task_id in task_ids}
    counts: dict[str, int] = {}
    for state in states.values():
        name = str(state["state"])
        counts[name] = counts.get(name, 0) + 1
    completed = sum(1 for x in states.values() if x["state"] in {"VERIFIED", "REWARDED"})
    return {
        "opportunity_id": opportunity_id,
        "total": len(task_ids),
        "completed": completed,
        "counts": counts,
        "tasks": states,
    }
