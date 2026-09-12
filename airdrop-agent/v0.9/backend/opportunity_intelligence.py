from __future__ import annotations

import re
import time
from typing import Any
from urllib.parse import urlparse

AGGREGATOR_HOSTS = {
    "cryptorank.io",
    "incrypted.com",
    "galxe.com",
    "zealy.io",
    "taskon.xyz",
    "questn.com",
    "intract.io",
}
KNOWN_CHAINS = {
    "ethereum", "base", "arbitrum", "optimism", "op mainnet", "scroll", "linea",
    "zksync", "zksync era", "arc testnet", "polygon", "avalanche", "bnb chain",
    "solana", "sui", "aptos", "sei", "berachain", "monad", "tempo",
}


def _host(url: str) -> str:
    try:
        return urlparse(url).netloc.lower().split(":")[0].removeprefix("www.")
    except Exception:
        return ""


def _root_project(project: str) -> str:
    value = re.sub(r"[^a-z0-9]+", " ", str(project).lower()).strip()
    for token in ("testnet", "airdrop", "campaign", "activity", "demo", "workspace"):
        value = re.sub(rf"\b{re.escape(token)}\b", " ", value)
    return re.sub(r"\s+", " ", value).strip()


def _freshness(last_updated: Any) -> tuple[int, str]:
    try:
        age_hours = max(0.0, (time.time() - float(last_updated)) / 3600)
    except (TypeError, ValueError):
        return 15, "UNKNOWN"
    if age_hours <= 24:
        return 25, "FRESH"
    if age_hours <= 72:
        return 21, "RECENT"
    if age_hours <= 24 * 7:
        return 16, "WEEK_OLD"
    if age_hours <= 24 * 30:
        return 9, "STALE"
    return 4, "VERY_STALE"


def research_opportunity(item: dict[str, Any]) -> dict[str, Any]:
    host = _host(str(item.get("official_url") or ""))
    freshness_points, freshness_status = _freshness(item.get("last_updated"))
    source_text = str(item.get("source") or "")
    source_hosts = item.get("sources") if isinstance(item.get("sources"), list) else []
    source_count = max(1, len(source_hosts))
    source_confidence = int(item.get("source_confidence") or 0)
    risk_score = int(item.get("risk_score") or 0)
    chain = str(item.get("chain") or "").strip().lower()
    tasks = item.get("tasks") if isinstance(item.get("tasks"), list) else []
    reward = str(item.get("reward") or "").strip()

    flags: list[str] = []
    if not host:
        flags.append("NO_OFFICIAL_URL")
    if host in AGGREGATOR_HOSTS:
        flags.append("AGGREGATOR_URL")
    if source_count == 1 and source_text.upper() in {"INCRYPTED", "CRYPTORANK"}:
        flags.append("SINGLE_SOURCE")
    if not tasks:
        flags.append("NO_TASKS")
    if freshness_status in {"STALE", "VERY_STALE"}:
        flags.append(freshness_status)
    if chain in {"", "unknown", "multi-chain"}:
        flags.append("UNKNOWN_CHAIN")
    if reward.lower() in {"", "unknown"}:
        flags.append("UNKNOWN_REWARD")
    if any(str(t.get("cost", "0")) not in {"", "0", "0.0"} for t in tasks if isinstance(t, dict)):
        flags.append("SPEND_REQUIRED")

    official_domain_score = 0
    if host:
        official_domain_score = 40 if host not in AGGREGATOR_HOSTS else 10
    agreement_points = min(20, 5 * source_count)
    agreement_points += min(10, max(0, source_confidence - 70) // 3)
    task_quality = min(15, len(tasks) * 3)
    risk_penalty = min(25, risk_score // 4)
    confidence = max(0, min(100, int(round(
        official_domain_score + agreement_points + freshness_points + task_quality - risk_penalty
    ))))

    if confidence >= 75 and "SPEND_REQUIRED" not in flags:
        review_status = "HIGH_PRIORITY"
    elif confidence >= 50:
        review_status = "REVIEW"
    else:
        review_status = "LOW_CONFIDENCE"

    return {
        "project_key": _root_project(str(item.get("project") or "")),
        "official_host": host,
        "official_domain_score": official_domain_score,
        "source_count": source_count,
        "source_agreement_score": min(100, agreement_points * 3),
        "freshness_score": freshness_points * 4,
        "freshness_status": freshness_status,
        "task_quality_score": min(100, task_quality * 7),
        "research_confidence": confidence,
        "risk_penalty": risk_penalty,
        "flags": flags,
        "review_status": review_status,
    }


def enrich_opportunities(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    enriched: list[dict[str, Any]] = []
    for item in items:
        copy = dict(item)
        research = research_opportunity(copy)
        copy["research"] = research
        copy["research_confidence"] = research["research_confidence"]
        copy["review_status"] = research["review_status"]
        enriched.append(copy)
    return enriched
