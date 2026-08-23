import { ethers } from "ethers";
import { config } from "../config.js";
import { getJob } from "../chain.js";
import type { AIExecutionRequest, AIExecutionResult, OnChainExecutionResult } from "./types.js";

const gatewayAbi = [
  "function nextRequestId() view returns (uint256)",
  "function createRequest(uint256 serviceId,string payloadHash) returns (uint256 requestId)",
  "function requests(uint256) view returns (uint256 id,address user,uint256 serviceId,string payloadHash,uint256 timestamp,bool processed)",
  "function markProcessed(uint256 requestId)",
];

const jobManagerAbi = [
  "function nextJobId() view returns (uint256)",
  "function jobs(uint256) view returns (uint256 id,address user,uint256 agentId,uint256 computeNodeId,uint256 requestId,uint256 reward,uint256 createdAt,uint256 startedAt,uint256 finishedAt,uint8 status)",
  "function assignNode(uint256 jobId,uint256 nodeId)",
  "function startJob(uint256 jobId)",
  "function finishJob(uint256 jobId)",
  "function failJob(uint256 jobId)",
];

const runtimeAbi = [
  "function getAgent(uint256) view returns (uint256 id,address owner,string name,string endpoint,string metadataURI,string version,uint256 createdAt,uint256 updatedAt,uint256 heartbeat,uint8 status,bool exists)",
];

const poolAbi = [
  "function getNode(uint256) view returns (uint256 id,address owner,string gpuModel,uint32 gpuMemory,uint16 cpuCores,uint32 ram,string region,uint256 stake,uint256 reputation,uint256 completedJobs,uint256 failedJobs,uint256 lastHeartbeat,uint8 status,uint256 totalReward,uint256 activeJobs,uint256 score)",
];

function requireAddress(value: string, name: string): string {
  if (!value || !ethers.isAddress(value)) {
    throw new Error(`${name} is not configured with a valid address`);
  }
  return value;
}

function requirePrivateKey(): string {
  const key = process.env.ARC_EXECUTOR_PRIVATE_KEY;
  if (!key) {
    throw new Error("ARC_EXECUTOR_PRIVATE_KEY is required for on-chain execution");
  }
  return key;
}

export class OnChainAIExecutor {
  private readonly provider = new ethers.JsonRpcProvider(config.rpcUrl);
  private readonly signer = new ethers.Wallet(requirePrivateKey(), this.provider);
  private readonly gateway = new ethers.Contract(
    requireAddress(config.gateway, "AI_API_GATEWAY_ADDRESS"),
    gatewayAbi,
    this.signer,
  );
  private readonly manager = new ethers.Contract(
    requireAddress(config.jobManager, "AI_JOB_MANAGER_ADDRESS"),
    jobManagerAbi,
    this.signer,
  );
  private readonly runtime = new ethers.Contract(
    requireAddress(config.runtime, "AI_AGENT_RUNTIME_ADDRESS"),
    runtimeAbi,
    this.provider,
  );
  private readonly pool = new ethers.Contract(
    requireAddress(config.computePool, "AI_COMPUTE_POOL_ADDRESS"),
    poolAbi,
    this.provider,
  );

  async execute(
    request: AIExecutionRequest,
    inference: AIExecutionResult,
  ): Promise<OnChainExecutionResult> {
    const agentId = BigInt(request.agentId ?? process.env.ARC_AGENT_ID ?? "0");
    const nodeId = BigInt(request.nodeId ?? process.env.ARC_NODE_ID ?? "0");
    const serviceId = BigInt(request.serviceId ?? process.env.ARC_SERVICE_ID ?? "0");

    const signerAddress = await this.signer.getAddress();
    const agent = await this.runtime.getAgent(agentId);
    if (!agent.exists) throw new Error(`AI agent ${agentId} does not exist`);
    if (Number(agent.status) !== 1) throw new Error(`AI agent ${agentId} is not Running`);

    const node = await this.pool.getNode(nodeId);
    if (node.owner.toLowerCase() !== signerAddress.toLowerCase()) {
      throw new Error(`Compute node ${nodeId} owner does not match executor signer`);
    }
    if (Number(node.status) !== 1) throw new Error(`Compute node ${nodeId} is not available`);

    const payloadHash = `sha256:${inference.inputHash}`;
    const expectedRequestId = await this.gateway.nextRequestId();
    const expectedJobId = await this.manager.nextJobId();

    let requestId: bigint = expectedRequestId;
    let jobId: bigint = expectedJobId;
    let startedOnChain = false;

    try {
      const requestTx = await this.gateway.createRequest(serviceId, payloadHash);
      await requestTx.wait();

      const requestState = await this.gateway.requests(requestId);
      if (requestState.user.toLowerCase() !== signerAddress.toLowerCase()) {
        throw new Error("On-chain request user does not match executor signer");
      }

      const job = await this.manager.jobs(jobId);
      if (job.requestId !== requestId) {
        throw new Error(`Unexpected job/request mapping: job=${jobId} request=${job.requestId}`);
      }

      const assignTx = await this.manager.assignNode(jobId, nodeId);
      await assignTx.wait();

      const startTx = await this.manager.startJob(jobId);
      await startTx.wait();
      startedOnChain = true;

      // Inference has already completed successfully off-chain. Finalize the matching
      // on-chain job and let the deployed Manager V2 update pool/reputation state.
      const finishTx = await this.manager.finishJob(jobId);
      await finishTx.wait();

      const markProcessedTx = await this.gateway.markProcessed(requestId);
      await markProcessedTx.wait();

      const finalJob = await getJob(jobId);
      if (finalJob.status !== 3) {
        throw new Error(`Job ${jobId} did not finish successfully; status=${finalJob.status}`);
      }

      return {
        requestId: requestId.toString(),
        jobId: jobId.toString(),
        agentId: agentId.toString(),
        nodeId: nodeId.toString(),
        status: "finished",
        payloadHash,
        signer: signerAddress,
        outputHash: inference.outputHash,
      };
    } catch (error) {
      if (startedOnChain) {
        try {
          const current = await this.manager.jobs(jobId);
          if (Number(current.status) === 2) {
            const failTx = await this.manager.failJob(jobId);
            await failTx.wait();
          }
        } catch (cleanupError) {
          console.error("On-chain failure cleanup failed:", cleanupError);
        }
      }

      throw new Error(
        `On-chain AI execution failed for request=${requestId} job=${jobId}: ${String(error)}`,
      );
    }
  }
}

export const onChainAIExecutor = new OnChainAIExecutor();
