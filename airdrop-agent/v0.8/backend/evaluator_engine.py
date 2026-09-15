from __future__ import annotations

from dataclasses import dataclass, asdict
from typing import Any


@dataclass(frozen=True)
class Evaluation:
    score: int
    tier: str
    risk_level: str
    confidence: int
    reasons: tuple[str, ...]
    red_flags: tuple[str, ...]

    def as_dict(self) -> dict[str, Any]:
        result = asdict(self)
        result["reasons"] = list(self.reasons)
        result["red_flags"] = list(self.red_flags)
        return result


def _tier(score: int) -> str:
    if score >= 80:
        return "HIGH_PRIORITY"
    if score >= 60:
        return "WORTH_REVIEW"
    if score >= 40:
        return "LOW_PRIORITY"
    return "AVOID"


def evaluate_opportunity(item: dict[str, Any]) -> dict[str, Any]:
    """Score an opportunity using deterministic, explainable safety heuristics.

    This is deliberately not an investment recommendation and does not execute actions.
    """
    score = float(item.get("opportunity_score", 0))
    confidence = max(0, min(100, int(float(item.get("source_confidence", 0)))))
    risk = max(0, min(100, int(float(item.get("risk_score", 0)))))
    cost = max(0.0, float(item.get("estimated_cost", 0) or 0))
    time = max(0, int(float(item.get("estimated_time_minutes", 0) or 0)))
    reward = str(item.get("reward", "Unknown")).strip()
    source = str(item.get("source", "")).strip().lower()
    url = str(item.get("official_url", "")).strip().lower()

    reasons: list[str] = []
    red_flags: list[str] = []

    if confidence >= 85:
        score += 8
        reasons.append("high source confidence")
    elif confidence < 50:
        score -= 12
        red_flags.append("low source confidence")

    if risk >= 70:
        score -= 25
        red_flags.append("high reported risk")
    elif risk >= 40:
        score -= 10
        red_flags.append("elevated reported risk")
    else:
        reasons.append("risk profile is comparatively low")

    if cost == 0:
        score += 8
        reasons.append("zero estimated cost")
    elif cost > 25:
        score -= 12
        red_flags.append("meaningful capital requirement")

    if time <= 30:
        score += 5
        reasons.append("short estimated execution time")
    elif time > 180:
        score -= 8
        red_flags.append("high time requirement")

    if reward.lower() in {"unknown", "", "tbd"}:
        score -= 8
        red_flags.append("reward is not clearly defined")
    else:
        reasons.append("reward information is present")

    if not url.startswith("https://"):
        score -= 15
        red_flags.append("official URL is missing or not HTTPS")
    if any(x in source for x in ("official", "cryptorank", "incrypted")):
        score += 3
        reasons.append("recognized discovery source")

    score = max(0, min(100, round(score)))
    if red_flags and any("URL" in x or "source confidence" in x for x in red_flags):
        risk_level = "HIGH"
    elif risk >= 40 or red_flags:
        risk_level = "MEDIUM"
    else:
        risk_level = "LOW"

    evaluation = Evaluation(score, _tier(score), risk_level, confidence, tuple(reasons), tuple(red_flags))
    return {**evaluation.as_dict(), "opportunity_id": str(item.get("id", "")), "project": str(item.get("project", ""))}
