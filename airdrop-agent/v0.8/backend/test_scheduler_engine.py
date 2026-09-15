from datetime import datetime, timedelta, timezone

import pytest

from scheduler_engine import ScheduleConfig, run_refresh_if_due, should_run


def test_first_run_is_due():
    assert should_run(None, ScheduleConfig(60)) is True


def test_disabled_scheduler_does_not_run():
    assert should_run(None, ScheduleConfig(60, enabled=False)) is False


def test_scheduler_rejects_too_frequent_polling():
    with pytest.raises(ValueError):
        should_run(None, ScheduleConfig(4))


def test_scheduler_waits_until_interval():
    now = datetime.now(timezone.utc)
    last = (now - timedelta(minutes=30)).isoformat()
    assert should_run(last, ScheduleConfig(60), now) is False
    last = (now - timedelta(minutes=61)).isoformat()
    assert should_run(last, ScheduleConfig(60), now) is True


def test_run_refresh_if_due_calls_refresh_once():
    calls = []
    now = datetime.now(timezone.utc)
    result = run_refresh_if_due(None, ScheduleConfig(60), lambda: calls.append(1) or {"count": 3}, now)
    assert result["ran"] is True
    assert result["result"] == {"count": 3}
    assert calls == [1]
