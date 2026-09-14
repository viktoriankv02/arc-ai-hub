# ARC AI HUB — Airdrop Agent v0.9

v0.9 turns the v0.8 safety shell into an interactive ARC Testnet control center. The frontend can verify the live RPC, inspect an EVM wallet balance, and create approval-only transaction proposals.

## Added in v0.9
- Live ARC Testnet JSON-RPC check
- Chain ID verification against 57001
- Current block number display
- Wallet balance inspection through `eth_getBalance`
- Persistent transaction proposal queue
- Backend API tests with pytest
- Responsive mobile/desktop control center
- DEMO MODE when the backend is offline

## Run backend on Windows PowerShell
```powershell
cd D:\Projects\arc-ai-hub-dev\ARC_AI_HUB_Airdrop_Agent_v0_8
python -m venv backend\.venv
.\backend\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
.\backend\.venv\Scripts\python.exe -m uvicorn backend.main:app --reload --port 8000
```

## Run backend tests
From the project root:
```powershell
.\backend\.venv\Scripts\python.exe -m pytest backend -q
```

## Run frontend
Open a second PowerShell:
```powershell
cd D:\Projects\arc-ai-hub-dev\ARC_AI_HUB_Airdrop_Agent_v0_8\frontend
npm install
npm run dev
```

Open the Vite URL shown in the terminal. The frontend uses `http://127.0.0.1:8000` for the local backend, or `VITE_API_BASE_URL` when configured.

## Frontend test flow
1. Open **Testnet Control Center**.
2. Confirm backend shows **ONLINE**.
3. Press **Перевірити RPC** and verify Chain ID `57001` and a current block number.
4. Enter an EVM wallet address.
5. Press **Перевірити адресу**.
6. Press **Баланс / RPC** and verify the returned ARC balance and block.
7. Press **Створити TEST proposal**.
8. Confirm the proposal appears in **Approval Queue** as `PENDING_APPROVAL`.
9. Press **Запустити UI test** and verify `Frontend interaction OK`.
10. Confirm that no private key, signature, or broadcast is requested.

## Safety boundary
This version does **not** store private keys or seed phrases and does not sign or broadcast transactions. A transaction is represented as a proposal and remains `PENDING_APPROVAL` until a future explicit approval/signing layer is implemented.

## Architecture
Discovery → Risk/Score → Orchestrator → Task Queue → Wallet/Chain Adapter → Transaction Proposal → Approval → Proof → Reward

## Next implementation target
v0.9.1 will add the first real **Opportunity Engine** layer: normalized opportunities, scoring, task checklists, source confidence, risk score, deadline, estimated cost/time, and a frontend opportunity board. No automatic wallet signing will be added without an explicit approval boundary.
