import { network } from "hardhat";

const TOKEN = "0xCf9b53A409e6F899016F3b9E0E635Dd2A347B3a5";
const RUNTIME = process.env.AI_AGENT_RUNTIME_V2 ?? "0xC98D7fFD4961573C41B2B115411074822D9D33bf";
const POOL = process.env.AI_COMPUTE_POOL_V2 ?? "0x3E1F5B682A2e6dF9403eb9354aB04d509dB3612c";

const ERC20_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function balanceOf(address account) external view returns (uint256)"
];

async function main() {
  const { ethers } = await network.connect("arcTestnet");
  const [owner] = await ethers.getSigners();

  console.log("=================================");
  console.log("ARC AI HUB - REGISTER SECURE PIPELINE ACTORS V2");
  console.log("=================================");
  console.log("Owner:", owner.address);
  console.log("Runtime:", RUNTIME);
  console.log("Pool:", POOL);

  const runtime = await ethers.getContractAt("AIAgentRuntimeV2", RUNTIME);
  const pool = await ethers.getContractAt("AIComputePoolV2", POOL);
  const token = new ethers.Contract(TOKEN, ERC20_ABI, owner);

  const nextAgentId = await runtime.nextAgentId();
  const existingAgents = await runtime.getOwnerAgents(owner.address);
  let agentId: bigint;

  if (existingAgents.length > 0) {
    agentId = existingAgents[0];
    console.log("Agent already registered:", agentId.toString());
  } else {
    const tx = await runtime.registerAgent(
      "Arc AI Compute Agent",
      "https://api.arc-ai-hub.local/v2/inference",
      "ipfs://arc-ai-hub/agent-0-v2",
      "2.0.0"
    );
    await tx.wait();
    agentId = nextAgentId;
    console.log("Agent registered:", agentId.toString());
  }

  const ownerNodes = await pool.getOwnerNodes(owner.address);
  let nodeId: bigint;

  if (ownerNodes.length > 0) {
    nodeId = ownerNodes[0];
    console.log("Node already registered:", nodeId.toString());
  } else {
    const stake = ethers.parseEther("1000");
    const balance = await token.balanceOf(owner.address);
    if (balance < stake) {
      throw new Error(`Insufficient AIH balance for 1000 AIH stake. Balance: ${ethers.formatEther(balance)}`);
    }

    const allowance = await token.allowance(owner.address, POOL);
    if (allowance < stake) {
      const approveTx = await token.approve(POOL, stake);
      console.log("Approve TX:", approveTx.hash);
      await approveTx.wait();
    }

    const nextNodeId = await pool.nextNodeId();
    const tx = await pool.registerNode(
      "NVIDIA RTX 4090",
      24,
      16,
      64,
      "Ukraine",
      stake
    );
    await tx.wait();
    nodeId = nextNodeId;
    console.log("Node registered:", nodeId.toString());
  }

  const agent = await runtime.getAgent(agentId);
  const node = await pool.getNode(nodeId);

  console.log("\nFINAL ACTOR STATE");
  console.log("Agent:", agentId.toString(), "owner", agent.owner, "status", agent.status.toString(), "exists", agent.exists);
  console.log("Node:", nodeId.toString(), "owner", node.owner, "status", node.status.toString(), "stake", ethers.formatEther(node.stake));

  console.log("\n=================================");
  console.log("SECURE PIPELINE ACTORS READY");
  console.log("=================================");
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
