from __future__ import annotations

from datetime import datetime, timezone
from typing import Any


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def deadline_state(deadline: str | None) -> str:
    if not deadline or deadline in {"Ongoing", "ongoing", "-"}:
        return "OPEN"
    try:
        value = datetime.fromisoformat(deadline.replace("Z", "+00:00"))
        if value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        seconds = (value - datetime.now(timezone.utc)).total_seconds()
        if seconds < 0:
            return "EXPIRED"
        if seconds <= 24 * 3600:
            return "DUE_SOON"
        if seconds <= 7 * 24 * 3600:
            return "DUE_THIS_WEEK"
        return "OPEN"
    except ValueError:
        return "UNKNOWN"


def monitor_opportunities(items: list[dict[str, Any]]) -> dict[str, Any]:
    counts = {"OPEN": 0, "DUE_SOON": 0, "DUE_THIS_WEEK": 0, "EXPIRED": 0, "UNKNOWN": 0}
    monitored: list[dict[str, Any]] = []
    for item in items:
        state = deadline_state(str(item.get("deadline", "")))
        counts[state] = counts.get(state, 0) + 1
        monitored.append({**item, "deadline_state": state, "monitored_at": now_iso()})
    return {
        "checked_at": now_iso(),
        "count": len(monitored),
        "counts": counts,
        "items": monitored,
    }
