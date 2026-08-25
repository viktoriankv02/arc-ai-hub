import { ethers } from "ethers";

export const agentRegistryAbi = [
  "function registerAgent(string name,string description,string version,string endpoint) returns (uint256)",
  "function totalAgents() view returns (uint256)",
];

export async function registerAgent(
  ethereum: any,
  registryAddress: string,
  name: string,
  description: string,
  version: string,
  endpoint: string,
): Promise<{ txHash: string; agentId: string }> {
  if (!registryAddress) throw new Error("AI_AGENT_REGISTRY_ADDRESS не налаштований");
  if (!ethereum) throw new Error("MetaMask не знайдено");

  const provider = new ethers.BrowserProvider(ethereum);
  const signer = await provider.getSigner();
  const registry = new ethers.Contract(registryAddress, agentRegistryAbi, signer);
  const tx = await registry.registerAgent(name, description, version, endpoint);
  const receipt = await tx.wait();

  let agentId = "";
  for (const log of receipt.logs ?? []) {
    try {
      const parsed = registry.interface.parseLog(log);
      if (parsed?.name === "AgentRegistered") {
        agentId = parsed.args.agentId.toString();
        break;
      }
    } catch {
      // Ignore logs emitted by other contracts.
    }
  }

  return { txHash: tx.hash, agentId };
}
