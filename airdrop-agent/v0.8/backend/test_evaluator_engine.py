from .evaluator_engine import evaluate_opportunity


def base():
    return {
        "id": "demo",
        "project": "Demo",
        "opportunity_score": 70,
        "source_confidence": 90,
        "risk_score": 10,
        "estimated_cost": 0,
        "estimated_time_minutes": 20,
        "reward": "Points / future rewards",
        "source": "CryptoRank",
        "official_url": "https://example.org/project",
    }


def test_evaluator_rewards_low_cost_high_confidence():
    result = evaluate_opportunity(base())
    assert result["score"] > 70
    assert result["tier"] == "HIGH_PRIORITY"
    assert result["risk_level"] == "LOW"
    assert "zero estimated cost" in result["reasons"]


def test_evaluator_flags_weak_source_and_url():
    item = {**base(), "source_confidence": 30, "official_url": "http://example.org", "reward": "Unknown"}
    result = evaluate_opportunity(item)
    assert "low source confidence" in result["red_flags"]
    assert "official URL is missing or not HTTPS" in result["red_flags"]
    assert "reward is not clearly defined" in result["red_flags"]
    assert result["risk_level"] == "HIGH"


def test_evaluator_never_exceeds_bounds():
    result = evaluate_opportunity({**base(), "opportunity_score": 1000, "source_confidence": 100, "risk_score": 0})
    assert 0 <= result["score"] <= 100
