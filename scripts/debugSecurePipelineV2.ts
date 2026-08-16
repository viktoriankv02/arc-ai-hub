import { network } from "hardhat";

const RUNTIME = process.env.AI_AGENT_RUNTIME_V2 ?? "0xC98D7fFD4961573C41B2B115411074822D9D33bf";
const MANAGER = process.env.AI_JOB_MANAGER_V2 ?? "0x551a8Fa20486f53a446643F01788abf6cCC243A5";
const POOL = process.env.AI_COMPUTE_POOL_V2 ?? "0x3E1F5B682A2e6dF9403eb9354aB04d509dB3612c";
const GATEWAY = process.env.AI_API_GATEWAY_V2 ?? "0x3b2AAF5fbDc33Be0962C696cE2a4D9E82ebAe2c1";

async function main() {
  const { ethers } = await network.connect("arcTestnet");
  const [owner] = await ethers.getSigners();

  const runtime = await ethers.getContractAt("AIAgentRuntimeV2", RUNTIME);
  const manager = await ethers.getContractAt("AIJobManagerV2", MANAGER);
  const pool = await ethers.getContractAt("AIComputePoolV2", POOL);
  const gateway = await ethers.getContractAt("AIAPIGatewayV2", GATEWAY);

  console.log("=================================");
  console.log("ARC AI HUB - SECURE PIPELINE V2 DEBUG");
  console.log("=================================");
  console.log("Owner:", owner.address);
  console.log("Runtime:", RUNTIME);
  console.log("Manager:", MANAGER);
  console.log("Pool:", POOL);
  console.log("Gateway:", GATEWAY);

  console.log("\n1. RUNTIME");
  console.log("---------------------------------");
  console.log("Manager controller:", await runtime.isController(MANAGER));
  console.log("Next agent ID:", (await runtime.nextAgentId()).toString());
  const agents = await runtime.getOwnerAgents(owner.address);
  console.log("Owner agents:", agents.map((x) => x.toString()).join(", ") || "none");
  if (agents.length > 0) {
    const agent = await runtime.getAgent(agents[0]);
    console.log("Agent owner:", agent.owner);
    console.log("Agent status:", agent.status.toString());
    console.log("Agent exists:", agent.exists);
  }

  console.log("\n2. COMPUTE POOL");
  console.log("---------------------------------");
  console.log("Manager controller:", await pool.controllers(MANAGER));
  console.log("Next node ID:", (await pool.nextNodeId()).toString());
  const nodes = await pool.getOwnerNodes(owner.address);
  console.log("Owner nodes:", nodes.map((x) => x.toString()).join(", ") || "none");
  if (nodes.length > 0) {
    const node = await pool.getNode(nodes[0]);
    console.log("Node owner:", node.owner);
    console.log("GPU:", node.gpuModel);
    console.log("Status:", node.status.toString());
    console.log("Stake:", ethers.formatEther(node.stake));
    console.log("Reputation:", node.reputation.toString());
  }

  console.log("\n3. JOB MANAGER");
  console.log("---------------------------------");
  console.log("Gateway:", await manager.gateway());
  console.log("Scheduler:", await manager.scheduler());
  console.log("Runtime:", await manager.runtime());
  console.log("Compute pool:", await manager.computePool());
  console.log("Oracle:", await manager.reputationOracle());
  console.log("Next job ID:", (await manager.nextJobId()).toString());

  console.log("\n4. GATEWAY");
  console.log("---------------------------------");
  console.log("Job manager:", await gateway.jobManager());
  console.log("Next request ID:", (await gateway.nextRequestId()).toString());

  console.log("\n=================================");
  console.log("SECURE PIPELINE V2 DEBUG COMPLETE");
  console.log("=================================");
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
