import React from "react";
import { createRoot } from "react-dom/client";
import { ethers } from "ethers";
import "./styles.css";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";
const GATEWAY_ADDRESS = import.meta.env.VITE_AI_API_GATEWAY_ADDRESS ?? "";
const gatewayAbi = ["function createRequest(uint256 serviceId,string payloadHash) returns (uint256)"];
const statusNames = ["Created", "Scheduled", "Running", "Finished", "Failed", "Cancelled"];
const agentStatusNames = ["Inactive", "Active", "Deprecated"];
const nodeStatusNames = ["Offline", "Online", "Busy", "Disabled"];

type Job = { id: string; user: string; agentId: string; computeNodeId: string; requestId: string; reward: string; createdAt: string; startedAt: string; finishedAt: string; status: number };
type Agent = { id: string; name: string; description: string; version: string; endpoint: string; developer: string; status: number; verified: boolean };
type Node = { id: string; owner: string; gpuModel: string; gpuMemory: number; cpuCores: number; ram: number; region: string; stake: string; reputation: string; completedJobs: string; failedJobs: string; status: number; totalReward: string; activeJobs: string; score: string };
type Health = { backend: boolean; chainOk: boolean; chain?: { chainId: string; blockNumber: number }; error?: string; contracts?: { jobManager: boolean; gateway: boolean; agentRegistry: boolean; computePool: boolean; reputation: boolean } };

