from __future__ import annotations

from typing import Any


def summarize(opportunities: list[dict[str, Any]], tasks: dict[str, Any], rewards: dict[str, Any]) -> dict[str, Any]:
    total = len(opportunities)
    scores = [float(x.get("opportunity_score", 0)) for x in opportunities]
    task_total = 0
    task_completed = 0
    task_blocked = 0
    for record in tasks.values():
        for task in record.get("tasks", []):
            task_total += 1
            status = task.get("status")
            if status == "COMPLETED": task_completed += 1
            if status == "BLOCKED": task_blocked += 1
    reward_values = list(rewards.values())
    claimed = sum(1 for x in reward_values if x.get("status") == "CLAIMED")
    claimable = sum(1 for x in reward_values if x.get("status") == "CLAIMABLE")
    return {
        "opportunities": total,
        "average_opportunity_score": round(sum(scores) / len(scores), 2) if scores else 0,
        "top_opportunity_score": max(scores) if scores else 0,
        "tasks_total": task_total,
        "tasks_completed": task_completed,
        "tasks_blocked": task_blocked,
        "task_completion_rate": round(task_completed / task_total * 100, 2) if task_total else 0,
        "rewards_tracked": len(reward_values),
        "rewards_claimable": claimable,
        "rewards_claimed": claimed,
    }
