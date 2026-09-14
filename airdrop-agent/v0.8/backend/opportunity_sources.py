from __future__ import annotations

import json
import os
import re
import urllib.parse
import urllib.request
from html.parser import HTMLParser
from typing import Any

CRYPTORANK_URL = "https://api.cryptorank.io/v2/drophunting/activities"
INCRYPTED_URLS = {"all": "https://incrypted.com/ua/airdrops/", "testnet": "https://incrypted.com/ua/airdrops/activity-testnet/", "nodes": "https://incrypted.com/ua/airdrops/activity-nodes/", "tasks": "https://incrypted.com/ua/airdrops/activity-tasks/"}


def _get(url: str, headers: dict[str, str] | None = None, timeout: int = 15) -> bytes:
    request = urllib.request.Request(url, headers={"User-Agent": "ARC-AI-HUB/0.9", "Accept": "text/html,application/json", **(headers or {})})
    with urllib.request.urlopen(request, timeout=timeout) as response: return response.read()


def fetch_cryptorank(limit: int = 100) -> list[dict[str, Any]]:
    api_key = os.getenv("CRYPTORANK_API_KEY", "").strip()
    if not api_key: raise RuntimeError("CRYPTORANK_API_KEY is not configured")
    query = urllib.parse.urlencode({"limit": min(max(limit, 1), 100), "sortBy": "lastStatusUpdate", "sortDirection": "DESC"})
    raw = _get(f"{CRYPTORANK_URL}?{query}", {"X-Api-Key": api_key, "Accept": "application/json"})
    return json.loads(raw.decode("utf-8")).get("data", [])


class _TableParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True); self.rows=[]; self._row=None; self._links=[]; self._cell=False; self._anchor=False; self._href=""; self._text=[]
    def handle_starttag(self, tag, attrs):
        attrs_map=dict(attrs)
        if tag=="tr": self._row=[]; self._links=[]
        elif tag in {"td","th"} and self._row is not None: self._cell=True; self._text=[]
        elif tag=="a" and self._cell: self._anchor=True; self._href=attrs_map.get("href") or ""
    def handle_data(self, data):
        if self._cell: self._text.append(data)
    def handle_endtag(self, tag):
        if tag=="a" and self._anchor:
            if self._href: self._links.append(self._href)
            self._anchor=False; self._href=""
        elif tag in {"td","th"} and self._cell and self._row is not None:
            self._row.append(re.sub(r"\s+", " ", " ".join(self._text)).strip()); self._cell=False
        elif tag=="tr" and self._row is not None:
            if self._row and len(self._row)>=2: self.rows.append({"cells":self._row,"links":self._links})
            self._row=None


def fetch_incrypted(category: str = "testnet") -> list[dict[str, Any]]:
    parser=_TableParser(); parser.feed(_get(INCRYPTED_URLS.get(category, INCRYPTED_URLS["all"])).decode("utf-8", errors="ignore")); return parser.rows


def _slug(value: str) -> str: return re.sub(r"[^a-zA-Z0-9]+", "-", value.lower()).strip("-")[:70] or "unknown"


def _category(activity: str) -> str:
    value=activity.lower()
    for key in ("testnet","node","trading","staking","nft","content","mainnet","task"):
        if key in value: return "quest" if key=="task" else key
    return "other"


def _tasks_for(category: str, project: str) -> list[dict[str, Any]]:
    task_map={"testnet":("MANUAL","Perform eligible testnet activity"),"node":("NODE","Run or maintain the project node"),"trading":("SWAP","Perform the eligible trading activity"),"staking":("STAKE","Perform the eligible staking activity"),"quest":("MANUAL","Complete the listed project tasks"),"nft":("MANUAL","Complete the eligible NFT activity")}
    task_type,title=task_map.get(category,("MANUAL","Review and complete the listed activity"))
    return [{"id":f"{_slug(project)}-action","title":title,"task_type":task_type,"required":True,"automated":False},{"id":f"{_slug(project)}-proof","title":"Save completion proof","task_type":"SUBMIT_PROOF","required":True,"automated":False}]


def _score(reward: str, cost: float, minutes: int, risk: int, confidence: int, strategic: int) -> int:
    reward_l=reward.lower(); reward_value=35 if any(x in reward_l for x in ("$","usdc","usdt","eth","token")) else (12 if reward_l in {"unknown","невідомо",""} else 27)
    score=reward_value + confidence*0.25 + strategic*0.25 - min(20,round(cost*2)) - min(15,round(minutes/30)) - round(risk*0.25)
    return max(0,min(100,round(score)))


