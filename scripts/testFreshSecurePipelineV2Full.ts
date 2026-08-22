import { network } from "hardhat";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const DEPLOYMENT_FILE = join(process.cwd(), "deployments", "secure-pipeline-v2-latest.json");
const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address,address) view returns (uint256)",
  "function approve(address,uint256) returns (bool)",
];

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(`ASSERTION FAILED: ${message}`);
}

async function sendRuntimeCall(runtime: any, signer: any, functionName: string, args: any[]) {
  const data = runtime.interface.encodeFunctionData(functionName, args);
  if (!data || data === "0x") throw new Error(`Failed to encode Runtime call ${functionName}`);
  const tx = await signer.sendTransaction({ to: await runtime.getAddress(), data });
  return tx.wait();
}

async function main() {
  const { ethers } = await network.connect("arcTestnet");
  const [owner, other] = await ethers.getSigners();
  const d = JSON.parse(readFileSync(DEPLOYMENT_FILE, "utf8"));

  const runtime = await ethers.getContractAt("AIAgentRuntimeV2", d.runtime);
  const pool = await ethers.getContractAt("AIComputePoolV2", d.pool);
  const oracle = await ethers.getContractAt("AIReputationOracleV2", d.oracle);
  const reputation = await ethers.getContractAt("AIReputation", d.reputation);
  const manager = await ethers.getContractAt("AIJobManagerV2", d.manager);
  const gateway = await ethers.getContractAt("AIAPIGatewayV2", d.gateway);
  const token = new ethers.Contract(d.rewardToken, ERC20_ABI, owner);

  const agents = await runtime.getOwnerAgents(owner.address);
  const nodes = await pool.getOwnerNodes(owner.address);
  assert(agents.length > 0, "no prepared agent");
  assert(nodes.length > 0, "no prepared compute node");
  const agentId = agents[0];
  const nodeId = nodes[0];
  const reward = ethers.parseEther("1");

  console.log("=================================");
  console.log("ARC AI HUB - FULL SECURE PIPELINE V2 REGRESSION");
  console.log("=================================");
  console.log("Owner:", owner.address);
  console.log("Agent:", agentId.toString());
  console.log("Node:", nodeId.toString());

  console.log("\n1. AUTHORIZATION");
  console.log("---------------------------------");
  assert(await runtime.isController(d.manager), "runtime manager controller missing");
  assert(await pool.controllers(d.manager), "pool manager controller missing");
  assert(await oracle.controllers(d.manager), "oracle manager controller missing");
  assert((await manager.gateway()).toLowerCase() === d.gateway.toLowerCase(), "manager gateway mismatch");
  assert((await gateway.jobManager()).toLowerCase() === d.manager.toLowerCase(), "gateway manager mismatch");
  console.log("All controller and wiring checks: OK");

  console.log("\n2. HEARTBEAT / AGENT OPERATIONS");
  console.log("---------------------------------");
  const beforeHeartbeat = await runtime.getAgent(agentId);
  const heartbeatData = runtime.interface.encodeFunctionData("heartbeat", [agentId]);
  console.log("heartbeat selector:", heartbeatData.slice(0, 10));
  assert(heartbeatData.length > 10, "heartbeat calldata was not encoded");
  await (await owner.sendTransaction({ to: d.runtime, data: heartbeatData })).wait();
  const afterHeartbeat = await runtime.getAgent(agentId);
  assert(afterHeartbeat.heartbeat >= beforeHeartbeat.heartbeat, "heartbeat did not advance");
  await sendRuntimeCall(runtime, owner, "pauseAgent", [agentId]);
  assert((await runtime.getAgent(agentId)).status.toString() === "2", "agent did not pause");
  await sendRuntimeCall(runtime, owner, "startAgent", [agentId]);
  assert((await runtime.getAgent(agentId)).status.toString() === "1", "agent did not restart");
  console.log("Heartbeat / pause / restart: OK");

  console.log("\n3. SUCCESSFUL JOB");
  console.log("---------------------------------");
  const ownerBefore = await token.balanceOf(owner.address);
  const repBefore = await reputation.reputationDetails(agentId);
  const requestId = await gateway.nextRequestId();
  const jobId = await manager.nextJobId();
  const allowance = await token.allowance(owner.address, d.manager);
  if (allowance < reward) await (await token.approve(d.manager, reward)).wait();
  await (await gateway.createRequest(agentId, `full-success-${Date.now()}`, reward)).wait();
  await (await manager.assignNode(jobId, nodeId)).wait();
  await (await manager.startJob(jobId)).wait();
  assert((await manager.jobs(jobId)).status.toString() === "2", "success job not Running");
  assert((await runtime.getAgent(agentId)).status.toString() === "1", "agent not Running");
  assert((await pool.getNode(nodeId)).status.toString() === "2", "node not Busy");
  await (await manager.finishJob(jobId)).wait();
  await (await gateway.markProcessed(requestId)).wait();
  const successJob = await manager.jobs(jobId);
  const successNode = await pool.getNode(nodeId);
  const successRep = await reputation.reputationDetails(agentId);
  const ownerAfter = await token.balanceOf(owner.address);
  assert(successJob.status.toString() === "3", "success job not Finished");
  assert(successNode.status.toString() === "1", "node not Online after success");
  assert(successNode.completedJobs > 0, "completedJobs did not increase");
  assert(successNode.totalReward >= reward, "node reward did not increase");
  assert(successRep.completedJobs > repBefore.completedJobs, "reputation completedJobs did not increase");
  assert(successRep.totalEarned >= repBefore.totalEarned + reward, "reputation earnings did not increase");
  assert(successRep.inferenceCount > repBefore.inferenceCount, "inference count did not increase");
  assert(ownerAfter === ownerBefore, "owner balance changed unexpectedly");
  assert((await gateway.requests(requestId)).processed, "request not processed");
  console.log("Gateway -> Manager -> Runtime -> Pool -> Oracle success path: OK");

  console.log("\n4. FAILED JOB + REFUND");
  console.log("---------------------------------");
  const refund = ethers.parseEther("2");
  const refundBefore = await token.balanceOf(owner.address);
  const failJobId = await manager.nextJobId();
  const allowance2 = await token.allowance(owner.address, d.manager);
  if (allowance2 < refund) await (await token.approve(d.manager, refund)).wait();
  await (await gateway.createRequest(agentId, `full-failure-${Date.now()}`, refund)).wait();
  await (await manager.assignNode(failJobId, nodeId)).wait();
  await (await manager.startJob(failJobId)).wait();
  assert((await pool.getNode(nodeId)).status.toString() === "2", "node not Busy for failure path");
  await (await manager.failJob(failJobId)).wait();
  const failedJob = await manager.jobs(failJobId);
  const failedNode = await pool.getNode(nodeId);
  const failedRep = await reputation.reputationDetails(agentId);
  const refundAfter = await token.balanceOf(owner.address);
  assert(failedJob.status.toString() === "4", "failed job not Failed");
  assert(failedJob.reward === 0n, "failed job retained reward");
  assert(failedNode.status.toString() === "1", "node not Online after failure");
  assert(failedRep.failedJobs > successRep.failedJobs, "failedJobs did not increase");
  assert(refundAfter === refundBefore, "failed job refund did not restore user balance");
  console.log("Failure -> Pool release -> user refund -> reputation penalty: OK");

  console.log("\n5. INVALID AUTHORIZATION");
  console.log("---------------------------------");
  let unauthorizedCaught = false;
  try {
    const foreignData = runtime.interface.encodeFunctionData("startAgent", [agentId]);
    await (await other.sendTransaction({ to: d.runtime, data: foreignData })).wait();
  } catch { unauthorizedCaught = true; }
  assert(unauthorizedCaught, "unauthorized runtime operation was accepted");
  console.log("Unauthorized agent operation rejected: OK");

  console.log("\n6. INVALID JOB OPERATIONS");
  console.log("---------------------------------");
  let invalidFinishCaught = false;
  try { await manager.finishJob(999999999); } catch { invalidFinishCaught = true; }
  assert(invalidFinishCaught, "finishJob accepted nonexistent job");
  let invalidNodeCaught = false;
  try { await manager.assignNode(999999999, nodeId); } catch { invalidNodeCaught = true; }
  assert(invalidNodeCaught, "assignNode accepted nonexistent job");
  console.log("Invalid job operations rejected: OK");

  console.log("\n7. FINAL STATE");
  console.log("---------------------------------");
  console.log("nextRequestId:", (await gateway.nextRequestId()).toString());
  console.log("nextJobId:", (await manager.nextJobId()).toString());
  console.log("agent status:", (await runtime.getAgent(agentId)).status.toString());
  console.log("node status:", (await pool.getNode(nodeId)).status.toString());
  console.log("completed jobs:", (await pool.getNode(nodeId)).completedJobs.toString());
  console.log("failed jobs:", (await pool.getNode(nodeId)).failedJobs.toString());
  console.log("reputation:", (await reputation.reputationDetails(agentId)).reputation.toString());
  console.log("\n=================================");
  console.log("FULL V2 REGRESSION SUCCESS");
  console.log("=================================");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
