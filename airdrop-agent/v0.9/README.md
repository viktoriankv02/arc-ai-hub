# ARC AI HUB — Drop Hunter v0.9

v0.9 changes the active product priority from on-chain AI Job execution to the **Drop Hunter / Web3 Rewards Engine**. The existing AI Job / scheduler code remains in the repository but is intentionally not part of the active workflow.

## Active product flow

1. Discovery Agent finds airdrops, testnets, points programs, bounties and quests.
2. Research & Risk Agent normalizes the source, estimates risk/cost/time and calculates an Opportunity Score.
3. Task Planner Agent converts conditions into a deterministic checklist.
4. Execution Agent builds a safe execution plan and stops at explicit approval gates.
5. Browser Planner maps supported tasks to controlled browser actions; v0.9 is plan-only and does not silently click, sign or broadcast.
6. Learning & Memory Agent stores task outcomes and feedback without storing secrets.
7. Contract Lab prepares supported deployment plans while wallet signing remains approval-gated.

## Sources

- CryptoRank Drophunting API: `https://api.cryptorank.io/v2/drophunting/activities`
- INCRYPTED airdrop index: `https://incrypted.com/en/airdrops/`
- INCRYPTED testnet index: `https://incrypted.com/en/airdrops/activity-testnet/`
- Galxe, Zealy, TaskOn and QuestN/Intract are registered as planned user-session adapters.

Set `CRYPTORANK_API_KEY` in the backend environment to enable live CryptoRank discovery. Without the key, the system still works in local/demo mode and can ingest public INCRYPTED index pages.

## API additions in v0.9.x

- `GET /api/hunter/opportunities/{id}/execution-plan`
- `GET /api/hunter/opportunities/{id}/browser-plan`
- `GET /api/hunter/memory`
- `GET /api/hunter/sources`
- `GET /api/hunter/execution-policy`

## Safety model

Automatic: public reading, discovery, eligibility checks, task parsing, scoring, reminders and proof recording.

Approval required: wallet connections, signatures, transactions, spending funds, authenticated social actions, claims and contract deployments.

User only: CAPTCHA and sensitive authentication flows.

Never store seed phrases, private keys, exchange passwords or 2FA secrets.

## Local run

Backend:

```powershell
cd D:\Projects\arc-ai-hub-dev\ARC_AI_HUB_Airdrop_Agent_v0_9
python -m venv backend\.venv
.\backend\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
.\backend\.venv\Scripts\python.exe -m uvicorn backend.main:app --reload --port 8000
```

Frontend:

```powershell
cd D:\Projects\arc-ai-hub-dev\ARC_AI_HUB_Airdrop_Agent_v0_9\frontend
npm install
npm run dev
```

API: `http://127.0.0.1:8000`
Swagger: `http://127.0.0.1:8000/docs`
