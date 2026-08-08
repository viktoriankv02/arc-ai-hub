import React from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

function App() {
  const [status, setStatus] = React.useState<"loading" | "online" | "offline">("loading");
  const [chain, setChain] = React.useState<string>("-");
  const [block, setBlock] = React.useState<string>("-");

  React.useEffect(() => {
    fetch(`${API_URL}/api/health`)
      .then(async (response) => {
        if (!response.ok) throw new Error("Backend unavailable");
        return response.json();
      })
      .then((data) => {
        setStatus("online");
        setChain(data.chain.chainId);
        setBlock(String(data.chain.blockNumber));
      })
      .catch(() => setStatus("offline"));
  }, []);

  return (
    <main className="app">
      <header className="header">
        <div>
          <p className="eyebrow">ARC AI HUB</p>
          <h1>AI coordination dashboard</h1>
          <p className="subtitle">Jobs, agents, reputation and on-chain infrastructure.</p>
        </div>
        <span className={`status ${status}`}>
          {status === "online" ? "Backend online" : status === "offline" ? "Backend offline" : "Connecting..."}
        </span>
      </header>

      <section className="grid">
        <article className="card">
          <span>Network</span>
          <strong>Arc Testnet</strong>
          <small>Chain ID: {chain}</small>
        </article>
        <article className="card">
          <span>Latest block</span>
          <strong>{block}</strong>
          <small>Read through backend RPC</small>
        </article>
        <article className="card">
          <span>Platform</span>
          <strong>AI Jobs</strong>
          <small>Gateway → JobManager → Scheduler</small>
        </article>
      </section>

      <section className="panel">
        <h2>Platform modules</h2>
        <div className="modules">
          <div>AI Agents</div>
          <div>AI Jobs</div>
          <div>Compute Nodes</div>
          <div>Reputation</div>
          <div>Billing</div>
          <div>Rewards</div>
        </div>
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
