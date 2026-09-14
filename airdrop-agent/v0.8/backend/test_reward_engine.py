from .reward_engine import (
    HistoryEvent,
    RewardStatus,
    make_history_event,
    make_reward_record,
    validate_reward_transition,
)


def test_reward_record_from_opportunity():
    record = make_reward_record({"id": "tempo", "project": "Tempo", "reward": "Potential tokens"}, RewardStatus.EXPECTED.value)
    assert record.opportunity_id == "tempo"
    assert record.project == "Tempo"
    assert record.status == "EXPECTED"
    assert record.reward == "Potential tokens"
    assert record.updated_at


def test_reward_transition_rules():
    assert validate_reward_transition("UNKNOWN", "EXPECTED")[0]
    assert validate_reward_transition("EXPECTED", "CLAIMABLE")[0]
    assert validate_reward_transition("CLAIMABLE", "CLAIMED")[0]
    assert not validate_reward_transition("CLAIMED", "EXPECTED")[0]


def test_history_event():
    event = make_history_event(HistoryEvent.PROOF_RECORDED.value, "tempo", {"proof_type": "tx_hash"})
    assert event["event_type"] == "PROOF_RECORDED"
    assert event["opportunity_id"] == "tempo"
    assert event["details"]["proof_type"] == "tx_hash"
    assert event["timestamp"]
