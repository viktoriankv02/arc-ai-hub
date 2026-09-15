from __future__ import annotations

from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from enum import Enum
from typing import Any
from uuid import uuid4


class RewardStatus(str, Enum):
    UNKNOWN = "UNKNOWN"
    EXPECTED = "EXPECTED"
    ELIGIBLE = "ELIGIBLE"
    CLAIMABLE = "CLAIMABLE"
    CLAIMED = "CLAIMED"
    FAILED = "FAILED"


class HistoryEvent(str, Enum):
    OPPORTUNITY_DISCOVERED = "OPPORTUNITY_DISCOVERED"
    TASK_PLAN_CREATED = "TASK_PLAN_CREATED"
    TASK_COMPLETED = "TASK_COMPLETED"
    PROOF_RECORDED = "PROOF_RECORDED"
    REWARD_STATUS_CHANGED = "REWARD_STATUS_CHANGED"
    CLAIM_PROPOSED = "CLAIM_PROPOSED"
    CLAIMED = "CLAIMED"
    ERROR = "ERROR"


@dataclass
class RewardRecord:
    opportunity_id: str
    project: str
    status: str = RewardStatus.UNKNOWN.value
    reward: str = ""
    amount: str = ""
    token: str = ""
    claim_url: str = ""
    tx_hash: str = ""
    notes: str = ""
    updated_at: str = ""

    def as_dict(self) -> dict[str, Any]:
        return asdict(self)


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def make_reward_record(opportunity: dict[str, Any], status: str = RewardStatus.UNKNOWN.value) -> RewardRecord:
    try:
        normalized = RewardStatus(status).value
    except ValueError as exc:
        raise ValueError(f"Unsupported reward status: {status}") from exc
    return RewardRecord(
        opportunity_id=str(opportunity.get("id", "")),
        project=str(opportunity.get("project", "")),
        status=normalized,
        reward=str(opportunity.get("reward", "")),
        updated_at=now_iso(),
    )


def validate_reward_transition(current: str, target: str) -> tuple[bool, str]:
    allowed = {
        RewardStatus.UNKNOWN.value: {RewardStatus.EXPECTED.value, RewardStatus.ELIGIBLE.value, RewardStatus.FAILED.value},
        RewardStatus.EXPECTED.value: {RewardStatus.ELIGIBLE.value, RewardStatus.CLAIMABLE.value, RewardStatus.FAILED.value},
        RewardStatus.ELIGIBLE.value: {RewardStatus.CLAIMABLE.value, RewardStatus.FAILED.value},
        RewardStatus.CLAIMABLE.value: {RewardStatus.CLAIMED.value, RewardStatus.FAILED.value},
        RewardStatus.CLAIMED.value: set(),
        RewardStatus.FAILED.value: {RewardStatus.EXPECTED.value, RewardStatus.ELIGIBLE.value, RewardStatus.CLAIMABLE.value},
    }
    if target not in allowed.get(current, set()):
        return False, f"Invalid reward transition: {current} -> {target}"
    return True, "ok"


def make_history_event(event_type: str, opportunity_id: str, details: dict[str, Any] | None = None) -> dict[str, Any]:
    try:
        event = HistoryEvent(event_type).value
    except ValueError as exc:
        raise ValueError(f"Unsupported history event: {event_type}") from exc
    return {
        "event_id": f"evt-{uuid4().hex}",
        "event_type": event,
        "opportunity_id": opportunity_id,
        "timestamp": now_iso(),
        "details": details or {},
    }
