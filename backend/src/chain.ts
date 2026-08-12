import { ethers } from "ethers";
import { config } from "./config.js";

const provider = new ethers.JsonRpcProvider(config.rpcUrl);

const jobManagerAbi = [
  "function nextJobId() view returns (uint256)",
  "function jobs(uint256) view returns (uint256 id,address user,uint256 agentId,uint256 computeNodeId,uint256 requestId,uint256 reward,uint256 createdAt,uint256 startedAt,uint256 finishedAt,uint8 status)",
];

const gatewayAbi = [
  "function nextRequestId() view returns (uint256)",
  "function requests(uint256) view returns (uint256 id,address user,uint256 serviceId,string payloadHash,uint256 timestamp,bool processed)",
];

const agentRegistryAbi = [
  "function nextAgentId() view returns (uint256)",
  "function agents(uint256) view returns (uint256 id,string name,string description,string version,string endpoint,address developer,uint256 createdAt,uint256 updatedAt,uint8 status,bool verified)",
];

const computePoolAbi = [
  "function nextNodeId() view returns (uint256)",
  "function getNode(uint256) view returns (uint256 id,address owner,string gpuModel,uint32 gpuMemory,uint16 cpuCores,uint32 ram,string region,uint256 stake,uint256 reputation,uint256 completedJobs,uint256 failedJobs,uint256 lastHeartbeat,uint8 status,uint256 totalReward,uint256 activeJobs,uint256 score)",
];

export const jobManager = config.jobManager
  ? new ethers.Contract(config.jobManager, jobManagerAbi, provider)
  : null;

export const gateway = config.gateway
  ? new ethers.Contract(config.gateway, gatewayAbi, provider)
  : null;

export const agentRegistry = config.agentRegistry
  ? new ethers.Contract(config.agentRegistry, agentRegistryAbi, provider)
  : null;

export const computePool = config.computePool
  ? new ethers.Contract(config.computePool, computePoolAbi, provider)
  : null;

export async function getChainStatus() {
  const [network, blockNumber] = await Promise.all([
    provider.getNetwork(),
    provider.getBlockNumber(),
  ]);

  return {
    chainId: network.chainId.toString(),
    blockNumber,
    rpc: config.rpcUrl,
  };
}

export async function getPlatformStats() {
  const [nextJobId, nextRequestId, nextAgentId, nextNodeId] = await Promise.all([
    jobManager ? jobManager.nextJobId() : 0n,
    gateway ? gateway.nextRequestId() : 0n,
    agentRegistry ? agentRegistry.nextAgentId() : 1n,
    computePool ? computePool.nextNodeId() : 0n,
  ]);

  return {
    totalJobs: nextJobId.toString(),
    totalRequests: nextRequestId.toString(),
    totalAgents: agentRegistry ? (nextAgentId - 1n).toString() : "0",
    totalNodes: nextNodeId.toString(),
    jobManagerConfigured: Boolean(jobManager),
    gatewayConfigured: Boolean(gateway),
    agentRegistryConfigured: Boolean(agentRegistry),
    computePoolConfigured: Boolean(computePool),
  };
}

export async function getJobs(limit = 20) {
  if (!jobManager) throw new Error("AI_JOB_MANAGER_ADDRESS is not configured");

  const safeLimit = Math.max(1, Math.min(Math.floor(limit), 50));
  const next = Number(await jobManager.nextJobId());
  const start = Math.max(0, next - safeLimit);
  const jobs = [];

  for (let id = next - 1; id >= start; id--) {
    jobs.push(await getJob(id));
  }

  return jobs;
}

export async function getJob(jobId: bigint | number | string) {
  if (!jobManager) throw new Error("AI_JOB_MANAGER_ADDRESS is not configured");

  const job = await jobManager.jobs(jobId);
  return {
    id: job.id.toString(),
    user: job.user,
    agentId: job.agentId.toString(),
    computeNodeId: job.computeNodeId.toString(),
    requestId: job.requestId.toString(),
    reward: job.reward.toString(),
    createdAt: job.createdAt.toString(),
    startedAt: job.startedAt.toString(),
    finishedAt: job.finishedAt.toString(),
    status: Number(job.status),
  };
}

export async function getRequest(requestId: bigint | number | string) {
  if (!gateway) throw new Error("AI_API_GATEWAY_ADDRESS is not configured");

  const request = await gateway.requests(requestId);
  return {
    id: request.id.toString(),
    user: request.user,
    serviceId: request.serviceId.toString(),
    payloadHash: request.payloadHash,
    timestamp: request.timestamp.toString(),
    processed: request.processed,
  };
}

export async function getAgents(limit = 20) {
  if (!agentRegistry) throw new Error("AI_AGENT_REGISTRY_ADDRESS is not configured");

  const safeLimit = Math.max(1, Math.min(Math.floor(limit), 50));
  const next = Number(await agentRegistry.nextAgentId());
  const start = Math.max(1, next - safeLimit);
  const agents = [];

  for (let id = next - 1; id >= start; id--) {
    agents.push(await getAgent(id));
  }

  return agents;
}

export async function getAgent(agentId: bigint | number | string) {
  if (!agentRegistry) throw new Error("AI_AGENT_REGISTRY_ADDRESS is not configured");

  const agent = await agentRegistry.agents(agentId);
  return {
    id: agent.id.toString(),
    name: agent.name,
    description: agent.description,
    version: agent.version,
    endpoint: agent.endpoint,
    developer: agent.developer,
    createdAt: agent.createdAt.toString(),
    updatedAt: agent.updatedAt.toString(),
    status: Number(agent.status),
    verified: agent.verified,
  };
}

export async function getNodes(limit = 20) {
  if (!computePool) throw new Error("AI_COMPUTE_POOL_ADDRESS is not configured");

  const safeLimit = Math.max(1, Math.min(Math.floor(limit), 50));
  const next = Number(await computePool.nextNodeId());
  const start = Math.max(0, next - safeLimit);
  const nodes = [];

  for (let id = next - 1; id >= start; id--) {
    nodes.push(await getNode(id));
  }

  return nodes;
}

export async function getNode(nodeId: bigint | number | string) {
  if (!computePool) throw new Error("AI_COMPUTE_POOL_ADDRESS is not configured");

  const node = await computePool.getNode(nodeId);
  return {
    id: node.id.toString(),
    owner: node.owner,
    gpuModel: node.gpuModel,
    gpuMemory: Number(node.gpuMemory),
    cpuCores: Number(node.cpuCores),
    ram: Number(node.ram),
    region: node.region,
    stake: node.stake.toString(),
    reputation: node.reputation.toString(),
    completedJobs: node.completedJobs.toString(),
    failedJobs: node.failedJobs.toString(),
    lastHeartbeat: node.lastHeartbeat.toString(),
    status: Number(node.status),
    totalReward: node.totalReward.toString(),
    activeJobs: node.activeJobs.toString(),
    score: node.score.toString(),
  };
}
