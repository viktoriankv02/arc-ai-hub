from __future__ import annotations
from urllib.parse import urlparse
import re

def canonical_text(value: str) -> str:
    value = (value or '').lower().strip()
    return re.sub(r'\s+', ' ', re.sub(r'[^a-z0-9]+', ' ', value)).strip()

def canonical_project_key(project: str, symbol: str = '') -> str:
    stop = {'official','airdrop','testnet','mainnet','network','protocol','finance','labs','foundation','the','app','test','points','quest','quests'}
    parts = [x for x in canonical_text(project).split() if x not in stop]
    base = '-'.join(parts[:8]) or 'unknown-project'
    sym = canonical_text(symbol).replace(' ', '')
    return f'{base}:{sym}' if sym else base

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

def deduplicate_opportunities(items: list[dict]) -> tuple[list[dict], int]:
    groups: dict[str, dict] = {}
    duplicates = 0
    for raw in items:
        item = dict(raw)
        item['canonical_project'] = item.get('canonical_project') or canonical_project_key(str(item.get('project') or ''))
        item['official_host'] = canonical_host(str(item.get('official_url') or ''))
        item['official_domain_score'] = official_domain_score(str(item.get('official_url') or ''))
        item['sources'] = list(dict.fromkeys(item.get('sources') or [item.get('source','unknown')]))
        key = item['canonical_project']
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
