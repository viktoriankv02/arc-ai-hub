# ARC AI HUB — Airdrop Agent v0.8

v0.8 adds the Web3 safety boundary between the opportunity/task engine and wallet transactions.

## Added
- EVM wallet address validation
- Ethereum and ARC Testnet chain registry
- wallet validation/status API
- persistent transaction proposals
- risk classification for transaction proposals
- explicit `PENDING_APPROVAL` state
- responsive React/Vite Testnet Control Center
- DEMO MODE when backend is offline
- GitHub Pages deployment workflow

## Run backend
```powershell
cd airdrop-agent/v0.8
python -m venv backend/.venv
./backend/.venv/Scripts/python.exe -m pip install -r backend/requirements.txt
./backend/.venv/Scripts/python.exe -m uvicorn backend.main:app --reload --port 8000
```

## Run frontend
```powershell
cd airdrop-agent/v0.8/frontend
npm install
npm run dev
```

Open the Vite URL shown in the terminal. The frontend automatically uses `http://127.0.0.1:8000` for the local backend, or `VITE_API_BASE_URL` when configured.

## Safety
This version does **not** store private keys, seed phrases, sign transactions, or broadcast transactions. It only creates and stores proposals that require explicit user approval.

## Test flow
1. Open Testnet Control Center.
2. Confirm ARC Testnet status / Chain ID 57001.
3. Enter an EVM wallet address and validate it.
4. Create a TEST proposal.
5. Confirm it appears in Approval Queue as `PENDING_APPROVAL`.
6. Verify no signing or broadcast occurs.

## Architecture
Discovery → Risk/Score → Orchestrator → Task Queue → Wallet/Chain Adapter → Transaction Proposal → Approval → Proof → Reward
