from __future__ import annotations

from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from typing import Any

from .evaluator_engine import evaluate_opportunity
from .task_engine import classify_task


@dataclass(frozen=True)
class TaskPlanDocument:
    plan_id: str
    opportunity_id: str
    project: str
    evaluation: dict[str, Any]
    tasks: list[dict[str, Any]]
    created_at: str
    safety: str = "approval-only"

    def as_dict(self) -> dict[str, Any]:
        return asdict(self)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def build_task_plan_document(opportunity: dict[str, Any], wallet_connected: bool = False) -> dict[str, Any]:
    """Create the deterministic Opportunity -> Evaluation -> Task Plan link.

    No network, wallet, social, signing, or transaction action is performed here.
    Every task is classified by the existing safety policy before it enters the plan.
    """
    opportunity_id = str(opportunity.get("id", ""))
    if not opportunity_id:
        raise ValueError("Opportunity must contain an id")

    evaluation = evaluate_opportunity(opportunity)
    tasks: list[dict[str, Any]] = []
    for raw_task in opportunity.get("tasks", []):
        if not isinstance(raw_task, dict):
            continue
        tasks.append(classify_task(raw_task, wallet_connected).as_dict())

    if not tasks:
        tasks.append(classify_task({
            "id": f"{opportunity_id}-review",
            "title": "Review opportunity requirements",
            "task_type": "MANUAL",
            "required": True,
        }).as_dict())

    return TaskPlanDocument(
        plan_id=f"plan-{opportunity_id}",
        opportunity_id=opportunity_id,
        project=str(opportunity.get("project", "")),
        evaluation=evaluation,
        tasks=tasks,
        created_at=_now(),
    ).as_dict()
