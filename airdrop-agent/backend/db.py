import json, sqlite3
from pathlib import Path

DB_PATH=Path(__file__).resolve().parent/'arc_ai_hub.db'
def connect():
    c=sqlite3.connect(DB_PATH); c.row_factory=sqlite3.Row; return c

def init_db():
    with connect() as c:
        c.executescript('''
        CREATE TABLE IF NOT EXISTS opportunities(id TEXT PRIMARY KEY,data TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS wallet_profile(id INTEGER PRIMARY KEY CHECK(id=1),data TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS tasks(opportunity_id TEXT,task_id TEXT,status TEXT,PRIMARY KEY(opportunity_id,task_id));
        CREATE TABLE IF NOT EXISTS approvals(id INTEGER PRIMARY KEY AUTOINCREMENT,data TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS proofs(id INTEGER PRIMARY KEY AUTOINCREMENT,data TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS rewards(id INTEGER PRIMARY KEY AUTOINCREMENT,data TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS notifications(id INTEGER PRIMARY KEY AUTOINCREMENT,data TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS queue_items(id INTEGER PRIMARY KEY AUTOINCREMENT,data TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS transaction_proposals(id INTEGER PRIMARY KEY AUTOINCREMENT,proposal_id TEXT UNIQUE NOT NULL,data TEXT NOT NULL);
        ''')

def save_opportunity(op):
    with connect() as c:c.execute('INSERT OR REPLACE INTO opportunities(id,data) VALUES(?,?)',(op.id,op.model_dump_json()))
def list_opportunities():
    from .models import Opportunity
    with connect() as c: rows=c.execute('SELECT data FROM opportunities').fetchall()
    return [Opportunity.model_validate_json(r['data']) for r in rows]
def get_opportunity(oid):
    from .models import Opportunity
    with connect() as c:r=c.execute('SELECT data FROM opportunities WHERE id=?',(oid,)).fetchone()
    return Opportunity.model_validate_json(r['data']) if r else None
def save_wallet(w):
    with connect() as c:c.execute('INSERT OR REPLACE INTO wallet_profile(id,data) VALUES(1,?)',(w.model_dump_json(),))
def get_wallet():
    from .models import WalletProfile
    with connect() as c:r=c.execute('SELECT data FROM wallet_profile WHERE id=1').fetchone()
    return WalletProfile.model_validate_json(r['data']) if r else None
def set_task_status(oid,tid,status):
    with connect() as c:c.execute('INSERT OR REPLACE INTO tasks(opportunity_id,task_id,status) VALUES(?,?,?)',(oid,tid,status))
def append_record(table,data):
    if table not in {'approvals','proofs','rewards','notifications','queue_items'}: raise ValueError('invalid table')
    with connect() as c:c.execute(f'INSERT INTO {table}(data) VALUES(?)',(json.dumps(data,ensure_ascii=False),))
def list_records(table):
    if table not in {'approvals','proofs','rewards','notifications','queue_items'}: raise ValueError('invalid table')
    with connect() as c:rows=c.execute(f'SELECT data FROM {table} ORDER BY id DESC').fetchall()
    return [json.loads(r['data']) for r in rows]
def save_queue(items):
    with connect() as c:
        c.execute('DELETE FROM queue_items')
        for i in items:c.execute('INSERT INTO queue_items(data) VALUES(?)',(json.dumps(i,ensure_ascii=False),))
def save_tx(data):
    with connect() as c:c.execute('INSERT OR REPLACE INTO transaction_proposals(proposal_id,data) VALUES(?,?)',(data['proposal_id'],json.dumps(data,ensure_ascii=False)))
def get_tx(pid):
    with connect() as c:r=c.execute('SELECT data FROM transaction_proposals WHERE proposal_id=?',(pid,)).fetchone()
    return json.loads(r['data']) if r else None
def list_tx():
    with connect() as c:rows=c.execute('SELECT data FROM transaction_proposals ORDER BY id DESC').fetchall()
    return [json.loads(r['data']) for r in rows]
