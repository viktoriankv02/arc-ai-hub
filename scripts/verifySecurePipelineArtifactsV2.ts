import { network } from "hardhat";
import { keccak256, toUtf8Bytes } from "ethers";

const ADDR = {
  runtime: process.env.AI_AGENT_RUNTIME_V2 ?? "0xC98D7fFD4961573C41B2B115411074822D9D33bf",
  manager: process.env.AI_JOB_MANAGER_V2 ?? "0x551a8Fa20486f53a446643F01788abf6cCC243A5",
  pool: process.env.AI_COMPUTE_POOL_V2 ?? "0x3E1F5B682A2e6dF9403eb9354aB04d509dB3612c",
  oracle: process.env.AI_REPUTATION_ORACLE_V2 ?? "0xeAaB116532B268e6Fd210E0BC6E33B07C0F0Ec38",
  gateway: process.env.AI_API_GATEWAY_V2 ?? "0x3b2AAF5fbDc33Be0962C696cE2a4D9E82ebAe2c1",
};

const CONTRACTS = [
  ["runtime", "AIAgentRuntimeV2"],
  ["pool", "AIComputePoolV2"],
  ["oracle", "AIReputationOracleV2"],
  ["manager", "AIJobManagerV2"],
  ["gateway", "AIAPIGatewayV2"],
] as const;

function selector(signature: string) {
  return keccak256(toUtf8Bytes(signature)).slice(0, 10);
}

async function main() {
  const { ethers, artifacts } = await network.connect();
  const provider = ethers.provider;

  console.log("=================================");
  console.log("ARC AI HUB - SECURE PIPELINE ARTIFACT VERIFY");
  console.log("=================================");

  for (const [key, contractName] of CONTRACTS) {
    const address = ADDR[key];
    const artifact = await artifacts.readArtifact(contractName);
    const onChain = await provider.getCode(address);
    const localRuntime = artifact.deployedBytecode;

    console.log(`\n${contractName}`);
    console.log("---------------------------------");
    console.log("Address:", address);
    console.log("On-chain bytes:", (onChain.length - 2) / 2);
    console.log("Local runtime bytes:", (localRuntime.length - 2) / 2);
    console.log("On-chain hash:", keccak256(onChain));
    console.log("Local hash:", keccak256(localRuntime));
    console.log("MATCH:", onChain.toLowerCase() === localRuntime.toLowerCase());
  }

  console.log("\nSELECTORS");
  console.log("---------------------------------");
  for (const sig of [
    "owner()",
    "nextAgentId()",
    "nextNodeId()",
    "nextJobId()",
    "nextRequestId()",
    "isController(address)",
    "controllers(address)",
    "gateway()",
    "runtime()",
    "computePool()",
    "reputationOracle()",
    "jobManager()",
  ]) {
    console.log(`${sig} => ${selector(sig)}`);
  }

  console.log("\n=================================");
  console.log("VERIFY COMPLETE");
  console.log("=================================");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
