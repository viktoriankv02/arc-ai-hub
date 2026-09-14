from .task_engine import TaskStatus, build_task_plan, validate_proof, validate_transition


def test_task_plan_requires_approval_for_transaction_and_social_actions():
    plan = build_task_plan({"tasks": [
        {"id": "wallet", "title": "Connect wallet", "task_type": "CONNECT_WALLET"},
        {"id": "swap", "title": "Swap", "task_type": "SWAP"},
        {"id": "x", "title": "Follow X", "task_type": "FOLLOW_X"},
        {"id": "proof", "title": "Save proof", "task_type": "SUBMIT_PROOF"},
    ]})
    assert plan[0]["status"] == TaskStatus.USER_ACTION_REQUIRED.value
    assert plan[0]["approval_required"] is True
    assert plan[1]["approval_required"] is True
    assert plan[2]["approval_required"] is True
    assert plan[3]["status"] == TaskStatus.READY.value


def test_wallet_connection_becomes_ready_only_after_wallet_is_connected():
    plan = build_task_plan({"tasks": [{"id": "wallet", "title": "Connect", "task_type": "CONNECT_WALLET"}]}, wallet_connected=True)
    assert plan[0]["status"] == TaskStatus.READY.value


def test_task_transition_guard():
    assert validate_transition("READY", "APPROVED")[0]
    assert validate_transition("APPROVED", "COMPLETED")[0]
    assert not validate_transition("COMPLETED", "READY")[0]


def test_proof_validation():
    assert validate_proof("tx_hash", "0x" + "a" * 64)[0]
    assert not validate_proof("tx_hash", "0x123")[0]
    assert validate_proof("manual_note", "completed in wallet")[0]
    assert not validate_proof("unknown", "x")[0]
