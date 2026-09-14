from __future__ import annotations

from decimal import Decimal, InvalidOperation
from typing import Any

from .reward_ledger import build_reward_ledger


def _d(value: Any) -> Decimal:
    try:
        return Decimal(str(value or "0"))
    except (InvalidOperation, ValueError):
        return Decimal("0")


def opportunity_pnl(opportunity: dict[str, Any]) -> dict[str, Any]:
    ledger = build_reward_ledger(str(opportunity.get("id") or ""))
    gross = _d(ledger["gross_received"])
    spent = _d(ledger["gross_spent"])
    return {
        "opportunity_id": opportunity.get("id"),
        "project": opportunity.get("project"),
        "gross_received": str(gross),
        "total_spent": str(spent),
        "net_value": str(gross - spent),
        "roi_proxy": str((gross - spent) / spent) if spent else None,
        "reward_events": ledger["event_count"],
    }


def portfolio_pnl(opportunities: list[dict[str, Any]]) -> dict[str, Any]:
    rows = [opportunity_pnl(x) for x in opportunities]
    gross = sum((_d(x["gross_received"]) for x in rows), Decimal("0"))
    spent = sum((_d(x["total_spent"]) for x in rows), Decimal("0"))
    net = gross - spent
    return {
        "opportunities": len(rows),
        "gross_received": str(gross),
        "total_spent": str(spent),
        "net_value": str(net),
        "roi_proxy": str(net / spent) if spent else None,
        "profitable": sum(1 for x in rows if _d(x["net_value"]) > 0),
        "unprofitable": sum(1 for x in rows if _d(x["net_value"]) < 0),
        "rows": rows,
    }
