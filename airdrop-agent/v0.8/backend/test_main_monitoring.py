from . import main


def test_scheduler_status_has_safe_defaults(monkeypatch, tmp_path):
    monkeypatch.setattr(main, "SCHEDULER_FILE", tmp_path / "scheduler_state.json")
    result = main.scheduler_status()
    assert result["ok"] is True
    assert result["scheduler"]["enabled"] is True
    assert result["scheduler"]["interval_minutes"] == 60
    assert result["scheduler"]["last_run"] is None


def test_scheduler_configure_persists(monkeypatch, tmp_path):
    monkeypatch.setattr(main, "SCHEDULER_FILE", tmp_path / "scheduler_state.json")
    result = main.scheduler_configure(main.SchedulerConfigRequest(interval_minutes=30, enabled=False))
    assert result["ok"] is True
    assert result["scheduler"]["interval_minutes"] == 30
    assert result["scheduler"]["enabled"] is False
    assert main._scheduler_state()["interval_minutes"] == 30


def test_monitoring_endpoint_decorates_deadlines(monkeypatch):
    monkeypatch.setattr(main, "load_live_opportunities", lambda: [{"id": "x", "project": "Demo", "deadline": "Ongoing"}])
    result = main.monitoring()
    assert result["ok"] is True
    assert result["monitoring"]["count"] == 1
    assert result["monitoring"]["items"][0]["deadline_state"] == "OPEN"