function App() {
  const [status, setStatus] = React.useState("loading");
  const [chain, setChain] = React.useState("-");
  const [block, setBlock] = React.useState("-");
  const [totalJobs, setTotalJobs] = React.useState("0");
  const [totalRequests, setTotalRequests] = React.useState("0");
  const [totalAgents, setTotalAgents] = React.useState("0");
  const [totalNodes, setTotalNodes] = React.useState("0");
  const [jobs, setJobs] = React.useState<Job[]>([]);
  const [agents, setAgents] = React.useState<Agent[]>([]);
  const [nodes, setNodes] = React.useState<Node[]>([]);
  const [chainOk, setChainOk] = React.useState(false);
  const [diagnostic, setDiagnostic] = React.useState("");
  const [wallet, setWallet] = React.useState("");
  const [serviceId, setServiceId] = React.useState("1");
  const [payloadHash, setPayloadHash] = React.useState("");
  const [message, setMessage] = React.useState("");

  const load = React.useCallback(async () => {
    try {
      const healthResponse = await fetch(`${API_URL}/api/health`);
      const health: Health = await healthResponse.json();
      if (!health.backend) throw new Error("Backend unavailable");

      setStatus("online");
      setChainOk(Boolean(health.chainOk));
      if (health.chain) {
        setChain(health.chain.chainId);
        setBlock(String(health.chain.blockNumber));
      }

      if (!health.chainOk) {
        setDiagnostic(health.error ?? "Blockchain RPC unavailable");
        return;
      }

      const responses = await Promise.all([
        fetch(`${API_URL}/api/stats`),
        fetch(`${API_URL}/api/jobs?limit=20`),
        fetch(`${API_URL}/api/agents?limit=12`),
        fetch(`${API_URL}/api/nodes?limit=12`),
      ]);

      const [statsResponse, jobsResponse, agentsResponse, nodesResponse] = responses;
      if (statsResponse.ok) {
        const stats = await statsResponse.json();
        setTotalJobs(stats.totalJobs ?? "0");
        setTotalRequests(stats.totalRequests ?? "0");
        setTotalAgents(stats.totalAgents ?? "0");
        setTotalNodes(stats.totalNodes ?? "0");
      }
      if (jobsResponse.ok) setJobs(await jobsResponse.json());
      if (agentsResponse.ok) setAgents(await agentsResponse.json());
      if (nodesResponse.ok) setNodes(await nodesResponse.json());

      const unavailable: string[] = [];
      if (!health.contracts?.jobManager) unavailable.push("JobManager");
      if (!health.contracts?.gateway) unavailable.push("APIGateway");
      if (!health.contracts?.agentRegistry) unavailable.push("AgentRegistry");
      if (!health.contracts?.computePool) unavailable.push("ComputePool");
      setDiagnostic(unavailable.length ? `Contracts not configured: ${unavailable.join(", ")}` : "");
    } catch (error) {
      setStatus("offline");
      setDiagnostic(error instanceof Error ? error.message : String(error));
    }
  }, []);

  React.useEffect(() => { load(); const timer = window.setInterval(load, 10000); return () => window.clearInterval(timer); }, [load]);

  React.useEffect(() => {
    const ethereum = (window as any).ethereum;
    if (!ethereum) return;
    const handleAccountsChanged = (accounts: string[]) => setWallet(accounts[0] ?? "");
    ethereum.on?.("accountsChanged", handleAccountsChanged);
    return () => ethereum.removeListener?.("accountsChanged", handleAccountsChanged);
  }, []);

  async function connectWallet() {
    if (!(window as any).ethereum) return setMessage("MetaMask не знайдено");
    try {
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const accounts = await provider.send("eth_requestAccounts", []);
      setWallet(accounts[0] ?? "");
      setMessage("Wallet підключено");
    } catch (error) { setMessage(error instanceof Error ? error.message : String(error)); }
  }

  async function createJob() {
    if (!wallet) return setMessage("Спочатку підключи MetaMask");
    if (!GATEWAY_ADDRESS) return setMessage("VITE_AI_API_GATEWAY_ADDRESS не налаштований");
    if (!payloadHash.trim()) return setMessage("Введи payload hash");
    try {
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const network = await provider.getNetwork();
      if (network.chainId !== 5042002n) return setMessage("Перемкни MetaMask на Arc Testnet (chain ID 5042002)");
      const signer = await provider.getSigner();
      const gateway = new ethers.Contract(GATEWAY_ADDRESS, gatewayAbi, signer);
      const tx = await gateway.createRequest(BigInt(serviceId), payloadHash.trim());
      setMessage(`Транзакція: ${tx.hash}`);
      await tx.wait();
      setMessage("AI Job створено");
      setPayloadHash("");
      await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : String(error)); }
  }

  return <main className="app">
    <header className="header"><div><p className="eyebrow">ARC AI HUB</p><h1>AI coordination dashboard</h1><p className="subtitle">Agents · Jobs · Compute · Reputation · Billing</p></div>
      <div className="header-actions"><span className={`status ${status}`}>{status === "online" ? "Backend online" : status === "offline" ? "Backend offline" : "Connecting..."}</span><button onClick={connectWallet}>{wallet ? `${wallet.slice(0, 6)}…${wallet.slice(-4)}` : "Connect MetaMask"}</button></div></header>

    <section className="grid">
      <article className="card"><span>Network</span><strong>Arc Testnet</strong><small>Chain ID: {chain}</small></article>
      <article className="card"><span>Latest block</span><strong>{block}</strong><small>{chainOk ? "Live RPC" : "RPC unavailable"}</small></article>
      <article className="card"><span>Total agents</span><strong>{totalAgents}</strong><small>On-chain AgentRegistry</small></article>
      <article className="card"><span>Compute nodes</span><strong>{totalNodes}</strong><small>On-chain ComputePool</small></article>
      <article className="card"><span>Total jobs</span><strong>{totalJobs}</strong><small>On-chain JobManager</small></article>
      <article className="card"><span>Total requests</span><strong>{totalRequests}</strong><small>On-chain API Gateway</small></article>
    </section>

    {diagnostic && <section className="panel"><strong>System diagnostic</strong><p className="message">{diagnostic}</p></section>}

    <section className="panel"><h2>Create AI Job</h2><div className="form"><input value={serviceId} onChange={(e) => setServiceId(e.target.value)} placeholder="Service / Agent ID" /><input value={payloadHash} onChange={(e) => setPayloadHash(e.target.value)} placeholder="Payload hash / CID" /><button onClick={createJob}>Create Job</button></div>{message && <p className="message">{message}</p>}</section>

    <section className="panel"><div className="panel-title"><h2>AI Agents</h2><span>{agents.length} loaded / {totalAgents} total</span></div>{agents.length === 0 ? <p className="empty">No agents available. Configure AI_AGENT_REGISTRY_ADDRESS.</p> : <div className="jobs">{agents.map((agent) => <div className="job" key={agent.id}><strong>#{agent.id} {agent.name}</strong><span>v{agent.version}</span><span>{agent.verified ? "Verified" : "Unverified"}</span><span>{agentStatusNames[agent.status] ?? `Status ${agent.status}`}</span><span>{agent.developer.slice(0, 8)}…{agent.developer.slice(-6)}</span></div>)}</div>}</section>

    <section className="panel"><div className="panel-title"><h2>Compute Nodes</h2><span>{nodes.length} loaded / {totalNodes} total</span></div>{nodes.length === 0 ? <p className="empty">No compute nodes available. Configure AI_COMPUTE_POOL_ADDRESS.</p> : <div className="jobs">{nodes.map((node) => <div className="job" key={node.id}><strong>Node #{node.id}</strong><span>{node.gpuModel} · {node.gpuMemory} GB</span><span>{node.cpuCores} CPU · {node.ram} MB RAM</span><span>{node.region}</span><span>{nodeStatusNames[node.status] ?? `Status ${node.status}`} · score {node.score}</span></div>)}</div>}</section>

    <section className="panel"><div className="panel-title"><h2>Recent Jobs</h2><button onClick={load}>Refresh</button></div>{jobs.length === 0 ? <p className="empty">No jobs found.</p> : <div className="jobs">{jobs.map((job) => <div className="job" key={job.id}><strong>Job #{job.id}</strong><span>Agent {job.agentId}</span><span>Node {job.computeNodeId}</span><span className={`job-status status-${job.status}`}>{statusNames[job.status] ?? `Status ${job.status}`}</span><span>{job.user.slice(0, 8)}…{job.user.slice(-6)}</span></div>)}</div>}</section>
  </main>;
}

createRoot(document.getElementById("root")!).render(<React.StrictMode><App /></React.StrictMode>);

declare global { interface Window { ethereum?: any } }
