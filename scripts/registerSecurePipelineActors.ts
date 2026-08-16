import { network } from "hardhat";

const TOKEN = "0xCf9b53A409e6F899016F3b9E0E635Dd2A347B3a5";
const RUNTIME = "0xC98D7fFD4961573C41B2B115411074822D9D33bf";
const POOL = process.env.AI_COMPUTE_POOL_V2;

async function main() {
  const { ethers } = await network.connect("arcTestnet");
  const [owner] = await ethers.getSigners();
  if (!POOL) throw new Error("Set $env:AI_COMPUTE_POOL_V2 to the deployed AIComputePoolV2 address first.");

  const runtime = await ethers.getContractAt("AIAgentRuntimeV2", RUNTIME);
  const agentId = await runtime.nextAgentId();
  const tx = await runtime.registerAgent(
    "Arc AI Compute Agent",
    "https://api.arc-ai-hub.local/v2/inference",
    "ipfs://arc-ai-hub/agent-0-v2",
    "2.0.0"
  );
  await tx.wait();
  console.log("Agent registered:", agentId.toString());

  const token = await ethers.getContractAt("IERC20", TOKEN);
  const pool = await ethers.getContractAt("AIComputePoolV2", POOL);
  const stake = ethers.parseEther("1000");
  await (await token.approve(POOL, stake)).wait();
  const nodeId = await pool.nextNodeId();
  await (await pool.registerNode("NVIDIA RTX 4090", 24, 16, 64, "Ukraine", stake)).wait();
  console.log("Node registered:", nodeId.toString());
  console.log("Owner:", owner.address);
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
