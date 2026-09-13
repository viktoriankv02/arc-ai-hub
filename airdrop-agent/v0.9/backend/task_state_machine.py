from __future__ import annotations

import json
import time
import uuid
from pathlib import Path
from typing import Any

DATA_DIR = Path(__file__).resolve().parent / "data"
STATE_FILE = DATA_DIR / "task_states.json"
EVENT_FILE = DATA_DIR / "task_state_events.jsonl"

STATES = (
    "DISCOVERED",
    "PREPARED",
    "APPROVED",
    "EXECUTING",
    "PROOF_PENDING",
    "VERIFIED",
    "REWARD_PENDING",
    "REWARDED",
    "BLOCKED",
    "FAILED",
)

TRANSITIONS = {
    "DISCOVERED": {"PREPARED", "BLOCKED"},
    "PREPARED": {"APPROVED", "BLOCKED"},
    "APPROVED": {"EXECUTING", "BLOCKED"},
    "EXECUTING": {"PROOF_PENDING", "FAILED", "BLOCKED"},
    "PROOF_PENDING": {"VERIFIED", "FAILED", "BLOCKED"},
    "VERIFIED": {"REWARD_PENDING", "REWARDED", "BLOCKED"},
    "REWARD_PENDING": {"REWARDED", "FAILED", "BLOCKED"},
    "REWARDED": set(),
    "BLOCKED": {"PREPARED"},
    "FAILED": {"PREPARED", "BLOCKED"},
}

MAX_RETRIES = 3


def _load() -> dict[str, dict[str, Any]]:
    if not STATE_FILE.exists():
        return {}
    try:
        value = json.loads(STATE_FILE.read_text(encoding="utf-8"))
        return value if isinstance(value, dict) else {}
    except (OSError, json.JSONDecodeError):
        return {}


def _save(states: dict[str, dict[str, Any]]) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    STATE_FILE.write_text(json.dumps(states, ensure_ascii=False, indent=2), encoding="utf-8")


def _event(record: dict[str, Any]) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    with EVENT_FILE.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(record, ensure_ascii=False) + "\n")


def state_key(opportunity_id: str, task_id: str) -> str:
    return f"{opportunity_id}:{task_id}"


def get_task_state(opportunity_id: str, task_id: str) -> dict[str, Any]:
    key = state_key(opportunity_id, task_id)
    states = _load()
    current = states.get(key)
    if current:
        return current
    return {
        "opportunity_id": opportunity_id,
        "task_id": task_id,
        "state": "DISCOVERED",
        "attempt": 0,
        "max_retries": MAX_RETRIES,
        "last_error": "",
        "updated_at": int(time.time()),
    }


def transition_task(opportunity_id: str, task_id: str, target: str, reason: str = "") -> dict[str, Any]:
    target = str(target).upper().strip()
    if target not in STATES:
        raise ValueError(f"Unknown target state: {target}")
    states = _load()
    key = state_key(opportunity_id, task_id)
    current = states.get(key) or get_task_state(opportunity_id, task_id)
    source = str(current.get("state", "DISCOVERED")).upper()
    if target not in TRANSITIONS.get(source, set()):
        raise ValueError(f"Invalid transition: {source} -> {target}")

    now = int(time.time())
    attempt = int(current.get("attempt", 0))
    if target == "EXECUTING":
        attempt += 1
    updated = {
        **current,
        "state": target,
        "attempt": attempt,
        "last_error": reason if target in {"FAILED", "BLOCKED"} else "",
        "updated_at": now,
    }
    states[key] = updated
    _save(states)
    _event({
        "event_id": f"state-{uuid.uuid4().hex[:12]}",
        "opportunity_id": opportunity_id,
        "task_id": task_id,
        "from": source,
        "to": target,
        "reason": reason,
        "attempt": attempt,
        "created_at": now,
    })
    return updated


def recover_task(opportunity_id: str, task_id: str) -> dict[str, Any]:
    current = get_task_state(opportunity_id, task_id)
    state = current["state"]
    attempt = int(current.get("attempt", 0))
    if state == "FAILED" and attempt < int(current.get("max_retries", MAX_RETRIES)):
        return transition_task(opportunity_id, task_id, "PREPARED", "retry-ready after failure")
    if state == "BLOCKED":
        return transition_task(opportunity_id, task_id, "PREPARED", "unblocked for manual retry")
    if state == "FAILED":
        return transition_task(opportunity_id, task_id, "BLOCKED", "retry limit reached")
    return current


def list_task_states(opportunity_id: str) -> list[dict[str, Any]]:
    return [x for x in _load().values() if x.get("opportunity_id") == opportunity_id]


def state_summary(opportunity_id: str) -> dict[str, Any]:
    rows = list_task_states(opportunity_id)
    counts = {state: 0 for state in STATES}
    for row in rows:
        state = str(row.get("state", "DISCOVERED"))
        if state in counts:
            counts[state] += 1
    return {"opportunity_id": opportunity_id, "total": len(rows), "counts": counts, "tasks": rows}
