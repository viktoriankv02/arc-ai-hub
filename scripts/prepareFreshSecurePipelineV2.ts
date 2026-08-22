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
  const manager = await ethers.getContractAt("AIJobManagerV2", deployment.manager);
  const gateway = await ethers.getContractAt("AIAPIGatewayV2", deployment.gateway);

  console.log("=================================");
  console.log("ARC AI HUB - FRESH SECURE PIPELINE V2 PREPARE");
  console.log("=================================");
  console.log("Owner:", owner.address);
  console.log("Runtime:", deployment.runtime);
  console.log("Pool:", deployment.pool);
  console.log("Oracle:", deployment.oracle);
  console.log("Manager:", deployment.manager);
  console.log("Gateway:", deployment.gateway);

  console.log("\n1. VERIFY CONTROLLERS");
  console.log("---------------------------------");
  console.log("Runtime controller:", await runtime.isController(deployment.manager));
  console.log("Pool controller:", await pool.controllers(deployment.manager));
  console.log("Oracle controller:", await oracle.controllers(deployment.manager));

  console.log("\n2. VERIFY WIRING");
  console.log("---------------------------------");
  console.log("Manager gateway:", await manager.gateway());
  console.log("Gateway manager:", await gateway.jobManager());
  console.log("Manager runtime:", await manager.runtime());
  console.log("Manager pool:", await manager.computePool());
  console.log("Manager oracle:", await manager.reputationOracle());

  console.log("\n3. REGISTER / REUSE AGENT");
  console.log("---------------------------------");
  const agentIds = await runtime.getOwnerAgents(owner.address);
  let agentId: bigint;
  if (agentIds.length > 0) {
    agentId = agentIds[0];
    console.log("Existing agent:", agentId.toString());
  } else {
    const tx = await runtime.registerAgent(
      "ARC AI HUB Agent V2",
      "https://api.arc-ai-hub.local/agent",
      "ipfs://arc-ai-hub-agent-v2",
      "2.0.0",
    );
    await tx.wait();
    agentId = (await runtime.nextAgentId()) - 1n;
    console.log("New agent:", agentId.toString());
  }

  const agent = await runtime.getAgent(agentId);
  console.log("Agent owner:", agent.owner);
  console.log("Agent exists:", agent.exists);
  console.log("Agent status:", agent.status.toString());

  console.log("\n4. REGISTER / REUSE COMPUTE NODE");
  console.log("---------------------------------");
  const nodeIds = await pool.getOwnerNodes(owner.address);
  let nodeId: bigint;
  if (nodeIds.length > 0) {
    nodeId = nodeIds[0];
    const node = await pool.getNode(nodeId);
    console.log("Existing node:", nodeId.toString());
    console.log("Node status:", node.status.toString());
    console.log("Node stake:", ethers.formatEther(node.stake));
  } else {
    const token = new ethers.Contract(deployment.rewardToken, ERC20_ABI, owner);
    const minimumStake = await pool.minimumStake();
    const balance = await token.balanceOf(owner.address);
    console.log("Reward token:", deployment.rewardToken);
    console.log("Wallet balance:", ethers.formatEther(balance));
    console.log("Required stake:", ethers.formatEther(minimumStake));
    if (balance < minimumStake) {
      throw new Error(`Insufficient reward token balance. Need ${ethers.formatEther(minimumStake)} tokens.`);
    }
    const allowance = await token.allowance(owner.address, deployment.pool);
    if (allowance < minimumStake) {
      console.log("Approving new Pool...");
      await (await token.approve(deployment.pool, minimumStake)).wait();
    }
    console.log("Registering new compute node...");
    await (
      await pool.registerNode(
        "ARC-AI-GPU",
        24 * 1024,
        16,
        64 * 1024,
        "UA-KYIV",
        minimumStake,
      )
    ).wait();
    nodeId = (await pool.nextNodeId()) - 1n;
    console.log("New node:", nodeId.toString());
  }

  console.log("\n5. FINAL PREPARATION STATE");
  console.log("---------------------------------");
  console.log("Agent:", agentId.toString());
  console.log("Node:", nodeId.toString());
  console.log("Next job id:", (await manager.nextJobId()).toString());
  console.log("Next request id:", (await gateway.nextRequestId()).toString());

  console.log("\n=================================");
  console.log("FRESH PREPARATION COMPLETE");
  console.log("=================================");
  console.log(`AI_AGENT_ID=${agentId.toString()}`);
  console.log(`AI_COMPUTE_NODE_ID=${nodeId.toString()}`);
  console.log("NEXT: run the fresh V2 end-to-end pipeline test.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
