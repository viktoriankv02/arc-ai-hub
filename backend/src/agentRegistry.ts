import { ethers } from "ethers";
import { config } from "./config";

const registryAbi = [
  "function nextAgentId() view returns (uint256)",
  "function registerAgent(string,string,string) returns (uint256)",
  "function getAgent(uint256) view returns (tuple(uint256 id,address owner,string name,string version,string metadata,bool active))"
];

export type Agent = {
  id: string;
  owner: string;
  name: string;
  version: string;
  metadata: string;
  active: boolean;
};

export function getAgentRegistry() {
  if (!config.agentRegistryAddress) return null;
  const provider = new ethers.JsonRpcProvider(config.arcRpcUrl);
  return new ethers.Contract(config.agentRegistryAddress, registryAbi, provider);
}

export async function listAgents(limit = 50): Promise<Agent[]> {
  const registry = getAgentRegistry();
  if (!registry) return [];

  const next = Number(await registry.nextAgentId());
  const start = Math.max(0, next - Math.min(limit, 50));
  const agents: Agent[] = [];

  for (let id = start; id < next; id++) {
    try {
      const a = await registry.getAgent(id);
      agents.push({
        id: a.id.toString(),
        owner: a.owner,
        name: a.name,
        version: a.version,
        metadata: a.metadata,
        active: a.active
      });
    } catch {
      // Ignore sparse/unavailable registry entries.
    }
  }

  return agents.reverse();
}
