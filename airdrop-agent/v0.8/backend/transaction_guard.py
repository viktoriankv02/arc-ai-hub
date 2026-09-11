from __future__ import annotations
import re
from dataclasses import asdict, dataclass
from datetime import datetime, timezone

ADDRESS_RE = re.compile(r"^0x[a-fA-F0-9]{40}$")
HEX_RE = re.compile(r"^0x[0-9a-fA-F]*$")

@dataclass
class TransactionProposal:
    proposal_id: str
    chain: str
    to: str
    value_wei: str
    data: str
    purpose: str
    risk_level: str
    approval_required: bool
    status: str
    created_at: str
    def as_dict(self):
        return asdict(self)

def make_proposal(proposal_id: str, chain: str, to: str, value_wei: str = "0", data: str = "0x", purpose: str = "") -> TransactionProposal:
    if not proposal_id:
        raise ValueError("proposal_id is required")
    if not ADDRESS_RE.fullmatch(to or ""):
        raise ValueError("Invalid transaction recipient")
    if not str(value_wei).isdigit():
        raise ValueError("value_wei must be a non-negative integer string")
    if not HEX_RE.fullmatch(data or ""):
        raise ValueError("data must be hex prefixed with 0x")
    value = int(value_wei)
    has_calldata = data != "0x"
    risk = "HIGH" if value > 0 and has_calldata else ("REVIEW" if value > 0 or has_calldata else "LOW")
    return TransactionProposal(proposal_id, chain, to.lower(), str(value), data, purpose, risk, True, "PENDING_APPROVAL", datetime.now(timezone.utc).isoformat())
