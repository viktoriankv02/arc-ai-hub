from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Callable, Any


@dataclass(frozen=True)
class ScheduleConfig:
    interval_minutes: int = 60
    enabled: bool = True

    def validate(self) -> None:
        if self.interval_minutes < 5:
            raise ValueError("Minimum monitoring interval is 5 minutes")


def should_run(last_run: str | None, config: ScheduleConfig, now: datetime | None = None) -> bool:
    config.validate()
    if not config.enabled:
        return False
    if not last_run:
        return True
    try:
        previous = datetime.fromisoformat(last_run.replace("Z", "+00:00"))
        if previous.tzinfo is None:
            previous = previous.replace(tzinfo=timezone.utc)
    except ValueError:
        return True
    current = now or datetime.now(timezone.utc)
    return (current - previous).total_seconds() >= config.interval_minutes * 60


def run_refresh_if_due(last_run: str | None, config: ScheduleConfig, refresh: Callable[[], Any], now: datetime | None = None) -> dict[str, Any]:
    if not should_run(last_run, config, now):
        return {"ran": False, "reason": "not_due", "last_run": last_run}
    result = refresh()
    timestamp = (now or datetime.now(timezone.utc)).isoformat()
    return {"ran": True, "last_run": timestamp, "result": result}
