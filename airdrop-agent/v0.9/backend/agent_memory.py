from __future__ import annotations

import json
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

DATA_DIR = Path(__file__).resolve().parent / "data"
FEEDBACK_FILE = DATA_DIR / "agent_feedback.jsonl"


def _records() -> list[dict[str, Any]]:
    if not FEEDBACK_FILE.exists():
        return []
    rows: list[dict[str, Any]] = []
    for line in FEEDBACK_FILE.read_text(encoding="utf-8").splitlines():
        try:
            value = json.loads(line)
            if isinstance(value, dict):
                rows.append(value)
        except json.JSONDecodeError:
            continue
    return rows


def build_memory_summary() -> dict[str, Any]:
    rows = _records()
    outcomes = Counter(str(x.get("outcome", "unknown")).lower() for x in rows)
    by_project: dict[str, list[str]] = defaultdict(list)
    for row in rows:
        project = str(row.get("opportunity_id", "unknown"))
        by_project[project].append(str(row.get("outcome", "unknown")).lower())

    positive = outcomes["success"] + outcomes["claimed"] + outcomes["completed"]
    negative = outcomes["failed"] + outcomes["rejected"] + outcomes["scam"]
    total = len(rows)
    success_rate = round(positive / total, 3) if total else 0.0

    lessons: list[str] = []
    if outcomes["scam"]:
        lessons.append("Increase verification strictness when an opportunity is marked scam.")
    if outcomes["failed"]:
        lessons.append("Prefer smaller, reversible actions before complex blockchain execution.")
    if positive:
        lessons.append("Preserve task patterns and source characteristics associated with successful outcomes.")
    if not lessons:
        lessons.append("No feedback history yet; use conservative scoring and approval gates.")

    return {
        "samples": total,
        "outcomes": dict(outcomes),
        "positive": positive,
        "negative": negative,
        "success_rate": success_rate,
        "project_history": {k: v[-10:] for k, v in by_project.items()},
        "lessons": lessons,
        "storage": "local_jsonl",
        "contains_secrets": False,
    }
