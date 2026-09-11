# ARC AI HUB Airdrop Agent v0.8

This release adds a public frontend path and a backend safety layer.

### Frontend
- responsive Web3 Opportunity Engine UI
- demo fallback when no backend URL is configured
- live API mode with `VITE_API_BASE_URL`
- GitHub Pages workflow

### Backend
- FastAPI API
- wallet address validation
- Ethereum + ARC Testnet chain registry
- transaction proposal records
- explicit approval requirement
- no private keys, automatic signing or automatic broadcasting

Local backend:
`run_backend.ps1`

Local frontend:
`run_frontend.ps1`
