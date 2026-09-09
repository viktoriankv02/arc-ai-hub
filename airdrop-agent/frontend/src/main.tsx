import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import "./style.css";

type Task = { id: string; title: string; type: string; approval_required: boolean; status?: string };
type Opportunity = {
  id: string; project: string; category: string; chain: string; reward: string;
  source: string; final_score: number; opportunity_score?: number; priority: string;
  freshness_score: number; risk_score: number; risk_verdict: string; scam_signals: string[]; tasks: Task[];
};
type QueueItem = { rank: number; project: string; task: string; task_type: string; priority: number; approval_required: boolean };

type ApiState = "demo" | "online";
const API = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");
const demo: Opportunity[] = [
  { id:"tempo-superboard", project:"Tempo Superboard", category:"TESTNET", chain:"Tempo", reward:"Points / potential future rewards", source:"INCRYPTED", final_score:88, opportunity_score:82, priority:"HIGH", freshness_score:92, risk_score:18, risk_verdict:"PASS", scam_signals:[], tasks:[
    {id:"tempo-research",title:"Review campaign rules",type:"INFORMATIONAL",approval_required:false,status:"TODO"},
    {id:"tempo-discord",title:"Join project Discord",type:"JOIN_DISCORD",approval_required:true,status:"TODO"}
  ]},
  { id:"overlayer-testnet", project:"Overlayer", category:"TESTNET", chain:"Ethereum", reward:"Points / potential token allocation", source:"INCRYPTED", final_score:84, opportunity_score:78, priority:"HIGH", freshness_score:78, risk_score:25, risk_verdict:"PASS", scam_signals:[], tasks:[
    {id:"overlayer-wallet",title:"Connect wallet",type:"CONNECT_WALLET",approval_required:true,status:"TODO"},
    {id:"overlayer-manual",title:"Complete campaign actions",type:"MANUAL",approval_required:true,status:"TODO"}
  ]},
  { id:"example-points", project:"Example Points Program", category:"POINTS", chain:"Ethereum", reward:"Points", source:"DEMO", final_score:53, opportunity_score:54, priority:"LOW", freshness_score:45, risk_score:35, risk_verdict:"REVIEW", scam_signals:[], tasks:[
    {id:"points-swap",title:"Example swap",type:"SWAP",approval_required:true,status:"TODO"}
  ]}
];

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, init);
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}

