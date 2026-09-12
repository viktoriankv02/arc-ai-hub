from __future__ import annotations

from dataclasses import dataclass, asdict
from typing import Any


AUTO_ACTIONS = {
    "CHECK_ELIGIBILITY",
    "OPEN_URL",
    "PARSE_TASKS",
    "CALCULATE_SCORE",
    "RECORD_PROOF",
    "REMINDER",
}

APPROVAL_ACTIONS = {
    "CHECK_IN",
    "FOLLOW_X",
    "SOCIAL_ACTION",
    "JOIN_DISCORD",
    "JOIN_TELEGRAM",
    "BRIDGE",
    "SWAP",
    "STAKE",
    "RUN_NODE",
    "DEPLOY_CONTRACT",
    "MINT_NFT",
    "CLAIM",
    "REFERRAL",
}

NEVER_AUTOMATE = {
    "CAPTCHA",
    "SEED_PHRASE",
    "PRIVATE_KEY",
    "2FA",
    "EXCHANGE_PASSWORD",
}


@dataclass(frozen=True)
class ExecutionStep:
    task_id: str
    task_type: str
    mode: str
    title: str
    reason: str
    approval_required: bool
    browser_action: str = ""
    target_url: str = ""

    def as_dict(self) -> dict[str, Any]:
        return asdict(self)


def build_step(task: dict[str, Any]) -> ExecutionStep:
    task_type = str(task.get("type") or "MANUAL").upper()
    task_id = str(task.get("id") or "unknown")
    title = str(task.get("title") or task_type)
    url = str(task.get("url") or "")

    if task_type in NEVER_AUTOMATE:
        return ExecutionStep(
            task_id, task_type, "USER_ONLY", title,
            "Sensitive authentication or anti-bot action must stay with the user.",
            True, "", url,
        )

    if task_type in AUTO_ACTIONS and not task.get("approval_required"):
        return ExecutionStep(
            task_id, task_type, "AI_AUTO", title,
            "Read-only or local preparation action; no wallet signing or financial authorization.",
            False, "prepare", url,
        )

    if task_type in APPROVAL_ACTIONS or task.get("approval_required"):
        browser_action = "open-and-pause" if url else "approval"
        return ExecutionStep(
            task_id, task_type, "APPROVAL", title,
            "Authenticated, social, wallet, financial or blockchain action requires explicit user approval.",
            True, browser_action, url,
        )

    return ExecutionStep(
        task_id, task_type, "MANUAL", title,
        "No safe automation rule exists yet; keep execution manual until an adapter is validated.",
        True, "", url,
    )


def build_execution_plan(opportunity: dict[str, Any]) -> dict[str, Any]:
    tasks = opportunity.get("tasks") or []
    steps = [build_step(task) for task in tasks]
    return {
        "opportunity_id": opportunity.get("id"),
        "project": opportunity.get("project"),
        "generated_by": "ARC Drop Hunter Execution Planner",
        "steps": [x.as_dict() for x in steps],
        "summary": {
            "total": len(steps),
            "ai_auto": sum(x.mode == "AI_AUTO" for x in steps),
            "approval": sum(x.mode == "APPROVAL" for x in steps),
            "user_only": sum(x.mode == "USER_ONLY" for x in steps),
            "manual": sum(x.mode == "MANUAL" for x in steps),
        },
        "safety": {
            "seed_phrase": "never_store",
            "private_key": "never_store",
            "signing": "user_wallet_only",
            "broadcast": "user_approval_only",
        },
    }
