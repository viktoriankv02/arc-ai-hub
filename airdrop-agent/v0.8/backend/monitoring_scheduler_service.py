from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Callable

from .monitoring_engine import monitor_opportunities
from .scheduler_engine import ScheduleConfig, run_refresh_if_due


class MonitoringSchedulerService:
    """Coordinates opportunity monitoring and source refresh without executing user actions."""

    def __init__(self, refresh: Callable[[], Any], interval_minutes: int = 60, enabled: bool = True) -> None:
        self.refresh = refresh
        self.config = ScheduleConfig(interval_minutes=interval_minutes, enabled=enabled)
        self.config.validate()
        self.last_run: str | None = None
        self.last_result: dict[str, Any] | None = None

    def status(self, now: datetime | None = None) -> dict[str, Any]:
        current = now or datetime.now(timezone.utc)
        return {
            "enabled": self.config.enabled,
            "interval_minutes": self.config.interval_minutes,
            "last_run": self.last_run,
            "last_result": self.last_result,
            "checked_at": current.isoformat(),
        }

    def configure(self, interval_minutes: int | None = None, enabled: bool | None = None) -> dict[str, Any]:
        config = ScheduleConfig(
            interval_minutes=self.config.interval_minutes if interval_minutes is None else interval_minutes,
            enabled=self.config.enabled if enabled is None else enabled,
        )
        config.validate()
        self.config = config
        return self.status()

    def monitor(self, items: list[dict[str, Any]]) -> dict[str, Any]:
        return monitor_opportunities(items)

    def run_if_due(self, now: datetime | None = None) -> dict[str, Any]:
        result = run_refresh_if_due(self.last_run, self.config, self.refresh, now=now)
        if result["ran"]:
            self.last_run = result["last_run"]
            refreshed = result.get("result")
            items = refreshed[0] if isinstance(refreshed, tuple) and refreshed else refreshed
            self.last_result = {
                "ran": True,
                "count": len(items) if isinstance(items, list) else 0,
                "monitoring": monitor_opportunities(items if isinstance(items, list) else []),
            }
        return {**result, "status": self.status(now)}
