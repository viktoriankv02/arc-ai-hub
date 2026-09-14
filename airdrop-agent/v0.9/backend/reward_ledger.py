from __future__ import annotations

from collections import defaultdict
from decimal import Decimal, InvalidOperation
from typing import Any

from .proof_engine import reward_events


def _decimal(value: Any) -> Decimal:
    try:
        return Decimal(str(value or "0").replace(",", "").strip())
    except (InvalidOperation, ValueError):
        return Decimal("0")


def build_reward_ledger(opportunity_id: str) -> dict[str, Any]:
    events = reward_events(opportunity_id)
    received = Decimal("0")
    spent = Decimal("0")
    by_asset: dict[str, Decimal] = defaultdict(Decimal)
    normalized: list[dict[str, Any]] = []

    for event in events:
        event_type = str(event.get("event_type") or "").upper()
        amount = _decimal(event.get("amount"))
        asset = str(event.get("asset") or "UNKNOWN").upper()
        signed = amount
        if event_type in {"SPENT", "GAS", "FEE", "COST"}:
            signed = -abs(amount)
            spent += abs(amount)
        elif event_type in {"RECEIVED", "CLAIMED", "REWARDED", "CONFIRMED"}:
            received += abs(amount)
        by_asset[asset] += signed
        normalized.append({**event, "normalized_amount": str(signed), "asset": asset})

    return {
        "opportunity_id": opportunity_id,
        "event_count": len(events),
        "gross_received": str(received),
        "gross_spent": str(spent),
        "net_value": str(received - spent),
        "by_asset": {asset: str(value) for asset, value in sorted(by_asset.items())},
        "events": normalized,
    }


def build_portfolio_ledger(opportunities: list[dict[str, Any]]) -> dict[str, Any]:
    ledgers = [build_reward_ledger(str(item.get("id"))) for item in opportunities if item.get("id")]
    total_received = sum((_decimal(x["gross_received"]) for x in ledgers), Decimal("0"))
    total_spent = sum((_decimal(x["gross_spent"]) for x in ledgers), Decimal("0"))
    assets: dict[str, Decimal] = defaultdict(Decimal)
    for ledger in ledgers:
        for asset, value in ledger["by_asset"].items():
            assets[asset] += _decimal(value)
    return {
        "opportunities": len(ledgers),
        "gross_received": str(total_received),
        "gross_spent": str(total_spent),
        "net_value": str(total_received - total_spent),
        "by_asset": {asset: str(value) for asset, value in sorted(assets.items())},
        "ledgers": ledgers,
    }
