from __future__ import annotations

import hashlib
import re
from typing import Any
from urllib.parse import urlparse


TASK_ALIASES = {
    "CHECK-IN": "CHECK_IN",
    "CHECKIN": "CHECK_IN",
    "DAILY CHECK": "CHECK_IN",
    "FOLLOW": "FOLLOW_X",
    "FOLLOW X": "FOLLOW_X",
    "TWITTER FOLLOW": "FOLLOW_X",
    "JOIN DISCORD": "JOIN_DISCORD",
    "DISCORD": "JOIN_DISCORD",
    "JOIN TELEGRAM": "JOIN_TELEGRAM",
    "TELEGRAM": "JOIN_TELEGRAM",
    "BRIDGE": "BRIDGE",
    "SWAP": "SWAP",
    "STAKE": "STAKE",
    "NODE": "RUN_NODE",
    "RUN NODE": "RUN_NODE",
    "DEPLOY": "DEPLOY_CONTRACT",
    "DEPLOY CONTRACT": "DEPLOY_CONTRACT",
    "NFT": "MINT_NFT",
    "MINT NFT": "MINT_NFT",
    "CLAIM": "CLAIM",
}

SAFE_TYPES = {"CHECK_ELIGIBILITY", "PARSE_TASKS", "CALCULATE_SCORE", "RECORD_PROOF", "REMINDER"}
APPROVAL_TYPES = {
    "CHECK_IN", "FOLLOW_X", "SOCIAL_ACTION", "JOIN_DISCORD", "JOIN_TELEGRAM",
    "BRIDGE", "SWAP", "STAKE", "RUN_NODE", "DEPLOY_CONTRACT", "MINT_NFT", "CLAIM",
}
USER_ONLY_TYPES = {"CAPTCHA", "SEED_PHRASE", "PRIVATE_KEY", "2FA", "EXCHANGE_PASSWORD"}


def normalize_task_type(value: Any) -> str:
    raw = str(value or "MANUAL").strip().upper().replace("_", " ")
    raw = re.sub(r"\s+", " ", raw)
    return TASK_ALIASES.get(raw, raw.replace(" ", "_"))


def source_task_id(task: dict[str, Any], fallback: str) -> str:
    for key in ("taskId", "task_id", "id", "uuid", "externalId", "external_id", "questTaskId"):
        value = task.get(key)
        if value not in (None, ""):
            return str(value).strip()
    return fallback


def canonical_task_id(project: str, task: dict[str, Any], index: int = 0) -> str:
    external = source_task_id(task, f"index-{index}")
    normalized_project = re.sub(r"[^a-z0-9]+", "-", str(project).lower()).strip("-")
    digest = hashlib.sha1(f"{normalized_project}|{external}".encode()).hexdigest()[:10]
    return f"task-{digest}"


def url_host(url: str) -> str:
    try:
        return (urlparse(str(url)).hostname or "").lower().removeprefix("www.")
    except Exception:
        return ""


def infer_task_mode(task_type: str, url: str = "") -> str:
    normalized = normalize_task_type(task_type)
    if normalized in USER_ONLY_TYPES:
        return "USER_ONLY"
    if normalized in SAFE_TYPES:
        return "AI_AUTO"
    if normalized in APPROVAL_TYPES or url_host(url):
        return "APPROVAL"
    return "MANUAL"


def task_fingerprint(project: str, task: dict[str, Any], index: int = 0) -> dict[str, Any]:
    title = str(task.get("title") or task.get("name") or task.get("type") or "Manual task").strip()
    task_type = normalize_task_type(task.get("type") or title)
    url = str(task.get("externalLink") or task.get("url") or "").strip()
    description = str(task.get("content") or task.get("description") or "").strip()
    source_id = source_task_id(task, f"index-{index}")
    return {
        "canonical_id": canonical_task_id(project, task, index),
        "source_id": source_id,
        "type": task_type,
        "title": title,
        "url": url,
        "host": url_host(url),
        "mode": infer_task_mode(task_type, url),
        "fingerprint": hashlib.sha1(f"{task_type}|{title.lower()}|{url.lower()}|{description.lower()}".encode()).hexdigest(),
    }


def enrich_tasks(project: str, tasks: list[dict[str, Any]]) -> list[dict[str, Any]]:
    enriched: list[dict[str, Any]] = []
    seen: set[str] = set()
    for index, task in enumerate(tasks):
        fp = task_fingerprint(project, task, index)
        if fp["fingerprint"] in seen:
            continue
        seen.add(fp["fingerprint"])
        enriched.append({**task, **fp})
    return enriched
