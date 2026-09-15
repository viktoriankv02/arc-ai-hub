from .workflow_engine import build_task_plan_document


def opportunity():
    return {
        "id": "tempo-demo",
        "project": "Tempo",
        "opportunity_score": 72,
        "source_confidence": 90,
        "risk_score": 10,
        "estimated_cost": 0,
        "estimated_time": 20,
        "reward": "Points / future rewards",
        "source": "CryptoRank",
        "official_url": "https://example.org/tempo",
        "tasks": [
            {"id": "wallet", "title": "Connect wallet", "task_type": "CONNECT_WALLET"},
            {"id": "follow", "title": "Follow X", "task_type": "FOLLOW_X"},
            {"id": "note", "title": "Record proof", "task_type": "SUBMIT_PROOF"},
        ],
    }


def test_workflow_links_evaluation_and_safety_classified_tasks():
    plan = build_task_plan_document(opportunity(), wallet_connected=False)
    assert plan["plan_id"] == "plan-tempo-demo"
    assert plan["opportunity_id"] == "tempo-demo"
    assert plan["evaluation"]["score"] > 70
    assert plan["safety"] == "approval-only"
    assert plan["tasks"][0]["status"] == "USER_ACTION_REQUIRED"
    assert plan["tasks"][0]["approval_required"] is True
    assert plan["tasks"][1]["approval_required"] is True
    assert plan["tasks"][2]["status"] == "READY"
    assert plan["tasks"][2]["approval_required"] is False


def test_wallet_connection_becomes_ready_only_when_already_connected():
    plan = build_task_plan_document({**opportunity(), "tasks": [opportunity()["tasks"][0]]}, wallet_connected=True)
    assert plan["tasks"][0]["status"] == "READY"
    assert plan["tasks"][0]["approval_required"] is True


def test_empty_tasks_gets_explicit_manual_review_task():
    plan = build_task_plan_document({**opportunity(), "tasks": []})
    assert len(plan["tasks"]) == 1
    assert plan["tasks"][0]["task_type"] == "MANUAL"
    assert plan["tasks"][0]["status"] == "READY"
