from __future__ import annotations

from decimal import Decimal, InvalidOperation
from typing import Any

CONFIRMED_REWARD_EVENTS = frozenset({'RECEIVED', 'CLAIMED', 'REWARDED', 'CONFIRMED', 'CLAIM_CONFIRMED'})
COST_EVENTS = frozenset({'SPENT', 'GAS', 'FEE', 'COST'})


def normalize_event_type(value: Any) -> str:
    return str(value or '').strip().upper()


def is_confirmed_reward(event: dict[str, Any]) -> bool:
    return normalize_event_type(event.get('event_type')) in CONFIRMED_REWARD_EVENTS


def is_cost_event(event: dict[str, Any]) -> bool:
    return normalize_event_type(event.get('event_type')) in COST_EVENTS


def parse_amount(value: Any) -> Decimal:
    try:
        return Decimal(str(value or '0').replace(',', '').strip())
    except (InvalidOperation, ValueError):
        return Decimal('0')


def is_positive_amount(value: Any) -> bool:
    return parse_amount(value) > 0


def reward_transition_allowed(events: list[dict[str, Any]]) -> bool:
    return any(is_confirmed_reward(event) and is_positive_amount(event.get('amount')) for event in events)
