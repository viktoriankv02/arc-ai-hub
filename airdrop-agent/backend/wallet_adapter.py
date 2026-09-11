from __future__ import annotations
import re
from dataclasses import asdict, dataclass
from datetime import datetime, timezone

EVM_ADDRESS_RE=re.compile(r"^0x[a-fA-F0-9]{40}$")
@dataclass(frozen=True)
class Chain:
    key:str; name:str; chain_id:int
CHAINS={"ethereum":Chain("ethereum","Ethereum",1),"arc-testnet":Chain("arc-testnet","ARC Testnet",57001)}
def validate_address(address:str)->bool:return bool(EVM_ADDRESS_RE.fullmatch((address or "").strip()))
def normalize_address(address:str)->str:
    a=(address or "").strip()
    if not validate_address(a): raise ValueError("Invalid EVM wallet address")
    return a.lower()
def chains_info():return [asdict(c) for c in CHAINS.values()]
def wallet_status(address:str,chains:list[str])->dict:
    selected=[]
    for key in chains:
        if key not in CHAINS: raise ValueError(f"Unsupported chain: {key}")
        selected.append(asdict(CHAINS[key]))
    return {"address":normalize_address(address),"chains":selected,"checked_at":datetime.now(timezone.utc).isoformat()}
