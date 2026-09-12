from __future__ import annotations

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from .agent_memory import build_memory_summary
from .browser_actions import build_browser_execution_plan
from .discovery_pipeline import run_discovery_pipeline
from .drop_hunter import agent_catalog, analyze_opportunity, approve_task, get_opportunities, get_opportunity, prepare_task, record_feedback
from .execution_engine import build_execution_plan
from .source_registry import source_catalog
from .task_adapters import adapter_catalog, classify_action

app = FastAPI(title='ARC AI HUB Drop Hunter', version='0.9.7')
app.add_middleware(CORSMiddleware, allow_origins=['*'], allow_credentials=True, allow_methods=['*'], allow_headers=['*'])

class FeedbackRequest(BaseModel):
    opportunity_id: str
    outcome: str = Field(min_length=1, max_length=80)
    note: str = Field(default='', max_length=2000)

class ApprovalRequest(BaseModel):
    approved: bool

@app.get('/api/health')
def health(): return {'ok': True, 'version': '0.9.7', 'mode': 'drop-hunter'}

@app.get('/api/hunter/stats')
def stats():
    items = get_opportunities()
    return {'total': len(items),'high_score': sum(1 for x in items if int(x.get('opportunity_score', 0)) >= 70),'testnets': sum(1 for x in items if str(x.get('category', '')).upper() == 'TESTNET'),'airdrops': sum(1 for x in items if str(x.get('category', '')).upper() == 'AIR_DROP'),'approval_tasks': sum(1 for x in items for t in (x.get('tasks') or []) if t.get('approval_required'))}

@app.get('/api/hunter/agents')
def agents(): return {'agents': agent_catalog()}

@app.get('/api/hunter/sources')
def sources(): return {'sources': source_catalog()}

@app.get('/api/hunter/adapters')
def adapters(): return {'adapters': adapter_catalog()}

@app.post('/api/hunter/tasks/classify')
def classify_task(task: dict): return classify_action(task)

@app.get('/api/hunter/memory')
def memory(): return build_memory_summary()

@app.post('/api/hunter/scan')
def scan(): return run_discovery_pipeline()

@app.get('/api/hunter/opportunities')
def opportunities(category: str | None = Query(default=None), min_score: int = Query(default=0, ge=0, le=100), status: str | None = Query(default=None)):
    return {'items': get_opportunities(category=category, min_score=min_score, status=status)}

@app.get('/api/hunter/opportunities/{opportunity_id}')
def opportunity(opportunity_id: str):
    item = get_opportunity(opportunity_id)
    if not item: raise HTTPException(404, 'Opportunity not found')
    return item

@app.post('/api/hunter/opportunities/{opportunity_id}/analyze')
def analyze(opportunity_id: str):
    try: return analyze_opportunity(opportunity_id)
    except KeyError as exc: raise HTTPException(404, str(exc))

@app.get('/api/hunter/opportunities/{opportunity_id}/execution-plan')
def execution_plan(opportunity_id: str):
    item = get_opportunity(opportunity_id)
    if not item: raise HTTPException(404, 'Opportunity not found')
    return build_execution_plan(item)

@app.get('/api/hunter/opportunities/{opportunity_id}/browser-plan')
def browser_plan(opportunity_id: str):
    item = get_opportunity(opportunity_id)
    if not item: raise HTTPException(404, 'Opportunity not found')
    return build_browser_execution_plan(item)

@app.post('/api/hunter/opportunities/{opportunity_id}/tasks/{task_id}/prepare')
def prepare(opportunity_id: str, task_id: str):
    try: return prepare_task(opportunity_id, task_id)
    except KeyError as exc: raise HTTPException(404, str(exc))

@app.post('/api/hunter/opportunities/{opportunity_id}/tasks/{task_id}/approve')
def approve(opportunity_id: str, task_id: str, req: ApprovalRequest):
    try: return approve_task(opportunity_id, task_id, req.approved)
    except KeyError as exc: raise HTTPException(404, str(exc))

@app.post('/api/hunter/feedback')
def feedback(req: FeedbackRequest): return {'ok': True, 'record': record_feedback(req.opportunity_id, req.outcome, req.note)}

@app.get('/api/hunter/execution-policy')
def execution_policy():
    return {'automatic': ['public_read','eligibility_check','task_parsing','scoring','reminders','proof_recording'],'approval_required': ['wallet_connection','signature','transaction','spending_funds','authenticated_social_action','claim','contract_deployment'],'user_only': ['captcha','seed_phrase','private_key','2fa','exchange_password'],'never_store': ['seed_phrase','private_key','exchange_password','2fa_secret']}

@app.get('/api/hunter/contract-lab/chains')
def contract_lab_chains():
    return {'chains': [
        {'key':'arc-testnet','name':'ARC Testnet','chain_id':57001,'deployment':'approval_required'},
        {'key':'ethereum','name':'Ethereum','chain_id':1,'deployment':'approval_required'},
        {'key':'base','name':'Base','chain_id':8453,'deployment':'approval_required'},
        {'key':'arbitrum','name':'Arbitrum One','chain_id':42161,'deployment':'approval_required'},
        {'key':'optimism','name':'OP Mainnet','chain_id':10,'deployment':'approval_required'},
        {'key':'scroll','name':'Scroll','chain_id':534352,'deployment':'approval_required'},
        {'key':'linea','name':'Linea','chain_id':59144,'deployment':'approval_required'},
        {'key':'zksync','name':'zkSync Era','chain_id':324,'deployment':'approval_required'},
    ]}
