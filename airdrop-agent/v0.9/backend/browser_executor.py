from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Any
from urllib.parse import urlparse

SAFE_ACTIONS = {'OPEN_URL', 'READ_PAGE', 'PARSE_TASKS', 'RECORD_PROOF', 'REMINDER'}
APPROVAL_ACTIONS = {'CHECK_IN', 'FOLLOW_X', 'SOCIAL_ACTION', 'JOIN_DISCORD', 'JOIN_TELEGRAM', 'BRIDGE', 'SWAP', 'STAKE', 'CLAIM', 'DEPLOY_CONTRACT'}
USER_ONLY_ACTIONS = {'CAPTCHA', 'LOGIN', '2FA', 'SEED_PHRASE', 'PRIVATE_KEY'}
FORBIDDEN_AUTO_ACTIONS = {'SIGN_WALLET_MESSAGE', 'CONFIRM_TRANSACTION', 'APPROVE_TOKEN', 'SEND_TRANSACTION', 'CLAIM_REWARD', 'SOLVE_CAPTCHA'}

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
    task_type = str(task.get('type') or task.get('action') or 'MANUAL').upper()
    if task_type in SAFE_ACTIONS:
        return 'AI_AUTO'
    if task_type in USER_ONLY_ACTIONS:
        return 'USER_ONLY'
    if task_type in APPROVAL_ACTIONS or bool(task.get('approval_required')) or task_type in FORBIDDEN_AUTO_ACTIONS:
        return 'APPROVAL'
    return 'MANUAL'


def validate_target_url(url: str) -> tuple[bool, str]:
    if not url:
        return False, 'No target URL'
    parsed = urlparse(url)
    if parsed.scheme not in {'http', 'https'} or not parsed.netloc:
        return False, 'Target must be an absolute http(s) URL'
    return True, parsed.netloc.lower()


def execute_dry_run(task: dict[str, Any], approved: bool = False) -> dict[str, Any]:
    task_id = str(task.get('id') or 'unknown')
    action = str(task.get('type') or task.get('action') or 'MANUAL').upper()
    url = str(task.get('url') or '')
    ok, host = validate_target_url(url) if url else (True, '')
    mode = classify_action(task)

    if not ok:
        result = BrowserActionResult(task_id, 'BLOCKED', action, mode, url, host, False)
    elif mode == 'AI_AUTO':
        result = BrowserActionResult(task_id, 'SIMULATED', action, mode, url, 'Safe public action is eligible for automation; live browser runtime is not invoked by this adapter.', False)
    elif mode == 'APPROVAL':
        result = BrowserActionResult(task_id, 'SIMULATED' if approved else 'AWAITING_APPROVAL', action, mode, url, 'Approval is required before any authenticated or state-changing action.', False)
    elif mode == 'USER_ONLY':
        result = BrowserActionResult(task_id, 'USER_REQUIRED', action, mode, url, 'This action must remain with the user.', False)
    else:
        result = BrowserActionResult(task_id, 'MANUAL_REVIEW', action, mode, url, 'No safe adapter classification exists yet.', False)

    payload = asdict(result)
    payload.update({'host': host, 'wallet_signing': False, 'credentials_stored': False, 'captcha_automation': False})
    return payload


def launch_policy() -> dict[str, Any]:
    return {
        'engine': 'CONTROLLED_BROWSER_ADAPTER',
        'status': 'DRY_RUN',
        'automatic': ['open_public_url', 'read_public_page', 'extract_visible_text', 'capture_proof_metadata'],
        'approval_required': ['authenticated_submit', 'social_action', 'wallet_interaction', 'transaction', 'claim'],
        'user_only': ['captcha', 'seed_phrase', 'private_key', '2fa'],
        'never_store': ['cookies_export', 'session_tokens', 'passwords', 'seed_phrase', 'private_key'],
    }
