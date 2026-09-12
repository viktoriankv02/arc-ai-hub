from __future__ import annotations
from dataclasses import asdict, dataclass
from urllib.parse import urlparse

@dataclass(frozen=True)
class TaskAdapter:
    id: str
    name: str
    hosts: tuple[str, ...]
    capabilities: tuple[str, ...]
    mode: str
    status: str

ADAPTERS = [
    TaskAdapter('galxe','Galxe',('galxe.com',),('discover','parse_quests','prepare_proof','browser_plan'),'USER_SESSION','PLANNED'),
    TaskAdapter('zealy','Zealy',('zealy.io',),('discover','parse_quests','prepare_proof','browser_plan'),'USER_SESSION','PLANNED'),
    TaskAdapter('taskon','TaskOn',('taskon.xyz',),('discover','parse_tasks','prepare_proof','browser_plan'),'USER_SESSION','PLANNED'),
    TaskAdapter('questn','QuestN / Intract',('questn.com','intract.io'),('discover','parse_tasks','prepare_proof','browser_plan'),'USER_SESSION','PLANNED'),
    TaskAdapter('soquest','SoQuest',('soquest.xyz',),('discover','parse_tasks','prepare_proof','browser_plan'),'USER_SESSION','PLANNED'),
    TaskAdapter('x','X / Twitter',('x.com','twitter.com'),('open_profile','prepare_follow','prepare_post'),'USER_SESSION','PLANNED'),
    TaskAdapter('discord','Discord',('discord.com','discord.gg'),('open_invite','prepare_join'),'USER_SESSION','PLANNED'),
    TaskAdapter('telegram','Telegram',('t.me','telegram.me','telegram.org'),('open_channel','prepare_join'),'USER_SESSION','PLANNED'),
]

def host_for(url: str) -> str:
    try:
        return (urlparse(url).hostname or '').lower().removeprefix('www.')
    except Exception:
        return ''

def adapter_for_url(url: str) -> TaskAdapter | None:
    host = host_for(url)
    for adapter in ADAPTERS:
        if host in adapter.hosts or any(host.endswith('.' + h) for h in adapter.hosts):
            return adapter
    return None

def adapter_catalog() -> list[dict]:
    return [asdict(x) for x in ADAPTERS]

def classify_action(task: dict) -> dict:
    url = str(task.get('url') or '')
    adapter = adapter_for_url(url)
    task_type = str(task.get('type') or 'MANUAL').upper()
    if adapter:
        return {'adapter': adapter.id, 'adapter_status': adapter.status, 'mode': 'USER_SESSION', 'task_type': task_type, 'url_host': host_for(url)}
    if task_type in {'CHECK_ELIGIBILITY','PARSE_TASKS','CALCULATE_SCORE','RECORD_PROOF','REMINDER'}:
        return {'adapter': 'core', 'adapter_status': 'READY', 'mode': 'AI_AUTO', 'task_type': task_type, 'url_host': host_for(url)}
    return {'adapter': None, 'adapter_status': 'NOT_MAPPED', 'mode': 'MANUAL', 'task_type': task_type, 'url_host': host_for(url)}