def normalize_cryptorank(item: dict[str, Any]) -> dict[str, Any]:
    coin=item.get("coin") or {}; name=coin.get("name") or item.get("key") or f"Activity {item.get('id','unknown')}"; reward=item.get("reward") or "Unknown"; links=item.get("links") or {}; tasks=item.get("tasks") or []
    minutes=max([int(t.get("timeMinutes") or 0) for t in tasks] or [20]); cost=max([float(str(t.get("cost") or 0).replace(",",".")) for t in tasks] or [0.0]); chains=[]
    for task in tasks:
        for chain in task.get("blockchains") or []:
            if chain.get("name") and chain["name"] not in chains: chains.append(chain["name"])
    status=str(item.get("status") or "UNKNOWN").lower(); risk=20 if status in {"confirmed","reward_available","distributed"} else 35; confidence=90; strategic=75
    return {"id":f"cryptorank-{item.get('id',_slug(str(name)))}","project":name,"category":"airdrop","chain":", ".join(chains) or "multi-chain","reward":reward,"deadline":"Unknown","source":"CryptoRank","source_url":"https://cryptorank.io/drophunting","external_url":links.get("claim") or links.get("verify") or "https://cryptorank.io/drophunting","official_url":links.get("claim") or links.get("verify") or "https://cryptorank.io/drophunting","estimated_cost":cost,"estimated_time_minutes":minutes,"risk_score":risk,"source_confidence":confidence,"strategic_value":strategic,"opportunity_score":_score(reward,cost,minutes,risk,confidence,strategic),"eligibility":["Check CryptoRank task requirements"],"tasks":_tasks_for("airdrop",name),"source_status":status}


def normalize_incrypted(row: dict[str, Any], category_hint: str = "testnet") -> dict[str, Any] | None:
    cells=row.get("cells") or []
    if len(cells)<3: return None
    name=cells[0].strip(); status=cells[1].strip() if len(cells)>1 else ""
    if not name or name.lower() in {"назва","name"}: return None
    if status and not any(word in status.lower() for word in ("актуальні","current","active")): return None
    reward=cells[2].strip() or "Unknown"; activity=cells[3].strip() if len(cells)>3 else category_hint; deadline=cells[4].strip() if len(cells)>4 else "Unknown"; networks=cells[5].strip() if len(cells)>5 else "Unknown"; rating=cells[6].strip() if len(cells)>6 else "0"
    href=next((x for x in row.get("links",[]) if x and not x.startswith("#")),"")
    if href.startswith("/"): href="https://incrypted.com"+href
    elif not href.startswith("http"): href="https://incrypted.com/ua/airdrops/"
    category=_category(activity)
    try: rating_num=int(re.search(r"-?\d+",rating).group(0))
    except (AttributeError,ValueError): rating_num=0
    risk=max(10,min(70,40-rating_num*3)); confidence=80; strategic=75 if category in {"testnet","node"} else 60
    return {"id":f"incrypted-{_slug(name)}","project":name,"category":category,"chain":networks or "Unknown","reward":reward,"deadline":deadline or "Unknown","source":"INCRYPTED","source_url":href,"external_url":href,"official_url":href,"estimated_cost":0.0,"estimated_time_minutes":20,"risk_score":risk,"source_confidence":confidence,"strategic_value":strategic,"opportunity_score":_score(reward,0,20,risk,confidence,strategic),"eligibility":["Open source activity details before acting"],"tasks":_tasks_for(category,name),"source_status":"current"}


def discover_live_opportunities() -> tuple[list[dict[str, Any]], dict[str, Any]]:
    items=[]; status={"cryptorank":"not_run","incrypted":"not_run","errors":[]}
    try: items.extend(normalize_cryptorank(x) for x in fetch_cryptorank()); status["cryptorank"]="ok"
    except Exception as exc: status["cryptorank"]="unavailable"; status["errors"].append(f"CryptoRank: {exc}")
    for category in ("testnet","nodes","tasks"):
        try:
            for row in fetch_incrypted(category):
                item=normalize_incrypted(row,category)
                if item: items.append(item)
            status["incrypted"]="ok"
        except Exception as exc:
            status["incrypted"]="partial" if status["incrypted"]=="ok" else "unavailable"; status["errors"].append(f"INCRYPTED/{category}: {exc}")
    dedup={}
    for item in items:
        key=re.sub(r"[^a-z0-9]","",item["project"].lower())
        if key and key not in dedup: dedup[key]=item
    return list(dedup.values()),status
