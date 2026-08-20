import { network } from "hardhat";

const ADDR = {
  runtime: process.env.AI_AGENT_RUNTIME_V2 ?? "0xC98D7fFD4961573C41B2B115411074822D9D33bf",
  manager: process.env.AI_JOB_MANAGER_V2 ?? "0x551a8Fa20486f53a446643F01788abf6cCC243A5",
  pool: process.env.AI_COMPUTE_POOL_V2 ?? "0x3E1F5B682A2e6dF9403eb9354aB04d509dB3612c",
  oracle: process.env.AI_REPUTATION_ORACLE_V2 ?? "0xeAaB116532B268e6Fd210E0BC6E33B07C0F0Ec38",
  gateway: process.env.AI_API_GATEWAY_V2 ?? "0x3b2AAF5fbDc33Be0962C696cE2a4D9E82ebAe2c1",
};

async function safe(label: string, fn: () => Promise<unknown>) {
  try {
    const value = await fn();
    console.log(`${label}:`, value);
    return value;
  } catch (error: any) {
    console.log(`${label}: REVERT/ERROR`);
    console.log("  code:", error?.code ?? "unknown");
    console.log("  data:", error?.data ?? "none");
    console.log("  message:", error?.shortMessage ?? error?.message ?? "unknown");
    return undefined;
  }
}

async function rawCall(
  provider: any,
  address: string,
  selector: string,
  label: string,
  args: string = ""
) {
  try {
    const result = await provider.call({
      to: address,
      data: selector + args,
    });
    console.log(`${label}: SUCCESS ${result}`);
    return result;
  } catch (error: any) {
    console.log(`${label}: REVERT/ERROR`);
    console.log("  code:", error?.code ?? "unknown");
    console.log("  data:", error?.data ?? "none");
    console.log("  message:", error?.shortMessage ?? error?.message ?? "unknown");
    return undefined;
  }
}

async function main() {
  const { ethers } = await network.connect("arcTestnet");
  const [signer] = await ethers.getSigners();
  const provider = ethers.provider;

  console.log("=================================");
  console.log("ARC AI HUB - SECURE PIPELINE STATE V2");
  console.log("=================================");
  console.log("Signer:", signer.address);
  console.log("Runtime:", ADDR.runtime);
  console.log("Manager:", ADDR.manager);
  console.log("Pool:", ADDR.pool);
  console.log("Oracle:", ADDR.oracle);
  console.log("Gateway:", ADDR.gateway);

  console.log("\n1. CODE EXISTENCE");
  console.log("---------------------------------");
  for (const [name, address] of Object.entries(ADDR)) {
    const code = await provider.getCode(address);
    console.log(`${name}: length=${code.length}, exists=${code !== "0x"}`);
  }

  const runtime = await ethers.getContractAt("AIAgentRuntimeV2", ADDR.runtime);
  const manager = await ethers.getContractAt("AIJobManagerV2", ADDR.manager);
  const pool = await ethers.getContractAt("AIComputePoolV2", ADDR.pool);
  const oracle = await ethers.getContractAt("AIReputationOracleV2", ADDR.oracle);
  const gateway = await ethers.getContractAt("AIAPIGatewayV2", ADDR.gateway);

  console.log("\n2. RUNTIME");
  console.log("---------------------------------");
  await safe("owner", () => runtime.owner());
  await safe("nextAgentId", () => runtime.nextAgentId());
  await safe("isController(manager)", () => runtime.isController(ADDR.manager));
  await safe("isController(gateway)", () => runtime.isController(ADDR.gateway));
  await safe("getOwnerAgents(signer)", () => runtime.getOwnerAgents(signer.address));

  console.log("\n3. COMPUTE POOL");
  console.log("---------------------------------");
  await safe("owner", () => pool.owner());
  await safe("nextNodeId", () => pool.nextNodeId());
  await safe("controllers(manager)", () => pool.controllers(ADDR.manager));
  await safe("controllers(gateway)", () => pool.controllers(ADDR.gateway));
  await safe("getOwnerNodes(signer)", () => pool.getOwnerNodes(signer.address));

  console.log("\n4. ORACLE");
  console.log("---------------------------------");
  await safe("owner", () => oracle.owner());
  await safe("controllers(manager)", () => oracle.controllers(ADDR.manager));
  await safe("controllers(gateway)", () => oracle.controllers(ADDR.gateway));

  console.log("\n5. JOB MANAGER");
  console.log("---------------------------------");
  await safe("owner", () => manager.owner());
  await safe("gateway", () => manager.gateway());
  await safe("scheduler", () => manager.scheduler());
  await safe("runtime", () => manager.runtime());
  await safe("computePool", () => manager.computePool());
  await safe("reputationOracle", () => manager.reputationOracle());
  await safe("nextJobId", () => manager.nextJobId());

  console.log("\n6. GATEWAY");
  console.log("---------------------------------");
  await safe("owner", () => gateway.owner());
  await safe("jobManager", () => gateway.jobManager());
  await safe("nextRequestId", () => gateway.nextRequestId());

  console.log("\n7. RAW SELECTOR CHECKS");
  console.log("---------------------------------");
  await rawCall(provider, ADDR.runtime, "0x8da5cb5b", "Runtime.owner()");
  await rawCall(provider, ADDR.runtime, "0x30efc498", "Runtime.nextAgentId()");
  await rawCall(provider, ADDR.runtime, "0xb429afeb", "Runtime.isController(signer)", signer.address.slice(2).padStart(64, "0"));
  await rawCall(provider, ADDR.pool, "0x8da5cb5b", "Pool.owner()");
  await rawCall(provider, ADDR.pool, "0x30efc498", "Pool.nextNodeId()");
  await rawCall(provider, ADDR.oracle, "0x8da5cb5b", "Oracle.owner()");
  await rawCall(provider, ADDR.manager, "0x8da5cb5b", "Manager.owner()");
  await rawCall(provider, ADDR.gateway, "0x8da5cb5b", "Gateway.owner()");

  console.log("\n=================================");
  console.log("STATE DEBUG COMPLETE");
  console.log("=================================");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