function App() {
  const [ops, setOps] = useState<Opportunity[]>(demo);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [apiState, setApiState] = useState<ApiState>(API ? "online" : "demo");
  const [selected, setSelected] = useState<Opportunity>(demo[0]);
  const [message, setMessage] = useState("Demo mode: connect a deployed backend to enable live data.");
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    if (!API) { setApiState("demo"); return; }
    setBusy(true);
    try {
      const [o, q] = await Promise.all([
        api<Opportunity[]>("/api/opportunities"),
        api<{items:QueueItem[]}>("/api/queue?limit=20")
      ]);
      setOps(o); setQueue(q.items ?? []);
      setSelected(current => o.find(x => x.id === current.id) ?? o[0] ?? demo[0]);
      setApiState("online"); setMessage("Live backend connected.");
    } catch (e) {
      setApiState("demo"); setMessage(`Backend unavailable — demo data is shown. ${String(e)}`);
      setOps(demo); setQueue([]); setSelected(demo[0]);
    } finally { setBusy(false); }
  };

  useEffect(() => { void refresh(); }, []);

  const high = useMemo(() => ops.filter(x => x.priority === "HIGH").length, [ops]);
  const blocked = useMemo(() => ops.filter(x => x.risk_verdict === "BLOCK").length, [ops]);

  const runOrchestrator = async () => {
    if (!API) { setMessage("Demo mode: Orchestrator becomes active when a backend URL is configured."); return; }
    await api("/api/orchestrator/run?limit=20", { method:"POST" });
    setMessage("Orchestrator queue rebuilt."); await refresh();
  };

  const scheduler = async (action: "start"|"stop") => {
    if (!API) { setMessage("Demo mode: Scheduler needs a deployed backend."); return; }
    await api(`/api/scheduler/${action}`, { method:"POST" });
    setMessage(action === "start" ? "Scheduler started." : "Scheduler stopped."); await refresh();
  };

  const taskAction = async (task: Task) => {
    if (!selected || !API) {
      setMessage("Demo mode: no real wallet or transaction is being touched."); return;
    }
    if (task.approval_required) {
      await api("/api/approval", { method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({opportunity_id:selected.id,task_id:task.id,action:task.type,approved:false,note:"Awaiting explicit user approval"}) });
      setMessage("Approval recorded. No signature or transaction was executed.");
    } else {
      await api("/api/task-status", { method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({opportunity_id:selected.id,task_id:task.id,status:"DONE"}) });
      setMessage(`Completed: ${task.title}`); await refresh();
    }
  };

  return <main>
    <header>
      <div><div className="eyebrow">ARC AI HUB · AIRDROP AGENT</div><h1>Web3 Opportunity Engine</h1><p>Discover · Evaluate · Prioritize · Act safely</p></div>
      <div className="headerRight"><span className={`status ${apiState}`}>{apiState === "online" ? "● LIVE BACKEND" : "● DEMO MODE"}</span>
        <div className="actions"><button onClick={runOrchestrator}>▶ Orchestrator</button><button onClick={()=>scheduler("start")}>Scheduler ON</button><button onClick={()=>scheduler("stop")}>Scheduler OFF</button><button onClick={refresh}>{busy?"Updating…":"↻ Refresh"}</button></div>
      </div>
    </header>
    <div className="notice">{message}</div>
    <section className="stats"><div><b>{ops.length}</b><span>opportunities</span></div><div><b>{high}</b><span>high priority</span></div><div><b>{queue.length}</b><span>queued tasks</span></div><div><b>{blocked}</b><span>blocked</span></div></section>
    <section className="layout"><div><div className="sectionTitle"><h2>Opportunities</h2><span>{ops.length ? "Ranked by opportunity score" : "No data"}</span></div><div className="grid">{ops.map(o=><article key={o.id} className={`card ${selected.id===o.id?"active":""}`} onClick={()=>setSelected(o)}><div className="row"><span className={`tag ${o.priority.toLowerCase()}`}>{o.priority}</span><strong>{(o.final_score||o.opportunity_score||0).toFixed(1)}</strong></div><h3>{o.project}</h3><p>{o.reward}</p><div className="meta"><span>{o.category}</span><span>{o.source}</span><span>Risk {o.risk_score}</span></div></article>)}</div></div>
    <aside className="panel"><div className="eyebrow">PERSONAL QUEUE</div><h2>Next actions</h2>{queue.length===0&&<p>No live queued tasks. In demo mode this area stays empty.</p>}{queue.slice(0,8).map(q=><div className="queue" key={`${q.project}-${q.task}`}><b>#{q.rank}</b><span><strong>{q.project}</strong><small>{q.task}</small></span>{q.approval_required&&<em>APPROVAL</em>}</div>)}<div className="divider"/><div className="eyebrow">SELECTED</div><h2>{selected.project}</h2><div className="score">{(selected.final_score||selected.opportunity_score||0).toFixed(1)}</div><p>Risk {selected.risk_score}/100 · Freshness {selected.freshness_score}/100 · {selected.risk_verdict}</p>{selected.scam_signals.length>0&&<div className="warning">⚠ {selected.scam_signals.join(" · ")}</div>}<h3>Tasks</h3>{selected.tasks.map(t=><div className="task" key={t.id}><span>{t.title}<small>{t.type}</small></span><button onClick={()=>taskAction(t)}>{t.approval_required?"APPROVAL":"DONE"}</button></div>)}</aside></section>
    <footer>Safety Gate ACTIVE · Private keys never stored · Transactions require explicit approval</footer>
  </main>;
}
createRoot(document.getElementById("root")!).render(<React.StrictMode><App/></React.StrictMode>);
