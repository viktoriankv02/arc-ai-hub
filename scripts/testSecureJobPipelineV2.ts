import { network } from "hardhat";

const TOKEN = "0xCf9b53A409e6F899016F3b9E0E635Dd2A347B3a5";
const RUNTIME = process.env.AI_AGENT_RUNTIME_V2 ?? "0xC98D7fFD4961573C41B2B115411074822D9D33bf";
const MANAGER = process.env.AI_JOB_MANAGER_V2 ?? "0x551a8Fa20486f53a446643F01788abf6cCC243A5";
const POOL = process.env.AI_COMPUTE_POOL_V2 ?? "0x3E1F5B682A2e6dF9403eb9354aB04d509dB3612c";
const GATEWAY = process.env.AI_API_GATEWAY_V2 ?? "0x3b2AAF5fbDc33Be0962C696cE2a4D9E82ebAe2c1";

const ERC20_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function balanceOf(address account) external view returns (uint256)"
];

async function main() {
  const { ethers } = await network.connect("arcTestnet");
  const [owner] = await ethers.getSigners();

  const manager = await ethers.getContractAt("AIJobManagerV2", MANAGER);
  const pool = await ethers.getContractAt("AIComputePoolV2", POOL);
  const gateway = await ethers.getContractAt("AIAPIGatewayV2", GATEWAY);
  const runtime = await ethers.getContractAt("AIAgentRuntimeV2", RUNTIME);
  const token = new ethers.Contract(TOKEN, ERC20_ABI, owner);

  const oracleAddress = await manager.reputationOracle();
  const oracle = await ethers.getContractAt("AIReputationOracleV2", oracleAddress);
  const reputationAddress = await oracle.reputation();
  const reputation = await ethers.getContractAt("AIReputation", reputationAddress);

  const ownersAgents = await runtime.getOwnerAgents(owner.address);
  const ownerNodes = await pool.getOwnerNodes(owner.address);
  if (ownersAgents.length === 0) throw new Error("No V2 agent registered. Run scripts\\registerSecurePipelineActors.ts first.");
  if (ownerNodes.length === 0) throw new Error("No V2 compute node registered. Run scripts\\registerSecurePipelineActors.ts first.");

  const agentId = ownersAgents[0];
  const nodeId = ownerNodes[0];
  const reward = ethers.parseEther("5");

  console.log("=================================");
  console.log("ARC AI HUB - SECURE JOB PIPELINE V2");
  console.log("=================================");
  console.log("Owner:", owner.address);
  console.log("Runtime:", RUNTIME);
  console.log("Manager:", MANAGER);
  console.log("Pool:", POOL);
  console.log("Gateway:", GATEWAY);
  console.log("Agent:", agentId.toString());
  console.log("Node:", nodeId.toString());

  const agentBefore = await runtime.getAgent(agentId);
  const nodeBefore = await pool.getNode(nodeId);
  console.log("\nAGENT BEFORE: status", agentBefore.status.toString(), "exists", agentBefore.exists);
  console.log("NODE BEFORE: status", nodeBefore.status.toString(), "activeJobs", nodeBefore.activeJobs.toString());

  if (!agentBefore.exists) throw new Error("Selected V2 agent does not exist.");
  if (nodeBefore.status.toString() !== "1") throw new Error(`Selected V2 node is not Online. Status: ${nodeBefore.status}`);

  const balance = await token.balanceOf(owner.address);
  if (balance < reward) throw new Error(`Insufficient AIH balance for 5 AIH reward. Balance: ${ethers.formatEther(balance)}`);

  await (await token.approve(MANAGER, reward)).wait();
  console.log("Approved 5 AIH reward escrow.");

  const nextRequest = await gateway.nextRequestId();
  const requestTx = await gateway.createRequest(0, "sha256:test-ai-inference", reward);
  await requestTx.wait();
  console.log("Request TX:", requestTx.hash);
  console.log("Request ID:", nextRequest.toString());

  const jobId = (await manager.nextJobId()) - 1n;
  const created = await manager.jobs(jobId);
  console.log("JOB CREATED:", jobId.toString(), "status", created.status.toString(), "reward", ethers.formatEther(created.reward));

  await (await manager.assignNode(jobId, nodeId)).wait();
  console.log("NODE ASSIGNED:", nodeId.toString());

  await (await manager.startJob(jobId)).wait();
  const running = await manager.jobs(jobId);
  const busyNode = await pool.getNode(nodeId);
  const runningAgent = await runtime.getAgent(agentId);
  console.log("JOB RUNNING: status", running.status.toString());
  console.log("NODE BUSY: status", busyNode.status.toString(), "activeJobs", busyNode.activeJobs.toString());
  console.log("AGENT RUNNING: status", runningAgent.status.toString());

  await (await manager.finishJob(jobId)).wait();
  const finished = await manager.jobs(jobId);
  const finalNode = await pool.getNode(nodeId);
  const rep = await reputation.reputationDetails(agentId);

  console.log("\nFINAL STATE");
  console.log("Job status:", finished.status.toString());
  console.log("Job reward stored:", ethers.formatEther(finished.reward));
  console.log("Node status:", finalNode.status.toString());
  console.log("Node completed jobs:", finalNode.completedJobs.toString());
  console.log("Node total reward:", ethers.formatEther(finalNode.totalReward));
  console.log("Agent status:", (await runtime.getAgent(agentId)).status.toString());
  console.log("Reputation completed jobs:", rep.completedJobs.toString());
  console.log("Reputation earned:", ethers.formatEther(rep.totalEarned));
  console.log("Inference count:", rep.inferenceCount.toString());
  console.log("\n=================================");
  console.log("END-TO-END PIPELINE SUCCESS");
  console.log("=================================");
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
