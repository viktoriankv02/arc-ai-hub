from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Literal

TaskType = Literal["CONNECT_WALLET", "FOLLOW_X", "JOIN_DISCORD", "BRIDGE", "SWAP", "DEPLOY", "STAKE", "NODE", "SUBMIT_PROOF", "CLAIM", "MANUAL"]

@dataclass(frozen=True)
class OpportunityTask:
    id: str
    title: str
    task_type: TaskType
    required: bool
    automated: bool

    def as_dict(self):
        return asdict(self)

@dataclass(frozen=True)
class Opportunity:
    id: str
    project: str
    category: str
    chain: str
    reward: str
    deadline: str
    source: str
    official_url: str
    estimated_cost: float
    estimated_time_minutes: int
    risk_score: int
    source_confidence: int
    strategic_value: int
    eligibility: list[str]
    tasks: tuple[OpportunityTask, ...]

    @property
    def opportunity_score(self) -> int:
        reward_value = 30 if self.reward != "Unknown" else 10
        cost_penalty = min(20, round(self.estimated_cost * 2))
        time_penalty = min(15, round(self.estimated_time_minutes / 30))
        risk_penalty = round(self.risk_score * 0.25)
        score = reward_value + self.source_confidence * 0.25 + self.strategic_value * 0.25 - cost_penalty - time_penalty - risk_penalty
        return max(0, min(100, round(score)))

    def as_dict(self):
        result = asdict(self)
        result["tasks"] = [task.as_dict() for task in self.tasks]
        result["opportunity_score"] = self.opportunity_score
        result["reward_status"] = "NOT_STARTED"
        return result

DEMO_OPPORTUNITIES = (
    Opportunity(
        id="arc-testnet-core", project="ARC", category="testnet", chain="arc-testnet",
        reward="Potential ecosystem rewards", deadline="Ongoing", source="Official project",
        official_url="https://arc.network/", estimated_cost=0, estimated_time_minutes=25,
        risk_score=15, source_confidence=95, strategic_value=95,
        eligibility=["EVM wallet", "ARC Testnet"],
        tasks=(
            OpportunityTask("arc-wallet", "Prepare EVM wallet", "CONNECT_WALLET", True, False),
            OpportunityTask("arc-action", "Perform eligible testnet action", "MANUAL", True, False),
            OpportunityTask("arc-proof", "Save transaction proof", "SUBMIT_PROOF", True, False),
        ),
    ),
    Opportunity(
        id="demo-zero-cost-quest", project="Demo Quest Network", category="quest", chain="ethereum",
        reward="Points / future rewards", deadline="Ongoing", source="Demo dataset",
        official_url="https://example.com/", estimated_cost=0, estimated_time_minutes=10,
        risk_score=20, source_confidence=70, strategic_value=55, eligibility=["EVM wallet"],
        tasks=(
            OpportunityTask("demo-x", "Follow project account", "FOLLOW_X", True, False),
            OpportunityTask("demo-discord", "Join community", "JOIN_DISCORD", False, False),
            OpportunityTask("demo-proof", "Record completion proof", "SUBMIT_PROOF", True, False),
        ),
    ),
)

def list_opportunities(category: str | None = None, chain: str | None = None, max_cost: float | None = None):
    items = DEMO_OPPORTUNITIES
    if category:
        items = tuple(x for x in items if x.category == category)
    if chain:
        items = tuple(x for x in items if x.chain == chain)
    if max_cost is not None:
        items = tuple(x for x in items if x.estimated_cost <= max_cost)
    return sorted((item.as_dict() for item in items), key=lambda x: x["opportunity_score"], reverse=True)

def get_opportunity(opportunity_id: str):
    for item in DEMO_OPPORTUNITIES:
        if item.id == opportunity_id:
            return item.as_dict()
    return None
