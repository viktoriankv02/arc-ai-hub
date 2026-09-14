from .analytics_engine import summarize


def test_summary_counts_progress():
    opportunities = [
        {"id": "a", "opportunity_score": 80},
        {"id": "b", "opportunity_score": 60},
    ]
    tasks = {"a": {"tasks": [{"status": "COMPLETED"}, {"status": "BLOCKED"}]}}
    rewards = {"a": {"status": "CLAIMABLE"}, "b": {"status": "CLAIMED"}}
    result = summarize(opportunities, tasks, rewards)
    assert result["opportunities"] == 2
    assert result["average_opportunity_score"] == 70
    assert result["tasks_completed"] == 1
    assert result["tasks_blocked"] == 1
    assert result["task_completion_rate"] == 50
    assert result["rewards_claimable"] == 1
    assert result["rewards_claimed"] == 1
