from contextlib import asynccontextmanager
from datetime import datetime, timezone
import asyncio, os, re
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from . import db
from .models import *

EVM=re.compile(r'^0x[a-fA-F0-9]{40}$')
SOURCES={'CryptoRank':92,'INCRYPTED':78,'OFFICIAL':98,'DEMO':45}

def now(): return datetime.now(timezone.utc).isoformat()
def source_conf(s): return SOURCES.get(s,55)
def freshness(ts):
    if not ts:return 45
    try: dt=datetime.fromisoformat(ts.replace('Z','+00:00'))
    except ValueError:return 35
    h=max(0,(datetime.now(timezone.utc)-dt.astimezone(timezone.utc)).total_seconds()/3600)
    return 100 if h<=6 else 92 if h<=24 else 78 if h<=72 else 60 if h<=168 else 40 if h<=720 else 20
def enrich(o):
    o.normalized_title=' '.join(re.sub(r'[^a-z0-9а-яіїєґ]+',' ',o.project.lower()).split())
    o.canonical_url=(o.official_url or '').split('#')[0].rstrip('/')
    o.source_confidence=source_conf(o.source); o.freshness_score=freshness(o.fetched_at)
    text=f'{o.project} {o.reward} {o.official_url}'.lower()
    signals=[f'Suspicious phrase: {x}' for x in ('seed phrase','private key','send funds to','guaranteed profit','double your','100x guaranteed') if x in text]
    o.scam_signals=signals; o.risk_verdict='BLOCK' if len(signals)>=2 else 'REVIEW' if signals else 'PASS'
    base=o.opportunity_score or 0
    o.final_score=max(0,min(100,round(base*.55+o.source_confidence*.15+o.freshness_score*.15-o.risk_score*.03-len(signals)*12,2)))
    o.priority='BLOCKED' if o.risk_verdict=='BLOCK' else 'HIGH' if o.final_score>=80 else 'MEDIUM' if o.final_score>=60 else 'LOW'
    return o

def seed():
    return [
      Opportunity(id='tempo-superboard',project='Tempo Superboard',category='TESTNET',chain='Tempo',reward='Points / potential future rewards',source='INCRYPTED',official_url='https://tempo.xyz/',estimated_time=35,risk_score=18,opportunity_score=82,tasks=[Task(id='tempo-research',title='Review campaign rules',type='INFORMATIONAL',time_minutes=10),Task(id='tempo-discord',title='Join project Discord',type='JOIN_DISCORD',approval_required=True)]),
      Opportunity(id='overlayer-testnet',project='Overlayer',category='TESTNET',chain='Ethereum',reward='Points / potential token allocation',source='INCRYPTED',official_url='https://overlayer.io/',estimated_time=45,risk_score=25,opportunity_score=78,tasks=[Task(id='overlayer-wallet',title='Connect wallet',type='CONNECT_WALLET',approval_required=True),Task(id='overlayer-manual',title='Complete campaign actions',type='MANUAL',time_minutes=30,approval_required=True)]),
      Opportunity(id='example-points',project='Example Points Program',category='POINTS',chain='Ethereum',reward='Points',source='DEMO',official_url='https://example.com/',estimated_cost=2,estimated_time=20,risk_score=35,opportunity_score=54,tasks=[Task(id='points-swap',title='Example swap',type='SWAP',approval_required=True)])
    ]

class Scheduler:
    def __init__(self): self.task=None; self.last_run=None
    async def scan(self):
        self.last_run=now(); return {'ok':True,'last_run':self.last_run,'mode':'scheduled'}
    async def loop(self):
        while True:
            await self.scan(); await asyncio.sleep(900)
    def start(self):
        if self.task is None or self.task.done(): self.task=asyncio.create_task(self.loop())
    async def stop(self):
        if self.task and not self.task.done(): self.task.cancel()
        self.task=None
    def status(self): return {'running':bool(self.task and not self.task.done()),'interval_seconds':900,'last_run':self.last_run}

