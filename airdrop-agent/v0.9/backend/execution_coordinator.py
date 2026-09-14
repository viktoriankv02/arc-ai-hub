from __future__ import annotations

from typing import Any

from .proof_engine import build_proof_summary, record_proof, reward_events
from .reward_policy import reward_transition_allowed
from .task_state_machine import get_task_state, transition_task

SENSITIVE_MODES = {"APPROVAL", "USER_ONLY", "MANUAL"}

def _task(opportunity: dict[str, Any], task_id: str) -> dict[str, Any]:
    for task in opportunity.get("tasks") or []:
        if str(task.get("id")) == task_id:
            return task
    raise KeyError("Task not found")

def build_execution_context(opportunity: dict[str, Any], task_id: str) -> dict[str, Any]:
    task = _task(opportunity, task_id)
    state = get_task_state(str(opportunity.get("id")), task_id)
    mode = "APPROVAL" if task.get("approval_required") else ("AI_AUTO" if task.get("agent_can_execute") else "MANUAL")
    return {"opportunity_id": opportunity.get("id"), "task_id": task_id, "project": opportunity.get("project"), "task": task, "mode": mode, "state": state, "proof": build_proof_summary(str(opportunity.get("id"))), "rewards": reward_events(str(opportunity.get("id"))), "requires_approval": mode in SENSITIVE_MODES, "policy": {"no_background_signing": True, "no_private_key": True, "no_seed_phrase": True, "authenticated_submit_requires_approval": True}}

def begin_execution(opportunity: dict[str, Any], task_id: str, approved: bool = False) -> dict[str, Any]:
    context = build_execution_context(opportunity, task_id)
    if context["requires_approval"] and not approved:
        return {"ok": False, "status": "APPROVAL_REQUIRED", "context": context}
    opportunity_id = str(opportunity.get("id"))
    state = str(context["state"].get("state"))
    if state == "DISCOVERED":
        transition_task(opportunity_id, task_id, "PREPARED", "execution coordinator prepared task")
        state = "PREPARED"
    if state == "PREPARED":
        if context["requires_approval"] and not approved:
            return {"ok": False, "status": "APPROVAL_REQUIRED", "context": build_execution_context(opportunity, task_id)}
        transition_task(opportunity_id, task_id, "APPROVED", "coordinator approval gate passed")
        state = "APPROVED"
    if state != "APPROVED":
        return {"ok": False, "status": "NOT_EXECUTABLE", "context": build_execution_context(opportunity, task_id)}
    transition_task(opportunity_id, task_id, "EXECUTING", "execution coordinator started controlled run")
    return {"ok": True, "status": "EXECUTING", "context": build_execution_context(opportunity, task_id)}

def complete_execution(opportunity: dict[str, Any], task_id: str, result: dict[str, Any]) -> dict[str, Any]:
    opportunity_id = str(opportunity.get("id"))
    if get_task_state(opportunity_id, task_id).get("state") != "EXECUTING":
        raise ValueError("Task must be EXECUTING")
    transition_task(opportunity_id, task_id, "PROOF_PENDING", "execution result received")
    verified = bool(result.get("verified"))
    proof = record_proof(opportunity_id, task_id, str(result.get("proof_kind") or "EXECUTION_RESULT"), result, "VERIFIED" if verified else "PENDING")
    if verified:
        transition_task(opportunity_id, task_id, "VERIFIED", "execution evidence verified")
        transition_task(opportunity_id, task_id, "REWARD_PENDING", "proof verified; awaiting reward")
    return {"ok": True, "proof": proof, "state": get_task_state(opportunity_id, task_id)}

def reconcile_reward(opportunity: dict[str, Any], task_id: str) -> dict[str, Any]:
    opportunity_id = str(opportunity.get("id"))
    state = get_task_state(opportunity_id, task_id)
    events = [x for x in reward_events(opportunity_id) if str(x.get("task_id")) == task_id]
    confirmed = reward_transition_allowed(events)
    transitioned = False
    if confirmed and state.get("state") == "REWARD_PENDING":
        transition_task(opportunity_id, task_id, "REWARDED", "reward policy confirmed positive reward event")
        transitioned = True
    return {"task_id": task_id, "state": get_task_state(opportunity_id, task_id), "reward_events": events, "reward_confirmed": confirmed, "transitioned": transitioned}
