from __future__ import annotations
from typing import Any
from .proof_engine import reward_events, task_proofs
from .task_state_machine import get_task_state, transition_task

def sync_task_from_proof(opportunity_id: str, task_id: str) -> dict[str, Any]:
    state = get_task_state(opportunity_id, task_id)
    proofs = task_proofs(opportunity_id, task_id)
    verified = [p for p in proofs if str(p.get('status','')).upper() == 'VERIFIED']
    if verified and state['state'] == 'PROOF_PENDING':
        updated = transition_task(opportunity_id, task_id, 'VERIFIED', 'proof_engine verified evidence')
        return {'changed': True, 'state': updated, 'reason': 'verified_proof'}
    return {'changed': False, 'state': state, 'reason': 'proof_not_ready'}

def sync_task_from_reward(opportunity_id: str, task_id: str) -> dict[str, Any]:
    state = get_task_state(opportunity_id, task_id)
    events = [x for x in reward_events(opportunity_id) if str(x.get('task_id') or '') == task_id]
    confirmed = [x for x in events if str(x.get('event_type','')).upper() in {'RECEIVED','CLAIMED','REWARDED','CONFIRMED'}]
    if confirmed and state['state'] == 'REWARD_PENDING':
        updated = transition_task(opportunity_id, task_id, 'REWARDED', 'reward engine confirmed reward event')
        return {'changed': True, 'state': updated, 'reason': 'reward_confirmed'}
    return {'changed': False, 'state': state, 'reason': 'reward_not_ready'}

def sync_task(opportunity_id: str, task_id: str) -> dict[str, Any]:
    proof = sync_task_from_proof(opportunity_id, task_id)
    reward = sync_task_from_reward(opportunity_id, task_id)
    return {'opportunity_id': opportunity_id, 'task_id': task_id, 'changed': proof['changed'] or reward['changed'], 'proof_sync': proof, 'reward_sync': reward, 'state': get_task_state(opportunity_id, task_id)}

def sync_opportunity(opportunity_id: str, task_ids: list[str]) -> dict[str, Any]:
    results = [sync_task(opportunity_id, task_id) for task_id in task_ids]
    return {'opportunity_id': opportunity_id, 'changed': sum(1 for x in results if x['changed']), 'results': results}