scheduler=Scheduler()
@asynccontextmanager
async def lifespan(app):
    db.init_db()
    if not db.list_opportunities():
        for o in seed(): db.save_opportunity(enrich(o))
    yield
    await scheduler.stop()

app=FastAPI(title='ARC AI HUB — Airdrop Agent',version='0.8.0',lifespan=lifespan)
app.add_middleware(CORSMiddleware,allow_origins=['*'],allow_methods=['*'],allow_headers=['*'])

@app.get('/health')
def health(): return {'ok':True,'version':'0.8.0'}
@app.get('/api/opportunities')
def opportunities():
    items=[enrich(x) for x in db.list_opportunities()]; items.sort(key=lambda x:x.final_score,reverse=True)
    for x in items: db.save_opportunity(x)
    return items
@app.get('/api/queue')
def queue(limit:int=20):
    items=[enrich(x) for x in db.list_opportunities() if x.risk_verdict!='BLOCK']; rows=[]
    for o in items:
        for t in o.tasks:
            if t.status!='DONE': rows.append({'project':o.project,'opportunity_id':o.id,'task':t.title,'task_id':t.id,'task_type':t.type,'priority':o.final_score-(2 if t.approval_required else 0),'approval_required':t.approval_required})
    rows.sort(key=lambda x:x['priority'],reverse=True)
    for i,r in enumerate(rows[:max(1,min(limit,100))],1): r['rank']=i
    return {'count':len(rows[:limit]),'items':rows[:limit]}
@app.post('/api/orchestrator/run')
def orchestrator_run(limit:int=20): return queue(limit)
@app.get('/api/scheduler/status')
def scheduler_status(): return scheduler.status()
@app.post('/api/scheduler/start')
def scheduler_start(): scheduler.start(); return scheduler.status()
@app.post('/api/scheduler/stop')
async def scheduler_stop(): await scheduler.stop(); return scheduler.status()
@app.get('/api/notifications')
def notifications(): return {'unread':0,'items':db.list_records('notifications')}
@app.post('/api/approval')
def approval(x:ApprovalRequest): db.append_record('approvals',x.model_dump()); return {'ok':True,'recorded':True}
@app.post('/api/task-status')
def task_status(x:TaskStatusUpdate): db.set_task_status(x.opportunity_id,x.task_id,x.status); return {'ok':True}
@app.get('/api/evidence/{oid}')
def evidence(oid:str):
    o=db.get_opportunity(oid)
    if not o: raise HTTPException(404,'Opportunity not found')
    return o.provenance.model_dump()
@app.get('/api/wallet/chains')
def wallet_chains():
    return {'chains':[{'name':'Ethereum','chain_id':1},{'name':'ARC Testnet','chain_id':57001}]}
@app.post('/api/wallet/validate')
def wallet_validate(p:dict):
    a=str(p.get('address') or '')
    if not EVM.fullmatch(a): raise HTTPException(400,'Invalid EVM wallet address')
    return {'valid':True,'address':a.lower(),'chains':p.get('chains') or []}
@app.post('/api/tx/proposal')
def tx_proposal(p:dict):
    to=str(p.get('to') or ''); pid=str(p.get('proposal_id') or '')
    if not pid: raise HTTPException(400,'proposal_id is required')
    if not EVM.fullmatch(to): raise HTTPException(400,'Invalid transaction recipient')
    data={'proposal_id':pid,'chain':str(p.get('chain') or ''),'to':to.lower(),'value_wei':str(p.get('value_wei') or '0'),'data':str(p.get('data') or '0x'),'purpose':str(p.get('purpose') or ''),'status':'PENDING_APPROVAL','approval_required':True,'created_at':now()}
    db.save_tx(data); db.append_record('notifications',{'title':'Transaction proposal created','message':'Explicit approval required.','level':'WARNING','data':data,'created_at':now(),'read':False}); return data
@app.get('/api/tx/proposals')
def tx_proposals():
    x=db.list_tx(); return {'count':len(x),'items':x}
