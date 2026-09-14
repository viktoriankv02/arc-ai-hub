from __future__ import annotations

from unittest.mock import patch

from backend.execution_coordinator import reconcile_reward
from backend.task_orchestrator import sync_task_from_reward


def _pending_state() -> dict[str, object]:
    return {"state": "REWARD_PENDING", "attempts": 0, "history": []}


def test_orchestrator_does_not_reward_on_pending_or_zero_amount() -> None:
    events = [
        {"task_id": "t1", "event_type": "PENDING", "amount": "100"},
        {"task_id": "t1", "event_type": "CONFIRMED", "amount": "0"},
    ]
    with patch("backend.task_orchestrator.get_task_state", side_effect=[_pending_state(), _pending_state()]), patch(
        "backend.task_orchestrator.reward_events", return_value=events
    ), patch("backend.task_orchestrator.transition_task") as transition:
        result = sync_task_from_reward("opp-1", "t1")

    assert result["changed"] is False
    transition.assert_not_called()


def test_orchestrator_rewards_only_on_positive_confirmed_event() -> None:
    events = [{"task_id": "t1", "event_type": "CLAIMED", "amount": "1.25", "asset": "USDT"}]
    updated = {"state": "REWARDED", "attempts": 0, "history": []}
    with patch("backend.task_orchestrator.get_task_state", side_effect=[_pending_state(), updated]), patch(
        "backend.task_orchestrator.reward_events", return_value=events
    ), patch("backend.task_orchestrator.transition_task", return_value=updated) as transition:
        result = sync_task_from_reward("opp-1", "t1")

    assert result["changed"] is True
    transition.assert_called_once_with("opp-1", "t1", "REWARDED", "reward policy confirmed positive reward event")


def test_coordinator_does_not_transition_on_cost_only_events() -> None:
    events = [{"task_id": "t1", "event_type": "GAS", "amount": "0.002", "asset": "ETH"}]
    with patch("backend.execution_coordinator.get_task_state", side_effect=[_pending_state(), _pending_state()]), patch(
        "backend.execution_coordinator.reward_events", return_value=events
    ), patch("backend.execution_coordinator.transition_task") as transition:
        result = reconcile_reward({"id": "opp-1"}, "t1")

    assert result["reward_confirmed"] is False
    assert result["transitioned"] is False
    transition.assert_not_called()
