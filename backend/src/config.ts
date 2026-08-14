import "dotenv/config";

export const config = {
  port: Number(process.env.PORT ?? 4000),
  rpcUrl: process.env.ARC_RPC_URL ?? "https://rpc.drpc.testnet.arc.network",
  jobManager: process.env.AI_JOB_MANAGER_ADDRESS ?? "",
  gateway: process.env.AI_API_GATEWAY_ADDRESS ?? "",
  agentRegistry:
    process.env.AI_AGENT_REGISTRY_ADDRESS ??
    "0xd0577d27588D85c680FF70988E1Ffc7C2c8A92B7",
  computePool: process.env.AI_COMPUTE_POOL_ADDRESS ?? "",
  reputation: process.env.AI_REPUTATION_ADDRESS ?? "",
};
