from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Any
from urllib.parse import urlparse


@dataclass(frozen=True)
class BrowserSessionPolicy:
    session_mode: str = "USER_CONTROLLED"
    reuse_existing_session: bool = True
    persist_cookies: bool = False
    persist_credentials: bool = False
    allow_background_actions: bool = False
    allow_wallet_signing: bool = False
    allow_captcha: bool = False
    require_user_approval_before_submit: bool = True


ALLOWED_SCHEMES = {"http", "https"}


def validate_target_url(url: str) -> dict[str, Any]:
    raw = str(url or "").strip()
    parsed = urlparse(raw)
    valid = parsed.scheme in ALLOWED_SCHEMES and bool(parsed.hostname)
    return {
        "valid": valid,
        "url": raw if valid else "",
        "host": (parsed.hostname or "").lower() if valid else "",
        "scheme": parsed.scheme.lower() if valid else "",
        "reason": "ok" if valid else "Only explicit HTTP(S) URLs are accepted.",
    }


def build_session_launch_plan(target_url: str, task: dict[str, Any] | None = None) -> dict[str, Any]:
    policy = BrowserSessionPolicy()
    target = validate_target_url(target_url)
    return {
        "status": "READY_FOR_USER_SESSION" if target["valid"] else "INVALID_TARGET",
        "target": target,
        "task_id": (task or {}).get("id"),
        "task_type": str((task or {}).get("type") or "MANUAL").upper(),
        "policy": asdict(policy),
        "steps": [
            "open_target_in_user_controlled_browser",
            "wait_for_user_confirmation",
            "perform_only_preapproved_non_secret_action",
            "pause_before_authenticated_submission",
            "return_result_and_proof_to_hub",
        ],
    }


def adapter_health(adapter_catalog: list[dict[str, Any]]) -> list[dict[str, Any]]:
    result = []
    for adapter in adapter_catalog:
        result.append({
            "id": adapter.get("id"),
            "name": adapter.get("name"),
            "status": adapter.get("status", "UNKNOWN"),
            "mode": adapter.get("mode", "USER_SESSION"),
            "safe_to_execute": False,
            "reason": "Adapter is a planning/session boundary until an explicit implementation is enabled.",
        })
    return result
