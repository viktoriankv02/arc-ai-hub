from __future__ import annotations
import re
from dataclasses import asdict, dataclass
from datetime import datetime, timezone

EVM_ADDRESS_RE = re.compile(r"^0x[a-fA-F0-9]{40}$")

@dataclass(frozen=True)
class ChainConfig:
    key: str
    name: str
    chain_id: int
    rpc_url: str
    explorer_url: str

CHAINS = {
    "ethereum": ChainConfig("ethereum", "Ethereum", 1, "https://ethereum-rpc.publicnode.com", "https://etherscan.io"),
    "arc-testnet": ChainConfig("arc-testnet", "ARC Testnet", 57001, "https://rpc.testnet.arc.network", "https://testnet.arcscan.app"),
}

def validate_address(address: str) -> bool:
    return bool(EVM_ADDRESS_RE.fullmatch((address or "").strip()))

def normalize_address(address: str) -> str:
    address = (address or "").strip()
    if not validate_address(address):
        raise ValueError("Invalid EVM wallet address")
    return address.lower()

def get_chain(chain: str) -> dict:
    key = (chain or "").strip().lower()
    if key not in CHAINS:
        raise KeyError(f"Unsupported chain: {chain}")
    return asdict(CHAINS[key])

def wallet_status(address: str, chains: list[str]) -> dict:
    return {"address": normalize_address(address), "chains": [get_chain(c) for c in chains], "checked_at": datetime.now(timezone.utc).isoformat()}
