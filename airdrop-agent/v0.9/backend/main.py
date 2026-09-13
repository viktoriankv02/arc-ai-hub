from __future__ import annotations

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from .agent_memory import build_memory_summary
from .browser_actions import build_browser_execution_plan
from .browser_session import adapter_health, build_session_launch_plan
from .discovery_pipeline import run_discovery_pipeline
from .drop_hunter import agent_catalog, analyze_opportunity, approve_task, get_opportunities, get_opportunity, prepare_task, record_feedback
from .execution_engine import build_execution_plan
from .opportunity_intelligence import enrich_opportunities, research_opportunity
from .proof_engine import build_proof_summary, record_proof, record_reward_event, reward_events, task_proofs
from .source_registry import source_catalog
from .task_adapters import adapter_catalog, classify_action
from .task_intelligence import enrich_tasks, task_fingerprint
from .task_orchestrator import sync_opportunity, sync_task
from .task_state_machine import get_task_state, list_task_states, recover_task, state_summary, transition_task

app = FastAPI(title='ARC AI HUB Drop Hunter', version='0.12.0')
app.add_middleware(CORSMiddleware, allow_origins=['*'], allow_credentials=True, allow_methods=['*'], allow_headers=['*'])

class FeedbackRequest(BaseModel):
    opportunity_id: str
    outcome: str = Field(min_length=1, max_length=80)
    note: str = Field(default='', max_length=2000)

class ApprovalRequest(BaseModel):
    approved: bool

class ProofRequest(BaseModel):
    task_id: str
    kind: str = Field(min_length=1, max_length=60)
    status: str = Field(default='RECORDED', min_length=1, max_length=30)
    evidence: dict = Field(default_factory=dict)

class RewardRequest(BaseModel):
    task_id: str | None = None
    event_type: str = Field(min_length=1, max_length=60)
    amount: str = ''
    asset: str = ''
    tx_hash: str = ''
    note: str = Field(default='', max_length=2000)

class StateTransitionRequest(BaseModel):
    target: str = Field(min_length=1, max_length=40)
    reason: str = Field(default='', max_length=1000)

@app.get('/api/health')
def health(): return {'ok': True, 'version': '0.12.0', 'mode': 'drop-hunter'}

@app.get('/api/hunter/stats')
def stats():
    items = get_opportunities()
    return {'total': len(items),'high_score': sum(1 for x in items if int(x.get('opportunity_score', 0)) >= 70),'testnets': sum(1 for x in items if str(x.get('category', '')).upper() == 'TESTNET'),'airdrops': sum(1 for x in items if str(x.get('category', '')).upper() == 'AIR_DROP'),'approval_tasks': sum(1 for x in items for t in (x.get('tasks') or []) if t.get('approval_required')),'high_priority': sum(1 for x in items if x.get('review_status') == 'HIGH_PRIORITY'),'low_confidence': sum(1 for x in items if x.get('review_status') == 'LOW_CONFIDENCE')}

@app.get('/api/hunter/agents')
def agents(): return {'agents': agent_catalog()}

@app.get('/api/hunter/sources')
def sources(): return {'sources': source_catalog()}

@app.get('/api/hunter/adapters')
def adapters(): return {'adapters': adapter_catalog()}

@app.get('/api/hunter/adapters/health')
def adapters_health(): return {'adapters': adapter_health(adapter_catalog())}

@app.post('/api/hunter/tasks/classify')
def classify_task(task: dict): return classify_action(task)

@app.post('/api/hunter/tasks/fingerprint')
def fingerprint_task(payload: dict):
    return task_fingerprint(str(payload.get('project') or 'unknown'), payload.get('task') or {}, int(payload.get('index') or 0))

@app.get('/api/hunter/memory')
def memory(): return build_memory_summary()

@app.post('/api/hunter/scan')
def scan(): return run_discovery_pipeline()

@app.get('/api/hunter/opportunities')
def opportunities(category: str | None = Query(default=None), min_score: int = Query(default=0, ge=0, le=100), status: str | None = Query(default=None)):
    return {'items': enrich_opportunities(get_opportunities(category=category, min_score=min_score, status=status))}

@app.get('/api/hunter/opportunities/{opportunity_id}')
def opportunity(opportunity_id: str):
    item = get_opportunity(opportunity_id)
    if not item: raise HTTPException(404, 'Opportunity not found')
    item = dict(item)
    item['tasks'] = enrich_tasks(str(item.get('project') or 'unknown'), item.get('tasks') or [])
    item['research'] = item.get('research') or research_opportunity(item)
    item['research_confidence'] = item['research']['research_confidence']
    item['review_status'] = item['research']['review_status']
    item['proof_summary'] = build_proof_summary(opportunity_id)
    sync_opportunity(opportunity_id, [str(t.get('id')) for t in (item.get('tasks') or [])])
    item['state_summary'] = state_summary(opportunity_id)
    return item

@app.get('/api/hunter/opportunities/{opportunity_id}/research')
def research(opportunity_id: str):
    item = get_opportunity(opportunity_id)
    if not item: raise HTTPException(404, 'Opportunity not found')
    return research_opportunity(item)

@app.get('/api/hunter/opportunities/{opportunity_id}/tasks-intelligence')
def tasks_intelligence(opportunity_id: str):
    item = get_opportunity(opportunity_id)
    if not item: raise HTTPException(404, 'Opportunity not found')
    return {'opportunity_id': opportunity_id, 'project': item.get('project'), 'tasks': enrich_tasks(str(item.get('project') or 'unknown'), item.get('tasks') or [])}

