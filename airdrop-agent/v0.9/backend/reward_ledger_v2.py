from __future__ import annotations

from decimal import Decimal, InvalidOperation
from typing import Any


def parse_amount(value: Any) -> Decimal:
    try:
        return Decimal(str(value or '0'))
    except (InvalidOperation, ValueError):
        return Decimal('0')


def summarize_events(events: list[dict[str, Any]]) -> dict[str, Any]:
    received: dict[str, Decimal] = {}
    spent: dict[str, Decimal] = {}
    for event in events:
        asset = str(event.get('asset') or 'UNKNOWN').upper()
        amount = parse_amount(event.get('amount'))
        kind = str(event.get('event_type') or '').upper()
        if kind in {'SPENT', 'GAS', 'FEE', 'COST'}:
            spent[asset] = spent.get(asset, Decimal('0')) + amount
        elif kind in {'RECEIVED', 'CLAIMED', 'REWARDED', 'CONFIRMED'}:
            received[asset] = received.get(asset, Decimal('0')) + amount
    rows = []
    for asset in sorted(set(received) | set(spent)):
        net = received.get(asset, Decimal('0')) - spent.get(asset, Decimal('0'))
        rows.append({'asset': asset, 'received': str(received.get(asset, Decimal('0'))), 'spent': str(spent.get(asset, Decimal('0'))), 'net': str(net)})
    return {'events': len(events), 'assets': rows}
