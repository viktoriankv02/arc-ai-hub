export type ChainKey = "arc" | "base" | "ink";

export type ChainDefinition = {
  key: ChainKey;
  name: string;
  chainId: number;
  rpcUrl: string;
  explorerUrl: string;
  nativeCurrency: string;
  gatewayAddress: string;
  jobManagerAddress: string;
  agentRegistryAddress: string;
  computePoolAddress: string;
};
