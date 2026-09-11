from __future__ import annotations
import json
from pathlib import Path
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from .wallet_adapter import CHAINS, normalize_address, wallet_status
from .transaction_guard import make_proposal

app = FastAPI(title='ARC AI HUB Airdrop Agent v0.8', version='0.8.0')
app.add_middleware(CORSMiddleware, allow_origins=['*'], allow_credentials=True, allow_methods=['*'], allow_headers=['*'])
DATA = Path(__file__).resolve().parent / 'data'
DATA.mkdir(exist_ok=True)
TX_FILE = DATA / 'tx_proposals.json'

def load_tx():
    if not TX_FILE.exists(): return []
    try: return json.loads(TX_FILE.read_text(encoding='utf-8'))
    except Exception: return []

def save_tx(items):
    TX_FILE.write_text(json.dumps(items, ensure_ascii=False, indent=2), encoding='utf-8')

class WalletRequest(BaseModel):
    address: str
    chains: list[str] = Field(default_factory=lambda: ['arc-testnet'])

class TxRequest(BaseModel):
    proposal_id: str
    chain: str
    to: str
    value_wei: str = '0'
    data: str = '0x'
    purpose: str = ''

@app.get('/api/health')
def health(): return {'ok': True, 'version': '0.8.0', 'mode': 'approval-only'}

@app.get('/api/wallet/chains')
def chains(): return {'chains': [c.__dict__ for c in CHAINS.values()]}

@app.post('/api/wallet/validate')
def validate_wallet(req: WalletRequest):
    try: return {'ok': True, **wallet_status(req.address, req.chains)}
    except (ValueError, KeyError) as e: raise HTTPException(400, str(e))

@app.post('/api/tx/proposal')
def create_proposal(req: TxRequest):
    try: proposal = make_proposal(req.proposal_id, req.chain, req.to, req.value_wei, req.data, req.purpose)
    except (ValueError, KeyError) as e: raise HTTPException(400, str(e))
    items = load_tx()
    items = [x for x in items if x.get('proposal_id') != proposal.proposal_id]
    items.insert(0, proposal.as_dict())
    save_tx(items)
    return {'ok': True, 'proposal': proposal.as_dict()}

@app.get('/api/tx/proposals')
def proposals(): return {'items': load_tx()}

@app.get('/api/tx/proposal/{proposal_id}')
def proposal(proposal_id: str):
    for item in load_tx():
        if item.get('proposal_id') == proposal_id: return {'proposal': item}
    raise HTTPException(404, 'Proposal not found')

@app.get('/api/demo/testnet')
def demo_testnet():
    return {'network':'ARC Testnet','chain_id':57001,'rpc':'https://rpc.testnet.arc.network','explorer':'https://testnet.arcscan.app','status':'ready'}
