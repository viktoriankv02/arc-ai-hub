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
    OpportunitySource(
        "cryptorank", "CryptoRank", "api", True, "api_key",
        "https://api.cryptorank.io/v2/drophunting/activities",
        "primary discovery and task metrics",
    ),
    OpportunitySource(
        "incrypted-airdrops", "INCRYPTED Airdrops", "html", True, "public",
        "https://incrypted.com/en/airdrops/",
        "secondary public discovery",
    ),
    OpportunitySource(
        "incrypted-testnets", "INCRYPTED Testnets", "html", True, "public",
        "https://incrypted.com/en/airdrops/activity-testnet/",
        "secondary testnet discovery",
    ),
    OpportunitySource(
        "galxe", "Galxe", "adapter", False, "user_session",
        "https://galxe.com/",
        "quest/task execution adapter - planned",
    ),
    OpportunitySource(
        "zealy", "Zealy", "adapter", False, "user_session",
        "https://zealy.io/",
        "quest/task execution adapter - planned",
    ),
    OpportunitySource(
        "taskon", "TaskOn", "adapter", False, "user_session",
        "https://taskon.xyz/",
        "quest/task execution adapter - planned",
    ),
    OpportunitySource(
        "questn", "QuestN / Intract", "adapter", False, "user_session",
        "https://questn.com/",
        "quest/task execution adapter - planned",
    ),
]


def source_catalog() -> list[dict]:
    return [asdict(x) for x in SOURCES]
