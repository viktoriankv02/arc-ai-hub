import { ethers } from "ethers";
import { config } from "./config";

const poolAbi = [
  "function nextNodeId() view returns (uint256)",
  "function getNode(uint256) view returns (tuple(uint256 id,address operator,string region,string gpu,uint256 gpuMemory,uint256 cpuCores,uint256 ramGb,bool active,uint256 score))"
];

export type ComputeNode = {
  id: string;
  operator: string;
  region: string;
  gpu: string;
  gpuMemory: string;
  cpuCores: string;
  ramGb: string;
  active: boolean;
  score: string;
};

export async function listComputeNodes(limit = 50): Promise<ComputeNode[]> {
  if (!config.computePoolAddress) return [];
  const provider = new ethers.JsonRpcProvider(config.arcRpcUrl);
  const pool = new ethers.Contract(config.computePoolAddress, poolAbi, provider);
  const next = Number(await pool.nextNodeId());
  const start = Math.max(0, next - Math.min(limit, 50));
  const nodes: ComputeNode[] = [];

  for (let id = start; id < next; id++) {
    try {
      const n = await pool.getNode(id);
      nodes.push({
        id: n.id.toString(),
        operator: n.operator,
        region: n.region,
        gpu: n.gpu,
        gpuMemory: n.gpuMemory.toString(),
        cpuCores: n.cpuCores.toString(),
        ramGb: n.ramGb.toString(),
        active: n.active,
        score: n.score.toString()
      });
    } catch {
      // Ignore sparse/unavailable pool entries.
    }
  }

  return nodes.reverse();
}
