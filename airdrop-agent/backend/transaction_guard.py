from __future__ import annotations
import re
from dataclasses import asdict,dataclass
from datetime import datetime,timezone
ADDR=re.compile(r"^0x[a-fA-F0-9]{40}$");HEX=re.compile(r"^0x[0-9a-fA-F]*$")
@dataclass
class Proposal:
    proposal_id:str;chain:str;to:str;value_wei:str;data:str;purpose:str;risk_level:str;approval_required:bool;status:str;created_at:str
    def dict(self):return asdict(self)
def make_proposal(proposal_id,chain,to,value_wei="0",data="0x",purpose=""):
    if not proposal_id:raise ValueError("proposal_id is required")
    if not ADDR.fullmatch(to or ""):raise ValueError("Invalid transaction recipient")
    if not str(value_wei).isdigit():raise ValueError("value_wei must be a non-negative integer string")
    if not HEX.fullmatch(data or ""):raise ValueError("data must be hex prefixed with 0x")
    value=int(value_wei); risk="HIGH" if value>0 and data!="0x" else "REVIEW" if value>0 or data!="0x" else "LOW"
    return Proposal(proposal_id,chain,to.lower(),str(value),data,purpose,risk,True,"PENDING_APPROVAL",datetime.now(timezone.utc).isoformat())
