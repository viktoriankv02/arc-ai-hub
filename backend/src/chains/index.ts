import type { ChainDefinition, ChainKey } from "./types.js";

const env = (name: string) => process.env[name] ?? "";

export const chains: Record<ChainKey, ChainDefinition> = {
  arc: {
    key: "arc",
    name: "Arc Testnet",
    chainId: 5042002,
    rpcUrl: env("ARC_RPC_URL") || "https://rpc.drpc.testnet.arc.network",
    explorerUrl: "https://testnet.arcscan.app",
    nativeCurrency: "USDC",
    gatewayAddress: env("ARC_AI_API_GATEWAY_ADDRESS") || env("AI_API_GATEWAY_ADDRESS"),
    jobManagerAddress: env("ARC_AI_JOB_MANAGER_ADDRESS") || env("AI_JOB_MANAGER_ADDRESS"),
    agentRegistryAddress: env("ARC_AI_AGENT_REGISTRY_ADDRESS") || env("AI_AGENT_REGISTRY_ADDRESS"),
    computePoolAddress: env("ARC_AI_COMPUTE_POOL_ADDRESS") || env("AI_COMPUTE_POOL_ADDRESS"),
  },
  base: {
    key: "base",
    name: "Base",
    chainId: 8453,
    rpcUrl: env("BASE_RPC_URL") || "https://mainnet.base.org",
    explorerUrl: "https://basescan.org",
    nativeCurrency: "ETH",
    gatewayAddress: env("BASE_AI_API_GATEWAY_ADDRESS"),
    jobManagerAddress: env("BASE_AI_JOB_MANAGER_ADDRESS"),
    agentRegistryAddress: env("BASE_AI_AGENT_REGISTRY_ADDRESS"),
    computePoolAddress: env("BASE_AI_COMPUTE_POOL_ADDRESS"),
  },
  ink: {
    key: "ink",
    name: "Ink",
    chainId: 57073,
    rpcUrl: env("INK_RPC_URL") || "https://rpc-gel.inkonchain.com",
    explorerUrl: "https://explorer.inkonchain.com",
    nativeCurrency: "ETH",
    gatewayAddress: env("INK_AI_API_GATEWAY_ADDRESS"),
    jobManagerAddress: env("INK_AI_JOB_MANAGER_ADDRESS"),
    agentRegistryAddress: env("INK_AI_AGENT_REGISTRY_ADDRESS"),
    computePoolAddress: env("INK_AI_COMPUTE_POOL_ADDRESS"),
  },
};

export function getChains() {
  return Object.values(chains).map(({ key, name, chainId, rpcUrl, explorerUrl, nativeCurrency, gatewayAddress, jobManagerAddress, agentRegistryAddress, computePoolAddress }) => ({
    key,
    name,
    chainId,
    rpcUrl,
    explorerUrl,
    nativeCurrency,
    configured: Boolean(gatewayAddress || jobManagerAddress || agentRegistryAddress || computePoolAddress),
    contracts: {
      gateway: Boolean(gatewayAddress),
      jobManager: Boolean(jobManagerAddress),
      agentRegistry: Boolean(agentRegistryAddress),
      computePool: Boolean(computePoolAddress),
    },
  }));
}
