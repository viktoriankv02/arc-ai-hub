from __future__ import annotations

from dataclasses import asdict, dataclass
from enum import Enum
from typing import Any


class TaskStatus(str, Enum):
    PENDING = "PENDING"
    READY = "READY"
    USER_ACTION_REQUIRED = "USER_ACTION_REQUIRED"
    APPROVED = "APPROVED"
    COMPLETED = "COMPLETED"
    BLOCKED = "BLOCKED"


class ProofType(str, Enum):
    TX_HASH = "tx_hash"
    SCREENSHOT = "screenshot"
    URL = "url"
    MANUAL_NOTE = "manual_note"


AUTOMATIC_SAFE = {"MANUAL", "SUBMIT_PROOF"}
USER_APPROVAL = {"CONNECT_WALLET", "BRIDGE", "SWAP", "DEPLOY", "STAKE", "CLAIM"}
AUTHENTICATED_ACTIONS = {"FOLLOW_X", "JOIN_DISCORD"}


@dataclass
class TaskPlan:
    id: str
    title: str
    task_type: str
    required: bool = True
    automated: bool = False
    status: str = TaskStatus.PENDING.value
    approval_required: bool = False
    safety_reason: str = ""

    def as_dict(self) -> dict[str, Any]:
        return asdict(self)


def classify_task(task: dict[str, Any], wallet_connected: bool = False) -> TaskPlan:
    task_id = str(task.get("id", "task"))
    task_type = str(task.get("task_type", "MANUAL")).upper()
    required = bool(task.get("required", True))
    title = str(task.get("title", task_type.replace("_", " ").title()))

    if task_type in USER_APPROVAL:
        status = TaskStatus.USER_ACTION_REQUIRED
        reason = "Користувач повинен явно підтвердити wallet/signature/transaction дію."
        if task_type == "CONNECT_WALLET" and wallet_connected:
            status = TaskStatus.READY
        return TaskPlan(task_id, title, task_type, required, False, status.value, True, reason)
    if task_type in AUTHENTICATED_ACTIONS:
        return TaskPlan(task_id, title, task_type, required, False, TaskStatus.USER_ACTION_REQUIRED.value, True, "Автентифікована соціальна дія не виконується без явного підтвердження.")
    if task_type == "SUBMIT_PROOF":
        return TaskPlan(task_id, title, task_type, required, False, TaskStatus.READY.value, False, "Доказ зберігається локально; автоматична відправка в authenticated service заборонена.")
    return TaskPlan(task_id, title, task_type, required, task_type in AUTOMATIC_SAFE, TaskStatus.READY.value, False, "Інформаційна/локальна дія без підпису або витрати коштів.")


def build_task_plan(opportunity: dict[str, Any], wallet_connected: bool = False) -> list[dict[str, Any]]:
    return [classify_task(task, wallet_connected).as_dict() for task in opportunity.get("tasks", [])]


def validate_transition(current: str, target: str) -> tuple[bool, str]:
    allowed = {
        TaskStatus.PENDING.value: {TaskStatus.READY.value, TaskStatus.BLOCKED.value, TaskStatus.USER_ACTION_REQUIRED.value},
        TaskStatus.READY.value: {TaskStatus.APPROVED.value, TaskStatus.COMPLETED.value, TaskStatus.BLOCKED.value, TaskStatus.USER_ACTION_REQUIRED.value},
        TaskStatus.USER_ACTION_REQUIRED.value: {TaskStatus.APPROVED.value, TaskStatus.COMPLETED.value, TaskStatus.BLOCKED.value},
        TaskStatus.APPROVED.value: {TaskStatus.COMPLETED.value, TaskStatus.BLOCKED.value},
        TaskStatus.COMPLETED.value: set(),
        TaskStatus.BLOCKED.value: {TaskStatus.READY.value, TaskStatus.USER_ACTION_REQUIRED.value},
    }
    if target not in allowed.get(current, set()):
        return False, f"Invalid task transition: {current} -> {target}"
    return True, "ok"


def validate_proof(proof_type: str, value: str) -> tuple[bool, str]:
    try:
        ProofType(proof_type)
    except ValueError:
        return False, "Unsupported proof type"
    value = value.strip()
    if not value:
        return False, "Proof value cannot be empty"
    if proof_type == ProofType.TX_HASH.value and not (value.startswith("0x") and len(value) == 66):
        return False, "Invalid EVM transaction hash"
    return True, "ok"
