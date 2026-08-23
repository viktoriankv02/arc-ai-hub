import "dotenv/config";

export const config = {
  port: Number(process.env.PORT ?? 4000),
  rpcUrl: process.env.ARC_RPC_URL ?? "https://rpc.drpc.testnet.arc.network",
  jobManager: process.env.AI_JOB_MANAGER_ADDRESS ?? "0x9Cf3aCd8666E59bC730345071fD0cE1e2251C3EB",
  gateway: process.env.AI_API_GATEWAY_ADDRESS ?? "0x3b2AAF5fbDc33Be0962C696cE2a4D9E82ebAe2c1",
  runtime: process.env.AI_AGENT_RUNTIME_ADDRESS ?? "0x203A7730AEb665FCB1F29232ccf6e041a2b73288",
  agentRegistry:
    process.env.AI_AGENT_REGISTRY_ADDRESS ??
    "0xd0577d27588D85c680FF70988E1Ffc7C2c8A92B7",
  computePool: process.env.AI_COMPUTE_POOL_ADDRESS ?? "0x53C6C04b5A0FC49B4edB99A0F979D325e4Eb775b",
  reputation: process.env.AI_REPUTATION_ADDRESS ?? "0xCd3902B5E566E8922392464013E0173722f05627",
};
