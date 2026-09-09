from datetime import datetime, timezone
from enum import Enum
from pydantic import BaseModel, Field

class Category(str, Enum):
    AIRDROP="AIRDROP"; TESTNET="TESTNET"; BOUNTY="BOUNTY"; POINTS="POINTS"; NODE="NODE"; OTHER="OTHER"
class TaskType(str, Enum):
    INFORMATIONAL="INFORMATIONAL"; CONNECT_WALLET="CONNECT_WALLET"; FOLLOW_X="FOLLOW_X"; JOIN_DISCORD="JOIN_DISCORD"; BRIDGE="BRIDGE"; SWAP="SWAP"; DEPLOY="DEPLOY"; STAKE="STAKE"; NODE="NODE"; SUBMIT_PROOF="SUBMIT_PROOF"; CLAIM="CLAIM"; MANUAL="MANUAL"
class RewardStatus(str, Enum):
    UNKNOWN="UNKNOWN"; PENDING="PENDING"; CLAIMABLE="CLAIMABLE"; CLAIMED="CLAIMED"; DISTRIBUTED="DISTRIBUTED"
class Task(BaseModel):
    id:str; title:str; type:TaskType; cost_usd:float=0; time_minutes:int=0; approval_required:bool=False; status:str="TODO"; instructions:str=""
class Evidence(BaseModel):
    source:str; url:str; title:str=""; fetched_at:str|None=None; excerpt:str=""; confidence:float=0; official:bool=False
class Provenance(BaseModel):
    discovered_from:list[str]=Field(default_factory=list); source_urls:list[str]=Field(default_factory=list); evidence:list[Evidence]=Field(default_factory=list); last_checked_at:str|None=None
class Opportunity(BaseModel):
    id:str; project:str; category:Category; chain:str=""; reward:str=""; deadline:str|None=None; source:str=""; official_url:str=""; estimated_cost:float=0; estimated_time:int=0; risk_score:float=0; source_confidence:float=0; opportunity_score:float=0; final_score:float=0; priority:str="MEDIUM"; freshness_score:float=0; scam_signals:list[str]=Field(default_factory=list); risk_verdict:str="REVIEW"; fetched_at:str|None=None; normalized_title:str=""; canonical_url:str=""; aliases:list[str]=Field(default_factory=list); provenance:Provenance=Field(default_factory=Provenance); tasks:list[Task]=Field(default_factory=list); reward_status:RewardStatus=RewardStatus.UNKNOWN
class WalletProfile(BaseModel):
    address:str=Field(pattern=r"^0x[a-fA-F0-9]{40}$"); chains:list[str]=Field(default_factory=list); balance_usd:float=0; capital_limit:float=0
class TaskStatusUpdate(BaseModel):
    opportunity_id:str; task_id:str; status:str
class ApprovalRequest(BaseModel):
    opportunity_id:str; task_id:str; action:str; approved:bool=False; note:str=""
class ProofEvent(BaseModel):
    opportunity_id:str; task_id:str; proof_type:str; proof_value:str; note:str=""
class RewardEvent(BaseModel):
    opportunity_id:str; status:RewardStatus; amount:str=""; tx_hash:str=""; note:str=""
