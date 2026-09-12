from __future__ import annotations

from dataclasses import dataclass, asdict
from urllib.parse import urlparse
from typing import Any


SAFE_ACTIONS = {"OPEN_URL", "READ_PAGE", "PARSE_TASKS", "RECORD_PROOF", "REMINDER"}
APPROVAL_ACTIONS = {
    "CHECK_IN",
    "FOLLOW_X",
    "SOCIAL_ACTION",
    "JOIN_DISCORD",
    "JOIN_TELEGRAM",
    "BRIDGE",
    "SWAP",
    "STAKE",
    "CLAIM",
    "DEPLOY_CONTRACT",
}
USER_ONLY_ACTIONS = {"CAPTCHA", "LOGIN", "2FA", "SEED_PHRASE", "PRIVATE_KEY"}


@dataclass(frozen=True)
class BrowserActionResult:
    task_id: str
    status: str
    action: str
    mode: str
    target_url: str
    reason: str
    performed: bool


def classify_action(task: dict[str, Any]) -> str:
    task_type = str(task.get("type") or task.get("action") or "MANUAL").upper()
    if task_type in SAFE_ACTIONS:
        return "AI_AUTO"
    if task_type in APPROVAL_ACTIONS or bool(task.get("approval_required")):
        return "APPROVAL"
    if task_type in USER_ONLY_ACTIONS:
        return "USER_ONLY"
    return "MANUAL"


def validate_target_url(url: str) -> tuple[bool, str]:
    if not url:
        return False, "No target URL"
    parsed = urlparse(url)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        return False, "Target must be an absolute http(s) URL"
    return True, parsed.netloc


def execute_dry_run(task: dict[str, Any], approved: bool = False) -> dict[str, Any]:
    task_id = str(task.get("id") or "unknown")
    action = str(task.get("type") or "MANUAL").upper()
    url = str(task.get("url") or "")
    ok, host = validate_target_url(url) if url else (True, "")
    mode = classify_action(task)

    if not ok:
        result = BrowserActionResult(task_id, "BLOCKED", action, mode, url, host, False)
    elif mode == "AI_AUTO":
        result = BrowserActionResult(task_id, "SIMULATED", action, mode, url, "Safe action is eligible for automation; no live browser session is invoked.", False)
    elif mode == "APPROVAL":
        result = BrowserActionResult(task_id, "SIMULATED" if approved else "AWAITING_APPROVAL", action, mode, url, "Approval is required before a live authenticated or state-changing action.", False)
    elif mode == "USER_ONLY":
        result = BrowserActionResult(task_id, "USER_REQUIRED", action, mode, url, "This action must remain with the user.", False)
    else:
        result = BrowserActionResult(task_id, "MANUAL_REVIEW", action, mode, url, "No safe adapter classification exists yet.", False)

    payload = asdict(result)
    payload["host"] = host
    return payload
