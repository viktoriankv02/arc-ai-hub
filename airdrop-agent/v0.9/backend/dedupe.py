from __future__ import annotations

from urllib.parse import urlparse
import re


def canonical_text(value: str) -> str:
    value = (value or '').lower().strip()
    return re.sub(r'\s+', ' ', re.sub(r'[^a-z0-9]+', ' ', value)).strip()


def canonical_project_key(project: str, symbol: str = '', chain: str = '') -> str:
    stop = {'official','airdrop','testnet','mainnet','network','protocol','finance','labs','foundation','the','app','test','points','quest','quests'}
    parts = [x for x in canonical_text(project).split() if x not in stop]
    base = '-'.join(parts[:8]) or 'unknown-project'
    sym = canonical_text(symbol).replace(' ', '')
    chain_key = canonical_text(chain).replace(' ', '-')
    key = f'{base}:{sym}' if sym else base
    return f'{key}@{chain_key}' if chain_key else key


def canonical_host(url: str) -> str:
    try:
        return (urlparse(url).hostname or '').lower().removeprefix('www.')
    except Exception:
        return ''


def official_domain_score(url: str) -> int:
    host = canonical_host(url)
    if not host:
        return 0
    hubs = {'cryptorank.io','incrypted.com','galxe.com','zealy.io','taskon.xyz','questn.com'}
    return 45 if host in hubs or any(host.endswith('.' + x) for x in hubs) else 80


def _external_key(item: dict) -> str:
    for name in ('source_id', 'external_id', 'activity_id', 'project_id'):
        value = str(item.get(name) or '').strip()
        if value:
            source = canonical_text(str(item.get('source') or 'unknown'))
            return f'{source}:{value}'
    return ''


def deduplicate_opportunities(items: list[dict]) -> tuple[list[dict], int]:
    groups: dict[str, dict] = {}
    duplicates = 0
    for raw in items:
        item = dict(raw)
        item['canonical_project'] = item.get('canonical_project') or canonical_project_key(
            str(item.get('project') or ''),
            str(item.get('symbol') or ''),
            str(item.get('chain') or ''),
        )
        item['official_host'] = canonical_host(str(item.get('official_url') or ''))
        item['official_domain_score'] = official_domain_score(str(item.get('official_url') or ''))
        item['sources'] = list(dict.fromkeys(item.get('sources') or [item.get('source','unknown')]))
        key = item['canonical_project']
        external_key = _external_key(item)
        if external_key:
            key = f'{key}|{external_key}' if key not in groups else key
        if key in groups:
            old = groups[key]
            old['sources'] = list(dict.fromkeys(old.get('sources', []) + item['sources']))
            old['source_count'] = len(old['sources'])
            old['opportunity_score'] = max(int(old.get('opportunity_score', 0)), int(item.get('opportunity_score', 0)))
            old['source_confidence'] = max(int(old.get('source_confidence', 0)), int(item.get('source_confidence', 0)))
            old['risk_score'] = min(int(old.get('risk_score', 100)), int(item.get('risk_score', 100)))
            old['tags'] = list(dict.fromkeys(old.get('tags', []) + item.get('tags', [])))[:30]
            duplicates += 1
        else:
            groups[key] = item
    return list(groups.values()), duplicates
