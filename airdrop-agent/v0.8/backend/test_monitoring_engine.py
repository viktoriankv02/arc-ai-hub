from monitoring_engine import deadline_state, monitor_opportunities


def test_ongoing_is_open():
    assert deadline_state("Ongoing") == "OPEN"


def test_expired_deadline():
    assert deadline_state("2020-01-01T00:00:00Z") == "EXPIRED"


def test_monitor_counts_items():
    result = monitor_opportunities([
        {"id": "a", "project": "A", "deadline": "Ongoing"},
        {"id": "b", "project": "B", "deadline": "2020-01-01T00:00:00Z"},
    ])
    assert result["count"] == 2
    assert result["counts"]["OPEN"] == 1
    assert result["counts"]["EXPIRED"] == 1
    assert all("deadline_state" in item for item in result["items"])
