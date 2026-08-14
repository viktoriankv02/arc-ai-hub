import React from "react";
import { createRoot } from "react-dom/client";
import { ethers } from "ethers";
import "./styles.css";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";
const GATEWAY_ADDRESS = import.meta.env.VITE_AI_API_GATEWAY_ADDRESS ?? "";
const AGENT_REGISTRY_ADDRESS = import.meta.env.VITE_AI_AGENT_REGISTRY_ADDRESS ?? "";
const gatewayAbi = ["function createRequest(uint256 serviceId,string payloadHash) returns (uint256)"];
const agentRegistryAbi = [
  "function registerAgent(string name,string description,string version,string endpoint) returns (uint256)",
];
const statusNames = ["Created", "Scheduled", "Running", "Finished", "Failed", "Cancelled"];
const agentStatusNames = ["Inactive", "Active", "Deprecated"];
const nodeStatusNames = ["Offline", "Online", "Busy", "Disabled"];

type Chain = { key: string; name: string; chainId: number; rpcUrl: string; explorerUrl: string; nativeCurrency: string; configured: boolean; contracts?: Record<string, boolean> };
type Job = { id: string; user: string; agentId: string; computeNodeId: string; requestId: string; reward: string; createdAt: string; startedAt: string; finishedAt: string; status: number };
type Agent = { id: string; name: string; description: string; version: string; endpoint: string; developer: string; status: number; verified: boolean };
type Node = { id: string; owner: string; gpuModel: string; gpuMemory: number; cpuCores: number; ram: number; region: string; stake: string; reputation: string; completedJobs: string; failedJobs: string; status: number; totalReward: string; activeJobs: string; score: string };
type Health = { backend: boolean; chainOk: boolean; chain?: { chainId: string; blockNumber: number }; error?: string; contracts?: { jobManager: boolean; gateway: boolean; agentRegistry: boolean; computePool: boolean; reputation: boolean } };

