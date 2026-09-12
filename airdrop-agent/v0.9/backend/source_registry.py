from __future__ import annotations

from dataclasses import asdict, dataclass


@dataclass(frozen=True)
class OpportunitySource:
    id: str
    name: str
    kind: str
    enabled: bool
    auth: str
    url: str
    role: str


SOURCES = [
    OpportunitySource("cryptorank", "CryptoRank", "api", True, "api_key", "https://api.cryptorank.io/v2/drophunting/activities", "primary discovery and task metrics"),
    OpportunitySource("incrypted-airdrops", "INCRYPTED Airdrops", "html", True, "public", "https://incrypted.com/en/airdrops/", "secondary public discovery"),
    OpportunitySource("incrypted-testnets", "INCRYPTED Testnets", "html", True, "public", "https://incrypted.com/en/airdrops/activity-testnet/", "secondary testnet discovery"),
    OpportunitySource("galxe", "Galxe", "adapter", False, "user_session", "https://galxe.com/", "quest/task execution adapter"),
    OpportunitySource("zealy", "Zealy", "adapter", False, "user_session", "https://zealy.io/", "quest/task execution adapter"),
    OpportunitySource("taskon", "TaskOn", "adapter", False, "user_session", "https://taskon.xyz/", "quest/task execution adapter"),
    OpportunitySource("questn", "QuestN / Intract", "adapter", False, "user_session", "https://questn.com/", "quest/task execution adapter"),
    OpportunitySource("soquest", "SoQuest", "adapter", False, "user_session", "https://soquest.xyz/", "quest/task execution adapter"),
    OpportunitySource("coingecko", "CoinGecko", "market_data", False, "public_or_api", "https://www.coingecko.com/", "market, token and ecosystem context"),
    OpportunitySource("coinmarketcap", "CoinMarketCap", "market_data", False, "public_or_api", "https://coinmarketcap.com/", "market and project context"),
    OpportunitySource("github", "GitHub", "research", False, "public", "https://github.com/", "project development and repository activity"),
    OpportunitySource("reddit", "Reddit", "research", False, "public", "https://www.reddit.com/", "community and sentiment research"),
    OpportunitySource("youtube", "YouTube", "research", False, "public", "https://www.youtube.com/", "project announcements and walkthrough research"),
    OpportunitySource("telegram", "Telegram", "research", False, "user_session", "https://web.telegram.org/", "community/channel monitoring"),
    OpportunitySource("discord", "Discord", "research", False, "user_session", "https://discord.com/", "community/task monitoring"),
    OpportunitySource("x", "X / Twitter", "research", False, "user_session", "https://x.com/", "official announcements and social task discovery"),
]


def source_catalog() -> list[dict]:
    return [asdict(x) for x in SOURCES]


def enabled_sources() -> list[dict]:
    return [asdict(x) for x in SOURCES if x.enabled]


def source(key: str) -> OpportunitySource | None:
    normalized = (key or "").strip().lower()
    return next((x for x in SOURCES if x.id == normalized), None)
