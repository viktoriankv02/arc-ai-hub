import React from "react";
import { createRoot } from "react-dom/client";
import { ethers } from "ethers";
import "./styles.css";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";
const GATEWAY_ADDRESS = import.meta.env.VITE_AI_API_GATEWAY_ADDRESS ?? "";

const gatewayAbi = [
  "function createRequest(uint256 serviceId,string payloadHash) returns (uint256)",
];

const statusNames = ["Created", "Scheduled", "Running", "Finished", "Failed", "Cancelled"];

function App() {
  const [status, setStatus] = React.useState("loading");
  const [chain, setChain] = React.useState("-");
  const [block, setBlock] = React.useState("-");
  const [jobs, setJobs] = React.useState<any[]>([]);
  const [wallet, setWallet] = React.useState("");
  const [serviceId, setServiceId] = React.useState("1");
  const [payloadHash, setPayloadHash] = React.useState("");
  const [message, setMessage] = React.useState("");

  const load = React.useCallback(async () => {
    try {
      const [healthResponse, jobsResponse] = await Promise.all([
        fetch(`${API_URL}/api/health`),
        fetch(`${API_URL}/api/jobs`),
      ]);
      if (!healthResponse.ok || !jobsResponse.ok) throw new Error("Backend unavailable");
      const health = await healthResponse.json();
      setStatus("online");
      setChain(health.chain.chainId);
      setBlock(String(health.chain.blockNumber));
      setJobs(await jobsResponse.json());
    } catch {
      setStatus("offline");
    }
  }, []);

  React.useEffect(() => {
    load();
    const timer = window.setInterval(load, 10000);
    return () => window.clearInterval(timer);
  }, [load]);

  async function connectWallet() {
    if (!(window as any).ethereum) {
      setMessage("MetaMask не знайдено");
      return;
    }
    const provider = new ethers.BrowserProvider((window as any).ethereum);
    const accounts = await provider.send("eth_requestAccounts", []);
    setWallet(accounts[0]);
    setMessage("Wallet підключено");
  }

  async function createJob() {
    if (!wallet) return setMessage("Спочатку підключи MetaMask");
    if (!GATEWAY_ADDRESS) return setMessage("VITE_AI_API_GATEWAY_ADDRESS не налаштований");
    if (!payloadHash.trim()) return setMessage("Введи payload hash");

    try {
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const signer = await provider.getSigner();
      const gateway = new ethers.Contract(GATEWAY_ADDRESS, gatewayAbi, signer);
      const tx = await gateway.createRequest(BigInt(serviceId), payloadHash.trim());
      setMessage(`Транзакція відправлена: ${tx.hash}`);
      await tx.wait();
      setMessage("AI Job створено");
      setPayloadHash("");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  }

  return (
    <main className="app">
      <header className="header">
        <div>
          <p className="eyebrow">ARC AI HUB</p>
          <h1>AI coordination dashboard</h1>
          <p className="subtitle">Agents · Jobs · Compute · Reputation · Billing</p>
        </div>
        <div className="header-actions">
          <span className={`status ${status}`}>
            {status === "online" ? "Backend online" : status === "offline" ? "Backend offline" : "Connecting..."}
          </span>
          <button onClick={connectWallet}>{wallet ? `${wallet.slice(0, 6)}…${wallet.slice(-4)}` : "Connect MetaMask"}</button>
        </div>
      </header>

      <section className="grid">
        <article className="card"><span>Network</span><strong>Arc Testnet</strong><small>Chain ID: {chain}</small></article>
        <article className="card"><span>Latest block</span><strong>{block}</strong><small>Live RPC</small></article>
        <article className="card"><span>Jobs</span><strong>{jobs.length}</strong><small>Recent on-chain jobs</small></article>
        <article className="card"><span>Wallet</span><strong>{wallet ? "Connected" : "Disconnected"}</strong><small>MetaMask</small></article>
      </section>

      <section className="panel">
        <h2>Create AI Job</h2>
        <div className="form">
          <input value={serviceId} onChange={(e) => setServiceId(e.target.value)} placeholder="Service / Agent ID" />
          <input value={payloadHash} onChange={(e) => setPayloadHash(e.target.value)} placeholder="Payload hash / CID" />
          <button onClick={createJob}>Create Job</button>
        </div>
        {message && <p className="message">{message}</p>}
      </section>

      <section className="panel">
        <div className="panel-title"><h2>Recent Jobs</h2><button onClick={load}>Refresh</button></div>
        {jobs.length === 0 ? <p className="empty">No jobs found.</p> : (
          <div className="jobs">
            {jobs.map((job) => (
              <div className="job" key={job.id}>
                <strong>Job #{job.id}</strong>
                <span>Agent {job.agentId}</span>
                <span>Node {job.computeNodeId}</span>
                <span className={`job-status status-${job.status}`}>{statusNames[job.status] ?? `Status ${job.status}`}</span>
                <span>{job.user.slice(0, 8)}…{job.user.slice(-6)}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<React.StrictMode><App /></React.StrictMode>);

declare global {
  interface Window {
    ethereum?: unknown;
  }
}
