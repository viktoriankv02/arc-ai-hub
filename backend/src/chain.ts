import { ethers } from "ethers";
import { config } from "./config.js";

const provider = new ethers.JsonRpcProvider(config.rpcUrl);

const jobManagerAbi = [
  "function nextJobId() view returns (uint256)",
  "function jobs(uint256) view returns (uint256 id,address user,uint256 agentId,uint256 computeNodeId,uint256 requestId,uint256 reward,uint256 createdAt,uint256 startedAt,uint256 finishedAt,uint8 status)",
];

export const jobManager = config.jobManager
  ? new ethers.Contract(config.jobManager, jobManagerAbi, provider)
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

export async function getJob(jobId: bigint | number) {
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
