# ARC AI HUB — Airdrop Agent v0.8

v0.8 adds the Web3 safety boundary between the opportunity/task engine and wallet transactions.

## Added
- EVM wallet address validation
- Ethereum and ARC Testnet chain registry
- wallet validation/status API
- transaction proposal model
- risk classification for transaction proposals
- explicit `PENDING_APPROVAL` state

## Safety
This version does **not** store private keys, seed phrases, sign transactions, or broadcast transactions. It only creates and stores proposals that require explicit user approval.

## Architecture
Discovery → Risk/Score → Orchestrator → Task Queue → Wallet/Chain Adapter → Transaction Proposal → Approval → Proof → Reward
