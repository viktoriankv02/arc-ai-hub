from __future__ import annotations

from dedupe import deduplicate_opportunities
from pnl_engine import portfolio_pnl


def test_dedupe_preserves_cross_source_evidence():
    items = [
        {
            'project': 'Example Network',
            'symbol': 'EXM',
            'chain': 'Ethereum',
            'source': 'CryptoRank',
            'official_url': 'https://example.org',
            'opportunity_score': 70,
            'source_confidence': 70,
            'risk_score': 40,
            'tags': ['testnet'],
        },
        {
            'project': 'Example Network Official Testnet',
            'symbol': 'EXM',
            'chain': 'Ethereum',
            'source': 'INCRYPTED',
            'official_url': 'https://example.org/testnet',
            'opportunity_score': 85,
            'source_confidence': 90,
            'risk_score': 30,
            'tags': ['community'],
        },
    ]
    merged, duplicates = deduplicate_opportunities(items)
    assert duplicates == 1
    assert len(merged) == 1
    assert set(merged[0]['sources']) == {'CryptoRank', 'INCRYPTED'}
    assert merged[0]['opportunity_score'] == 85
    assert merged[0]['risk_score'] == 30


def test_portfolio_pnl_exposes_asset_totals(monkeypatch):
    ledgers = {
        'a': {
            'event_count': 2,
            'gross_received': '100',
            'gross_spent': '20',
            'net_value': '80',
            'by_asset': {'USDT': '80'},
        },
        'b': {
            'event_count': 1,
            'gross_received': '50',
            'gross_spent': '10',
            'net_value': '40',
            'by_asset': {'USDT': '40'},
        },
    }
    monkeypatch.setattr('pnl_engine.build_reward_ledger', lambda opportunity_id: ledgers[opportunity_id])
    result = portfolio_pnl([{'id': 'a', 'project': 'A'}, {'id': 'b', 'project': 'B'}])
    assert result['gross_received'] == '150'
    assert result['total_spent'] == '30'
    assert result['net_value'] == '120'
    assert result['by_asset'] == {'USDT': '120'}
    assert result['profitable'] == 2
    assert result['unprofitable'] == 0
