from datetime import datetime, timezone


def build_queue(opportunities, limit=20):
    rows = []
    for op in opportunities:
        if op.risk_verdict == "BLOCK":
            continue
        score = float(op.final_score or op.opportunity_score or 0)
        for task in op.tasks:
            if task.status == "DONE":
                continue
            priority = score - (2 if task.approval_required else 0)
            rows.append({
                "opportunity_id": op.id,
                "task_id": task.id,
                "project": op.project,
                "task": task.title,
                "task_type": task.type,
                "priority": round(priority, 2),
                "approval_required": task.approval_required,
                "reason": f"{op.project} · score {score:.1f}",
                "created_at": datetime.now(timezone.utc).isoformat(),
            })
    rows.sort(key=lambda x: x["priority"], reverse=True)
    result = rows[:max(1, min(limit, 100))]
    for i, row in enumerate(result, 1):
        row["rank"] = i
    return result
