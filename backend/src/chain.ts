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

export const jobManager = config.jobManager
  ? new ethers.Contract(config.jobManager, jobManagerAbi, provider)
  : null;

export const gateway = config.gateway
  ? new ethers.Contract(config.gateway, gatewayAbi, provider)
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
  const [nextJobId, nextRequestId] = await Promise.all([
    jobManager ? jobManager.nextJobId() : 0n,
    gateway ? gateway.nextRequestId() : 0n,
  ]);

  return {
    totalJobs: nextJobId.toString(),
    totalRequests: nextRequestId.toString(),
    jobManagerConfigured: Boolean(jobManager),
    gatewayConfigured: Boolean(gateway),
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
