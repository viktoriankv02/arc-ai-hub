# ARC AI HUB — Airdrop Agent

Web3 Opportunity Engine for airdrops, testnets, bounties and points programs.

## Current release
- v0.7 Orchestrator / queue / scheduler architecture
- v0.8 wallet validation and transaction safety layer prepared
- production-ready frontend with demo fallback
- GitHub Pages deployment workflow

## Safety
The frontend never stores seed phrases or private keys. Transaction proposals must be explicitly approved and are not automatically signed or broadcast.

## Local development
```powershell
cd airdrop-agent\frontend
npm install
npm run dev
```

## API
Set `VITE_API_BASE_URL` to the deployed backend URL. When it is empty, the frontend automatically uses safe demo data so the public UI can be released before the backend is hosted.
