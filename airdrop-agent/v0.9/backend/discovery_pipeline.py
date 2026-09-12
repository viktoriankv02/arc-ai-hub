from __future__ import annotations
import json
from pathlib import Path
from .dedupe import deduplicate_opportunities
from .drop_hunter import scan_sources
DATA_FILE=Path(__file__).resolve().parent/'data'/'opportunities.json'
def run_discovery_pipeline()->dict:
    result=scan_sources(); items,duplicates=deduplicate_opportunities(result.get('items') or [])
    DATA_FILE.write_text(json.dumps(items,ensure_ascii=False,indent=2),encoding='utf-8')
    return {'items':items,'new':int(result.get('new',0)),'duplicates_collapsed':duplicates,'cryptorank':result.get('cryptorank','unknown'),'total':len(items)}
