from __future__ import annotations

from urllib.parse import urlparse


BROWSER_ACTIONS = {
    "CHECK_IN": {"action": "open_and_pause", "approval": True, "note": "Open the official check-in page and pause before authenticated submission."},
    "FOLLOW_X": {"action": "open_and_pause", "approval": True, "note": "Open the official X target and wait for user approval before authenticated action."},
    "JOIN_DISCORD": {"action": "open_and_pause", "approval": True, "note": "Open the official Discord invite; user confirms joining."},
    "JOIN_TELEGRAM": {"action": "open_and_pause", "approval": True, "note": "Open the official Telegram channel/group; user confirms joining."},
    "BRIDGE": {"action": "prepare_transaction", "approval": True, "note": "Prepare route and amount only; wallet signing remains user-controlled."},
    "SWAP": {"action": "prepare_transaction", "approval": True, "note": "Prepare swap parameters only; no automatic signing."},
    "STAKE": {"action": "prepare_transaction", "approval": True, "note": "Prepare staking parameters only; no automatic signing."},
    "DEPLOY_CONTRACT": {"action": "prepare_deployment", "approval": True, "note": "Compile/deployment plan can be prepared; broadcast requires approval."},
    "CLAIM": {"action": "prepare_claim", "approval": True, "note": "Prepare claim destination and transaction; signing remains user-controlled."},
    "MINT_NFT": {"action": "open_and_pause", "approval": True, "note": "Open mint page and pause before any wallet interaction."},
    "RUN_NODE": {"action": "prepare_node_setup", "approval": True, "note": "Prepare commands/config; installation and credentials stay user-controlled."},
}


def safe_url(url: str) -> dict[str, str | bool]:
    raw = (url or "").strip()
    if not raw:
        return {"valid": False, "url": "", "host": ""}
    parsed = urlparse(raw)
    valid = parsed.scheme in {"http", "https"} and bool(parsed.netloc)
    return {"valid": valid, "url": raw if valid else "", "host": parsed.netloc.lower() if valid else ""}


def build_browser_plan(opportunity: dict, task: dict) -> dict:
    task_type = str(task.get("type") or "MANUAL").upper()
    recipe = BROWSER_ACTIONS.get(task_type)
    url_info = safe_url(str(task.get("url") or opportunity.get("official_url") or ""))

    if recipe is None:
        return {
            "task_id": task.get("id"),
            "mode": "MANUAL",
            "action": "manual_review",
            "approval_required": True,
            "url": url_info["url"],
            "host": url_info["host"],
            "reason": "No validated browser adapter exists for this task type yet.",
        }

    return {
        "task_id": task.get("id"),
        "mode": "APPROVAL",
        "action": recipe["action"],
        "approval_required": bool(recipe["approval"]),
        "url": url_info["url"],
        "host": url_info["host"],
        "reason": recipe["note"],
    }


def build_browser_execution_plan(opportunity: dict) -> dict:
    tasks = opportunity.get("tasks") or []
    steps = [build_browser_plan(opportunity, task) for task in tasks]
    return {
        "opportunity_id": opportunity.get("id"),
        "project": opportunity.get("project"),
        "status": "PLAN_ONLY",
        "steps": steps,
        "policy": {
            "no_seed_phrase": True,
            "no_private_key": True,
            "no_background_signing": True,
            "captcha": "USER_ONLY",
        },
    }
