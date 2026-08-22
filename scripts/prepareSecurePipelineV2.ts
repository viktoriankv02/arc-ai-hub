import { network } from "hardhat";

const RUNTIME = process.env.AI_AGENT_RUNTIME_V2_ADDRESS ?? "0xC98D7fFD4961573C41B2B115411074822D9D33bf";
const POOL = process.env.AI_COMPUTE_POOL_V2_ADDRESS ?? "0x3E1F5B682A2e6dF9403eb9354aB04d509dB3612c";
const OLD_POOL = process.env.AI_OLD_COMPUTE_POOL_V2_ADDRESS ?? "0x3E1F5B682A2e6dF9403eb9354aB04d509dB3612c";

const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address,address) view returns (uint256)",
  "function approve(address,uint256) returns (bool)",
];

async function main() {
  const { ethers } = await network.connect("arcTestnet");
  const [owner] = await ethers.getSigners();

  console.log("=================================");
  console.log("ARC AI HUB - SECURE PIPELINE V2 PREPARE");
  console.log("=================================");
  console.log("Owner:", owner.address);
  console.log("Runtime:", RUNTIME);
  console.log("Pool:", POOL);

  const runtime = await ethers.getContractAt("AIAgentRuntimeV2", RUNTIME);
  const pool = await ethers.getContractAt("AIComputePoolV2", POOL);
  const oldPool = await ethers.getContractAt("AIComputePoolV2", OLD_POOL);

  console.log("");
  console.log("1. REGISTER AGENT");
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
  console.log("Agent status:", agent.status);

  console.log("");
  console.log("2. PREPARE COMPUTE NODE");
  console.log("---------------------------------");
  const nodeIds = await pool.getOwnerNodes(owner.address);

  if (nodeIds.length > 0) {
    console.log("Existing node:", nodeIds[0].toString());
    const node = await pool.getNode(nodeIds[0]);
    console.log("Node status:", node.status);
    console.log("Node stake:", ethers.formatEther(node.stake));
  } else {
    const rewardTokenAddress = await oldPool.rewardToken();
    const token = new ethers.Contract(rewardTokenAddress, ERC20_ABI, owner);
    const balance = await token.balanceOf(owner.address);
    const minimumStake = await pool.minimumStake();

    console.log("Reward token:", rewardTokenAddress);
    console.log("Wallet balance:", ethers.formatEther(balance));
    console.log("Required stake:", ethers.formatEther(minimumStake));

    if (balance < minimumStake) {
      throw new Error(
        `Insufficient reward token balance. Need ${ethers.formatEther(minimumStake)} tokens to register a compute node.`,
      );
    }

    const allowance = await token.allowance(owner.address, POOL);
    if (allowance < minimumStake) {
      console.log("Approving compute pool...");
      await (await token.approve(POOL, minimumStake)).wait();
    }

    console.log("Registering compute node...");
    const tx = await pool.registerNode(
      "ARC-AI-GPU",
      24 * 1024,
      16,
      64 * 1024,
      "UA-KYIV",
      minimumStake,
    );
    await tx.wait();

    const createdNodeId = (await pool.nextNodeId()) - 1n;
    console.log("New node:", createdNodeId.toString());
  }

  console.log("");
  console.log("3. CONTROLLER CHECKS");
  console.log("---------------------------------");
  console.log("Runtime controller:", await runtime.isController(owner.address));
  console.log("Pool owner:", await pool.owner());

  console.log("");
  console.log("=================================");
  console.log("PREPARATION COMPLETE");
  console.log("=================================");
  console.log(`AI_AGENT_ID=${agentId.toString()}`);
  console.log("NEXT: run the end-to-end secure pipeline test against the new addresses.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
