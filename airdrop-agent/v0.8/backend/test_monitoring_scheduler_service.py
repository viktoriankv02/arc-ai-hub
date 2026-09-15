from datetime import datetime, timezone, timedelta

import pytest

from .monitoring_scheduler_service import MonitoringSchedulerService


def test_service_runs_first_refresh_and_monitors_deadlines():
    calls = []
    items = [{"id": "x", "project": "X", "deadline": (datetime.now(timezone.utc) + timedelta(days=2)).isoformat()}]

    def refresh():
        calls.append(1)
        return items, {"incrypted": "ok"}

    service = MonitoringSchedulerService(refresh, interval_minutes=60)
    result = service.run_if_due(datetime(2026, 9, 15, tzinfo=timezone.utc))

    assert result["ran"] is True
    assert len(calls) == 1
    assert result["status"]["last_result"]["count"] == 1
    assert result["status"]["last_result"]["monitoring"]["items"][0]["deadline_state"] == "OPEN"


def test_service_does_not_refresh_before_interval():
    calls = []

    def refresh():
        calls.append(1)
        return [], {}

    service = MonitoringSchedulerService(refresh, interval_minutes=60)
    first = service.run_if_due(datetime(2026, 9, 15, 10, 0, tzinfo=timezone.utc))
    second = service.run_if_due(datetime(2026, 9, 15, 10, 30, tzinfo=timezone.utc))

    assert first["ran"] is True
    assert second["ran"] is False
    assert len(calls) == 1


def test_service_configuration_rejects_too_short_interval():
    service = MonitoringSchedulerService(lambda: ([], {}))
    with pytest.raises(ValueError):
        service.configure(interval_minutes=4)


def test_service_can_be_disabled():
    service = MonitoringSchedulerService(lambda: ([], {}), enabled=False)
    result = service.run_if_due(datetime(2026, 9, 15, tzinfo=timezone.utc))
    assert result["ran"] is False
