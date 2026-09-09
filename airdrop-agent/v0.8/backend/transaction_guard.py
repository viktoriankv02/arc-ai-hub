from __future__ import annotations

from dataclasses import asdict, dataclass
from datetime import datetime, timezone
import re

ADDRESS_RE = re.compile(r"^0x[a-fA-F0-9]{40}$")
HEX_RE = re.compile(r"^0x[0-9a-fA-F]*$")


@dataclass
class TransactionProposal:
    proposal_id: str
    chain: str
    to: str
    value_wei: str = "0"
    data: str = "0x"
    purpose: str = ""
    risk_level: str = "REVIEW"
    approval_required: bool = True
    status: str = "PENDING_APPROVAL"
    created_at: str = ""

    def as_dict(self) -> dict:
        return asdict(self)


def make_proposal(
    proposal_id: str,
    chain: str,
    to: str,
    value_wei: str = "0",
    data: str = "0x",
    purpose: str = "",
) -> TransactionProposal:
    if not proposal_id:
        raise ValueError("proposal_id is required")
    if not ADDRESS_RE.fullmatch(to or ""):
        raise ValueError("Invalid transaction recipient")
    if not str(value_wei).isdigit():
        raise ValueError("value_wei must be a non-negative integer string")
    if not HEX_RE.fullmatch(data or ""):
        raise ValueError("data must be hex-prefixed")

    value = int(value_wei)
    has_calldata = data != "0x"
    if value > 0 and has_calldata:
        risk = "HIGH"
    elif value > 0 or has_calldata:
        risk = "REVIEW"
    else:
        risk = "LOW"

    return TransactionProposal(
        proposal_id=proposal_id,
        chain=chain,
        to=to.lower(),
        value_wei=str(value),
        data=data,
        purpose=purpose,
        risk_level=risk,
        approval_required=True,
        status="PENDING_APPROVAL",
        created_at=datetime.now(timezone.utc).isoformat(),
    )