@app.get('/api/hunter/opportunities/{opportunity_id}/session-plan/{task_id}')
def session_plan(opportunity_id: str, task_id: str):
    item = get_opportunity(opportunity_id)
    if not item: raise HTTPException(404, 'Opportunity not found')
    task = next((t for t in (item.get('tasks') or []) if t.get('id') == task_id), None)
    if not task: raise HTTPException(404, 'Task not found')
    target = str(task.get('url') or item.get('official_url') or '')
    return build_session_launch_plan(target, task)

@app.get('/api/hunter/opportunities/{opportunity_id}/proof')
def proofs(opportunity_id: str, task_id: str | None = Query(default=None)):
    item = get_opportunity(opportunity_id)
    if not item: raise HTTPException(404, 'Opportunity not found')
    return {'summary': build_proof_summary(opportunity_id), 'proofs': task_proofs(opportunity_id, task_id)}

@app.post('/api/hunter/opportunities/{opportunity_id}/proof')
def add_proof(opportunity_id: str, req: ProofRequest):
    item = get_opportunity(opportunity_id)
    if not item: raise HTTPException(404, 'Opportunity not found')
    valid_tasks = {str(t.get('id')) for t in (item.get('tasks') or [])}
    if req.task_id not in valid_tasks: raise HTTPException(404, 'Task not found')
    result = record_proof(opportunity_id, req.task_id, req.kind, req.evidence, req.status)
    sync_task(opportunity_id, req.task_id)
    return result

@app.get('/api/hunter/opportunities/{opportunity_id}/rewards')
def rewards(opportunity_id: str):
    item = get_opportunity(opportunity_id)
    if not item: raise HTTPException(404, 'Opportunity not found')
    return {'opportunity_id': opportunity_id, 'events': reward_events(opportunity_id)}

@app.post('/api/hunter/opportunities/{opportunity_id}/rewards')
def add_reward_event(opportunity_id: str, req: RewardRequest):
    item = get_opportunity(opportunity_id)
    if not item: raise HTTPException(404, 'Opportunity not found')
    result = record_reward_event(opportunity_id, req.task_id, req.event_type, req.amount, req.asset, req.tx_hash, req.note)
    if req.task_id:
        sync_task(opportunity_id, req.task_id)
    return result

@app.get('/api/hunter/opportunities/{opportunity_id}/tasks/{task_id}/state')
def task_state(opportunity_id: str, task_id: str):
    item = get_opportunity(opportunity_id)
    if not item: raise HTTPException(404, 'Opportunity not found')
    valid_tasks = {str(t.get('id')) for t in (item.get('tasks') or [])}
    if task_id not in valid_tasks: raise HTTPException(404, 'Task not found')
    sync_task(opportunity_id, task_id)
    return get_task_state(opportunity_id, task_id)

@app.post('/api/hunter/opportunities/{opportunity_id}/tasks/{task_id}/sync')
def sync_one_task(opportunity_id: str, task_id: str):
    item = get_opportunity(opportunity_id)
    if not item: raise HTTPException(404, 'Opportunity not found')
    valid_tasks = {str(t.get('id')) for t in (item.get('tasks') or [])}
    if task_id not in valid_tasks: raise HTTPException(404, 'Task not found')
    return sync_task(opportunity_id, task_id)

@app.post('/api/hunter/opportunities/{opportunity_id}/sync')
def sync_all_tasks(opportunity_id: str):
    item = get_opportunity(opportunity_id)
    if not item: raise HTTPException(404, 'Opportunity not found')
    ids = [str(t.get('id')) for t in (item.get('tasks') or [])]
    return sync_opportunity(opportunity_id, ids)

@app.post('/api/hunter/opportunities/{opportunity_id}/tasks/{task_id}/state')
def change_task_state(opportunity_id: str, task_id: str, req: StateTransitionRequest):
    item = get_opportunity(opportunity_id)
    if not item: raise HTTPException(404, 'Opportunity not found')
    valid_tasks = {str(t.get('id')) for t in (item.get('tasks') or [])}
    if task_id not in valid_tasks: raise HTTPException(404, 'Task not found')
    try: return transition_task(opportunity_id, task_id, req.target, req.reason)
    except ValueError as exc: raise HTTPException(409, str(exc))

@app.post('/api/hunter/opportunities/{opportunity_id}/tasks/{task_id}/recover')
def recover_task_state(opportunity_id: str, task_id: str):
    item = get_opportunity(opportunity_id)
    if not item: raise HTTPException(404, 'Opportunity not found')
    valid_tasks = {str(t.get('id')) for t in (item.get('tasks') or [])}
    if task_id not in valid_tasks: raise HTTPException(404, 'Task not found')
    try: return recover_task(opportunity_id, task_id)
    except ValueError as exc: raise HTTPException(409, str(exc))

@app.get('/api/hunter/opportunities/{opportunity_id}/states')
def all_task_states(opportunity_id: str):
    item = get_opportunity(opportunity_id)
    if not item: raise HTTPException(404, 'Opportunity not found')
    return state_summary(opportunity_id)

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
    return {'automatic': ['public_read','eligibility_check','task_parsing','scoring','reminders','proof_recording'],'approval_required': ['wallet_connection','signature','transaction','spending_funds','authenticated_social_action','claim','contract_deployment','authenticated_browser_submit'],'user_only': ['captcha','seed_phrase','private_key','2fa','exchange_password'],'never_store': ['seed_phrase','private_key','exchange_password','2fa_secret','session_credentials']}

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
