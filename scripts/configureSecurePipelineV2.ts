import { network } from "hardhat";

const RUNTIME = process.env.AI_AGENT_RUNTIME_V2 ?? "0xC98D7fFD4961573C41B2B115411074822D9D33bf";
const MANAGER = process.env.AI_JOB_MANAGER_V2 ?? "0x551a8Fa20486f53a446643F01788abf6cCC243A5";
const POOL = process.env.AI_COMPUTE_POOL_V2 ?? "0x3E1F5B682A2e6dF9403eb9354aB04d509dB3612c";
const GATEWAY = process.env.AI_API_GATEWAY_V2 ?? "0x3b2AAF5fbDc33Be0962C696cE2a4D9E82ebAe2c1";
const ORACLE = process.env.AI_REPUTATION_ORACLE_V2 ?? "0xeAaB116532B268e6Fd210E0BC6E33B07C0F0Ec38";
const SCHEDULER = process.env.AI_SCHEDULER ?? "0xC4274F6dDEa03c04F724B2e2dd9ea4AdFa9C4025";

async function main() {
  const { ethers } = await network.connect("arcTestnet");
  const [owner] = await ethers.getSigners();

  console.log("=================================");
  console.log("ARC AI HUB - CONFIGURE SECURE PIPELINE V2");
  console.log("=================================");
  console.log("Owner:", owner.address);
  console.log("Runtime:", RUNTIME);
  console.log("Manager:", MANAGER);
  console.log("Pool:", POOL);
  console.log("Gateway:", GATEWAY);
  console.log("Oracle:", ORACLE);
  console.log("Scheduler:", SCHEDULER);

  const runtime = await ethers.getContractAt("AIAgentRuntimeV2", RUNTIME);
  const manager = await ethers.getContractAt("AIJobManagerV2", MANAGER);
  const pool = await ethers.getContractAt("AIComputePoolV2", POOL);
  const oracle = await ethers.getContractAt("AIReputationOracleV2", ORACLE);

  console.log("\n1. ENABLE MANAGER CONTROLLERS");
  if (!(await runtime.isController(MANAGER))) {
    const tx = await runtime.setController(MANAGER, true);
    console.log("Runtime controller TX:", tx.hash);
    await tx.wait();
  } else console.log("Runtime controller already enabled.");

  if (!(await pool.controllers(MANAGER))) {
    const tx = await pool.setController(MANAGER, true);
    console.log("Pool controller TX:", tx.hash);
    await tx.wait();
  } else console.log("Pool controller already enabled.");

  if (!(await oracle.controllers(MANAGER))) {
    const tx = await oracle.setController(MANAGER, true);
    console.log("Oracle controller TX:", tx.hash);
    await tx.wait();
  } else console.log("Oracle controller already enabled.");

  console.log("\n2. CONFIGURE MANAGER LINKS");
  const currentGateway = await manager.gateway();
  const currentScheduler = await manager.scheduler();
  const currentRuntime = await manager.runtime();
  const currentPool = await manager.computePool();
  const currentOracle = await manager.reputationOracle();

  console.log("Current gateway:", currentGateway);
  console.log("Current scheduler:", currentScheduler);
  console.log("Current runtime:", currentRuntime);
  console.log("Current pool:", currentPool);
  console.log("Current oracle:", currentOracle);

  if (currentGateway.toLowerCase() !== GATEWAY.toLowerCase()) {
    const tx = await manager.setGateway(GATEWAY);
    console.log("Gateway TX:", tx.hash);
    await tx.wait();
  }

  if (
    currentScheduler.toLowerCase() !== SCHEDULER.toLowerCase() ||
    currentRuntime.toLowerCase() !== RUNTIME.toLowerCase() ||
    currentPool.toLowerCase() !== POOL.toLowerCase() ||
    currentOracle.toLowerCase() !== ORACLE.toLowerCase()
  ) {
    const tx = await manager.setContracts(SCHEDULER, RUNTIME, POOL, ORACLE);
    console.log("Manager contracts TX:", tx.hash);
    await tx.wait();
  } else console.log("Manager links already correct.");

  console.log("\n3. VERIFY");
  console.log("Runtime controller:", await runtime.isController(MANAGER));
  console.log("Pool controller:", await pool.controllers(MANAGER));
  console.log("Oracle controller:", await oracle.controllers(MANAGER));
  console.log("Manager gateway:", await manager.gateway());
  console.log("Manager scheduler:", await manager.scheduler());
  console.log("Manager runtime:", await manager.runtime());
  console.log("Manager pool:", await manager.computePool());
  console.log("Manager oracle:", await manager.reputationOracle());

  console.log("\n=================================");
  console.log("SECURE PIPELINE V2 CONFIGURATION COMPLETE");
  console.log("=================================");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
