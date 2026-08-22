import { network } from "hardhat";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const DEPLOYMENT_FILE = join(process.cwd(), "deployments", "secure-pipeline-v2-latest.json");

const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address,address) view returns (uint256)",
  "function approve(address,uint256) returns (bool)",
];

async function main() {
  const { ethers } = await network.connect("arcTestnet");
  const [owner] = await ethers.getSigners();

  const deployment = JSON.parse(readFileSync(DEPLOYMENT_FILE, "utf8"));
  const runtime = await ethers.getContractAt("AIAgentRuntimeV2", deployment.runtime);
  const pool = await ethers.getContractAt("AIComputePoolV2", deployment.pool);
  const oracle = await ethers.getContractAt("AIReputationOracleV2", deployment.oracle);
  const reputation = await ethers.getContractAt("AIReputation", deployment.reputation);
  const manager = await ethers.getContractAt("AIJobManagerV2", deployment.manager);
  const gateway = await ethers.getContractAt("AIAPIGatewayV2", deployment.gateway);
  const token = new ethers.Contract(deployment.rewardToken, ERC20_ABI, owner);

  const agentIds = await runtime.getOwnerAgents(owner.address);
  const nodeIds = await pool.getOwnerNodes(owner.address);
  if (agentIds.length === 0) throw new Error("No V2 agent found. Run prepareFreshSecurePipelineV2.ts first.");
  if (nodeIds.length === 0) throw new Error("No V2 compute node found. Run prepareFreshSecurePipelineV2.ts first.");

  const agentId = agentIds[0];
  const nodeId = nodeIds[0];
  const reward = ethers.parseEther("1");

  console.log("=================================");
  console.log("ARC AI HUB - FRESH SECURE PIPELINE V2 E2E");
  console.log("=================================");
  console.log("Owner:", owner.address);
  console.log("Gateway:", deployment.gateway);
  console.log("Manager:", deployment.manager);
  console.log("Runtime:", deployment.runtime);
  console.log("Pool:", deployment.pool);
  console.log("Oracle:", deployment.oracle);
  console.log("Reputation:", deployment.reputation);
  console.log("Agent:", agentId.toString());
  console.log("Node:", nodeId.toString());
  console.log("Reward:", ethers.formatEther(reward));

  console.log("\n1. PRE-FLIGHT");
  console.log("---------------------------------");
  const runtimeController = await runtime.isController(deployment.manager);
  const poolController = await pool.controllers(deployment.manager);
  const oracleController = await oracle.controllers(deployment.manager);
  console.log("Runtime controller:", runtimeController);
  console.log("Pool controller:", poolController);
  console.log("Oracle controller:", oracleController);
  if (!runtimeController || !poolController || !oracleController) {
    throw new Error("V2 controller configuration is incomplete.");
  }

  const agentBefore = await runtime.getAgent(agentId);
  const nodeBefore = await pool.getNode(nodeId);
  const repBefore = await reputation.reputationDetails(agentId);
  console.log("Agent status before:", agentBefore.status.toString());
  console.log("Node status before:", nodeBefore.status.toString());
  console.log("Node stake:", ethers.formatEther(nodeBefore.stake));
  console.log("Reputation completed jobs before:", repBefore.completedJobs.toString());
  console.log("Reputation earned before:", ethers.formatEther(repBefore.totalEarned));

  if (nodeBefore.status.toString() !== "1") {
    throw new Error("Compute node is not Online. Expected status 1.");
  }

  console.log("\n2. APPROVE JOB REWARD TO MANAGER");
  console.log("---------------------------------");
  const ownerBalanceBefore = await token.balanceOf(owner.address);
  const managerBalanceBefore = await token.balanceOf(deployment.manager);
  const nodeOwnerBalanceBefore = await token.balanceOf(owner.address);
  console.log("Owner token balance:", ethers.formatEther(ownerBalanceBefore));
  console.log("Manager token balance:", ethers.formatEther(managerBalanceBefore));

  const allowance = await token.allowance(owner.address, deployment.manager);
  if (allowance < reward) {
    console.log("Approving manager...");
    await (await token.approve(deployment.manager, reward)).wait();
  }
  console.log("Manager allowance:", ethers.formatEther(await token.allowance(owner.address, deployment.manager)));

  console.log("\n3. CREATE REQUEST THROUGH GATEWAY");
  console.log("---------------------------------");
  const nextRequestBefore = await gateway.nextRequestId();
  const nextJobBefore = await manager.nextJobId();
  const payloadHash = `arc-ai-hub-e2e-${Date.now()}`;

  console.log("Request id:", nextRequestBefore.toString());
  console.log("Expected job id:", nextJobBefore.toString());
  console.log("Payload:", payloadHash);

  await (await gateway.createRequest(agentId, payloadHash, reward)).wait();

  const requestId = nextRequestBefore;
  const jobId = nextJobBefore;
  const request = await gateway.requests(requestId);
  const jobCreated = await manager.jobs(jobId);

  console.log("Request user:", request.user);
  console.log("Request service/agent:", request.serviceId.toString());
  console.log("Request processed:", request.processed);
  console.log("Job user:", jobCreated.user);
  console.log("Job agent:", jobCreated.agentId.toString());
  console.log("Job reward:", ethers.formatEther(jobCreated.reward));
  console.log("Job status:", jobCreated.status.toString());

  if (request.user.toLowerCase() !== owner.address.toLowerCase()) throw new Error("Gateway request user mismatch.");
  if (jobCreated.agentId !== agentId) throw new Error("Job agent mismatch.");
  if (jobCreated.reward !== reward) throw new Error("Job reward mismatch.");

  console.log("\n4. ASSIGN COMPUTE NODE");
  console.log("---------------------------------");
  await (await manager.assignNode(jobId, nodeId)).wait();
  const jobAssigned = await manager.jobs(jobId);
  console.log("Assigned node:", jobAssigned.computeNodeId.toString());
  console.log("Job status:", jobAssigned.status.toString());
  if (jobAssigned.computeNodeId !== nodeId) throw new Error("Node assignment mismatch.");

  console.log("\n5. START JOB");
  console.log("---------------------------------");
  await (await manager.startJob(jobId)).wait();
  const jobRunning = await manager.jobs(jobId);
  const agentRunning = await runtime.getAgent(agentId);
  const nodeRunning = await pool.getNode(nodeId);
  console.log("Job status:", jobRunning.status.toString());
  console.log("Agent status:", agentRunning.status.toString());
  console.log("Node status:", nodeRunning.status.toString());
  console.log("Active job on node:", (await pool.activeJobByNode(nodeId)).toString());

  if (jobRunning.status.toString() !== "2") throw new Error("Job did not enter Running state.");
  if (agentRunning.status.toString() !== "1") throw new Error("Agent did not enter Running state.");
  if (nodeRunning.status.toString() !== "2") throw new Error("Node did not enter Busy state.");
  if ((await pool.activeJobByNode(nodeId)) !== jobId) throw new Error("Pool active job mismatch.");

  console.log("\n6. FINISH JOB");
  console.log("---------------------------------");
  await (await manager.finishJob(jobId)).wait();

  const jobFinished = await manager.jobs(jobId);
  const nodeFinished = await pool.getNode(nodeId);
  const repAfter = await reputation.reputationDetails(agentId);
  console.log("Job status:", jobFinished.status.toString());
  console.log("Job reward remaining:", ethers.formatEther(jobFinished.reward));
  console.log("Node status:", nodeFinished.status.toString());
  console.log("Node completed jobs:", nodeFinished.completedJobs.toString());
  console.log("Node total reward:", ethers.formatEther(nodeFinished.totalReward));
  console.log("Reputation completed jobs:", repAfter.completedJobs.toString());
  console.log("Reputation earned:", ethers.formatEther(repAfter.totalEarned));
  console.log("Inference count:", repAfter.inferenceCount.toString());
  console.log("Reputation score:", repAfter.reputation.toString());

  if (jobFinished.status.toString() !== "3") throw new Error("Job did not enter Finished state.");
  if (jobFinished.reward !== 0n) throw new Error("Finished job still contains reward.");
  if (nodeFinished.status.toString() !== "1") throw new Error("Node did not return to Online state.");
  if (nodeFinished.completedJobs <= nodeBefore.completedJobs) throw new Error("Node completedJobs did not increase.");
  if (nodeFinished.totalReward < nodeBefore.totalReward + reward) throw new Error("Node totalReward did not increase by reward.");
  if (repAfter.completedJobs <= repBefore.completedJobs) throw new Error("Reputation completedJobs did not increase.");
  if (repAfter.totalEarned < repBefore.totalEarned + reward) throw new Error("Reputation totalEarned did not increase.");
  if (repAfter.inferenceCount <= repBefore.inferenceCount) throw new Error("Inference count did not increase.");

  console.log("\n7. MARK GATEWAY REQUEST PROCESSED");
  console.log("---------------------------------");
  await (await gateway.markProcessed(requestId)).wait();
  const requestAfter = await gateway.requests(requestId);
  console.log("Processed:", requestAfter.processed);
  if (!requestAfter.processed) throw new Error("Gateway request was not marked processed.");

  console.log("\n8. FINAL BALANCES");
  console.log("---------------------------------");
  const ownerBalanceAfter = await token.balanceOf(owner.address);
  const managerBalanceAfter = await token.balanceOf(deployment.manager);
  console.log("Owner token balance before:", ethers.formatEther(ownerBalanceBefore));
  console.log("Owner token balance after: ", ethers.formatEther(ownerBalanceAfter));
  console.log("Manager token balance before:", ethers.formatEther(managerBalanceBefore));
  console.log("Manager token balance after: ", ethers.formatEther(managerBalanceAfter));
  console.log("Owner net reward movement:  ", ethers.formatEther(ownerBalanceAfter - ownerBalanceBefore));

  if (ownerBalanceAfter !== nodeOwnerBalanceBefore) {
    throw new Error("Unexpected owner token balance after E2E pipeline.");
  }
  if (managerBalanceAfter !== managerBalanceBefore) {
    throw new Error("Manager retained an unexpected token balance.");
  }

  console.log("\n=================================");
  console.log("FRESH V2 E2E PIPELINE SUCCESS");
  console.log("=================================");
  console.log("Request:", requestId.toString());
  console.log("Job:", jobId.toString());
  console.log("Agent:", agentId.toString());
  console.log("Node:", nodeId.toString());
  console.log("Reward:", ethers.formatEther(reward));
  console.log("Gateway -> Manager -> Runtime -> Pool -> Oracle: OK");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
