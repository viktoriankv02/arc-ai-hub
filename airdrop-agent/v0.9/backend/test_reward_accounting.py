from __future__ import annotations

from decimal import Decimal

from .pnl_engine import portfolio_pnl


def test_empty_portfolio_is_zero() -> None:
    result = portfolio_pnl([])
    assert result["gross_received"] == "0"
    assert result["total_spent"] == "0"
    assert result["net_value"] == "0"
    assert result["roi_proxy"] is None


def test_decimal_accounting_handles_values_without_float_rounding() -> None:
    rows = [{"id": "missing-ledger-opportunity", "project": "Demo"}]
    result = portfolio_pnl(rows)
    assert Decimal(result["net_value"]) == Decimal("0")