function App() {
  const [status, setStatus] = React.useState("loading");
  const [chain, setChain] = React.useState("-");
  const [block, setBlock] = React.useState("-");
  const [chains, setChains] = React.useState<Chain[]>([]);
  const [selectedChain, setSelectedChain] = React.useState("arc");
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
  const [walletChainId, setWalletChainId] = React.useState(0);
  const [serviceId, setServiceId] = React.useState("1");
  const [payloadHash, setPayloadHash] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [agentName, setAgentName] = React.useState("");
  const [agentDescription, setAgentDescription] = React.useState("");
  const [agentVersion, setAgentVersion] = React.useState("1.0.0");
  const [agentEndpoint, setAgentEndpoint] = React.useState("");
  const [agentMessage, setAgentMessage] = React.useState("");

  const loadChains = React.useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/api/chains`);
      if (!response.ok) throw new Error("Cannot load chain configuration");
      const data: Chain[] = await response.json();
      setChains(data);
      if (!data.some((item) => item.key === selectedChain)) setSelectedChain(data[0]?.key ?? "arc");
    } catch (error) {
      setDiagnostic(error instanceof Error ? error.message : String(error));
    }
  }, [selectedChain]);

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

  React.useEffect(() => { loadChains(); }, [loadChains]);
  React.useEffect(() => { load(); const timer = window.setInterval(load, 10000); return () => window.clearInterval(timer); }, [load]);

  React.useEffect(() => {
    const ethereum = (window as any).ethereum;
    if (!ethereum) return;
    const handleAccountsChanged = (accounts: string[]) => setWallet(accounts[0] ?? "");
    const handleChainChanged = (chainId: string) => setWalletChainId(Number(BigInt(chainId)));
    ethereum.on?.("accountsChanged", handleAccountsChanged);
    ethereum.on?.("chainChanged", handleChainChanged);
    return () => {
      ethereum.removeListener?.("accountsChanged", handleAccountsChanged);
      ethereum.removeListener?.("chainChanged", handleChainChanged);
    };
  }, []);

  async function connectWallet() {
    if (!(window as any).ethereum) return setMessage("MetaMask не знайдено");
    try {
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const accounts = await provider.send("eth_requestAccounts", []);
      const network = await provider.getNetwork();
      setWallet(accounts[0] ?? "");
      setWalletChainId(Number(network.chainId));
      setMessage("Wallet підключено");
    } catch (error) { setMessage(error instanceof Error ? error.message : String(error)); }
  }

  async function switchNetwork() {
    const target = chains.find((item) => item.key === selectedChain);
    if (!target) return setMessage("Мережу не знайдено");
    if (!(window as any).ethereum) return setMessage("MetaMask не знайдено");
    try {
      const ethereum = (window as any).ethereum;
      const hexChainId = `0x${target.chainId.toString(16)}`;
      await ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: hexChainId }] });
      setWalletChainId(target.chainId);
      setMessage(`MetaMask перемкнено на ${target.name}`);
    } catch (error: any) {
      if (error?.code === 4902) {
        try {
          await ethereum.request({
            method: "wallet_addEthereumChain",
            params: [{
              chainId: `0x${target.chainId.toString(16)}`,
              chainName: target.name,
              rpcUrls: [target.rpcUrl],
              blockExplorerUrls: target.explorerUrl ? [target.explorerUrl] : undefined,
              nativeCurrency: { name: target.nativeCurrency, symbol: target.nativeCurrency, decimals: 18 },
            }],
          });
          setWalletChainId(target.chainId);
          setMessage(`${target.name} додано та вибрано в MetaMask`);
        } catch (addError) { setMessage(addError instanceof Error ? addError.message : String(addError)); }
      } else setMessage(error instanceof Error ? error.message : String(error));
    }
  }

  async function createJob() {
    if (!wallet) return setMessage("Спочатку підключи MetaMask");
    if (selectedChain !== "arc") return setMessage("Створення Job зараз доступне через Arc Testnet");
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

  async function registerAgent() {
    if (!wallet) return setAgentMessage("Спочатку підключи MetaMask");
    if (selectedChain !== "arc") return setAgentMessage("Реєстрація Agent зараз доступна через Arc Testnet");
    if (walletChainId !== 5042002) return setAgentMessage("Перемкни MetaMask на Arc Testnet (chain ID 5042002)");
    if (!AGENT_REGISTRY_ADDRESS) return setAgentMessage("VITE_AI_AGENT_REGISTRY_ADDRESS не налаштований");
    if (!agentName.trim()) return setAgentMessage("Введи назву Agent");
    if (!agentEndpoint.trim()) return setAgentMessage("Введи endpoint Agent");

    try {
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const signer = await provider.getSigner();
      const registry = new ethers.Contract(AGENT_REGISTRY_ADDRESS, agentRegistryAbi, signer);
      const tx = await registry.registerAgent(
        agentName.trim(),
        agentDescription.trim(),
        agentVersion.trim() || "1.0.0",
        agentEndpoint.trim(),
      );
      setAgentMessage(`Транзакція: ${tx.hash}`);
      await tx.wait();
      setAgentMessage("AI Agent зареєстровано on-chain");
      setAgentName("");
      setAgentDescription("");
      setAgentVersion("1.0.0");
      setAgentEndpoint("");
      await load();
    } catch (error) { setAgentMessage(error instanceof Error ? error.message : String(error)); }
  }

  const activeChain = chains.find((item) => item.key === selectedChain);
  const walletOnSelectedChain = walletChainId === activeChain?.chainId;

  return <main className="app">
    <header className="header"><div><p className="eyebrow">ARC AI HUB</p><h1>AI coordination dashboard</h1><p className="subtitle">Agents · Jobs · Compute · Reputation · Billing</p></div>
      <div className="header-actions"><span className={`status ${status}`}>{status === "online" ? "Backend online" : status === "offline" ? "Backend offline" : "Connecting..."}</span><button onClick={connectWallet}>{wallet ? `${wallet.slice(0, 6)}…${wallet.slice(-4)}` : "Connect MetaMask"}</button></div></header>

    <section className="panel network-panel"><div className="panel-title"><h2>Network</h2><span>{wallet ? (walletOnSelectedChain ? "Wallet ready" : "Switch wallet") : "Wallet not connected"}</span></div><div className="form"><select value={selectedChain} onChange={(e) => setSelectedChain(e.target.value)}>{chains.map((item) => <option key={item.key} value={item.key}>{item.name} · {item.chainId}</option>)}</select><button onClick={switchNetwork} disabled={!wallet || !activeChain}>{walletOnSelectedChain ? `Connected: ${activeChain?.name ?? ""}` : `Switch to ${activeChain?.name ?? "network"}`}</button></div></section>

    <section className="grid">
      <article className="card"><span>Network</span><strong>{activeChain?.name ?? "Arc Testnet"}</strong><small>Chain ID: {activeChain?.chainId ?? chain}</small></article>
      <article className="card"><span>Latest block</span><strong>{block}</strong><small>{chainOk ? "Live RPC" : "RPC unavailable"}</small></article>
      <article className="card"><span>Total agents</span><strong>{totalAgents}</strong><small>On-chain AgentRegistry</small></article>
      <article className="card"><span>Compute nodes</span><strong>{totalNodes}</strong><small>On-chain ComputePool</small></article>
      <article className="card"><span>Total jobs</span><strong>{totalJobs}</strong><small>On-chain JobManager</small></article>
      <article className="card"><span>Total requests</span><strong>{totalRequests}</strong><small>On-chain API Gateway</small></article>
    </section>

    {diagnostic && <section className="panel"><strong>System diagnostic</strong><p className="message">{diagnostic}</p></section>}

    <section className="panel"><h2>Register AI Agent</h2><div className="form"><input value={agentName} onChange={(e) => setAgentName(e.target.value)} placeholder="Agent name" /><input value={agentDescription} onChange={(e) => setAgentDescription(e.target.value)} placeholder="Description" /><input value={agentVersion} onChange={(e) => setAgentVersion(e.target.value)} placeholder="Version" /><input value={agentEndpoint} onChange={(e) => setAgentEndpoint(e.target.value)} placeholder="Endpoint / API URL" /><button onClick={registerAgent}>Register Agent</button></div>{agentMessage && <p className="message">{agentMessage}</p>}</section>

    <section className="panel"><h2>Create AI Job</h2><div className="form"><input value={serviceId} onChange={(e) => setServiceId(e.target.value)} placeholder="Service / Agent ID" /><input value={payloadHash} onChange={(e) => setPayloadHash(e.target.value)} placeholder="Payload hash / CID" /><button onClick={createJob}>Create Job</button></div>{message && <p className="message">{message}</p>}</section>

    <section className="panel"><div className="panel-title"><h2>AI Agents</h2><span>{agents.length} loaded / {totalAgents} total</span></div>{agents.length === 0 ? <p className="empty">No agents available. Configure AI_AGENT_REGISTRY_ADDRESS.</p> : <div className="jobs">{agents.map((agent) => <div className="job" key={agent.id}><strong>#{agent.id} {agent.name}</strong><span>v{agent.version}</span><span>{agent.verified ? "Verified" : "Unverified"}</span><span>{agentStatusNames[agent.status] ?? `Status ${agent.status}`}</span><span>{agent.developer.slice(0, 8)}…{agent.developer.slice(-6)}</span></div>)}</div>}</section>

    <section className="panel"><div className="panel-title"><h2>Compute Nodes</h2><span>{nodes.length} loaded / {totalNodes} total</span></div>{nodes.length === 0 ? <p className="empty">No compute nodes available. Configure AI_COMPUTE_POOL_ADDRESS.</p> : <div className="jobs">{nodes.map((node) => <div className="job" key={node.id}><strong>Node #{node.id}</strong><span>{node.gpuModel} · {node.gpuMemory} GB</span><span>{node.cpuCores} CPU · {node.ram} MB RAM</span><span>{node.region}</span><span>{nodeStatusNames[node.status] ?? `Status ${node.status}`} · score {node.score}</span></div>)}</div>}</section>

    <section className="panel"><div className="panel-title"><h2>Recent Jobs</h2><button onClick={load}>Refresh</button></div>{jobs.length === 0 ? <p className="empty">No jobs found.</p> : <div className="jobs">{jobs.map((job) => <div className="job" key={job.id}><strong>Job #{job.id}</strong><span>Agent {job.agentId}</span><span>Node {job.computeNodeId}</span><span className={`job-status status-${job.status}`}>{statusNames[job.status] ?? `Status ${job.status}`}</span><span>{job.user.slice(0, 8)}…{job.user.slice(-6)}</span></div>)}</div>}</section>
  </main>;
}

createRoot(document.getElementById("root")!).render(<React.StrictMode><App /></React.StrictMode>);

declare global { interface Window { ethereum?: any } }
