import { network } from "hardhat";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const OLD_RUNTIME = process.env.AI_AGENT_RUNTIME_V2_ADDRESS ?? "0xC98D7fFD4961573C41B2B115411074822D9D33bf";
const OLD_POOL = process.env.AI_COMPUTE_POOL_V2_ADDRESS ?? "0x3E1F5B682A2e6dF9403eb9354aB04d509dB3612c";
const OLD_ORACLE = process.env.AI_REPUTATION_ORACLE_V2_ADDRESS ?? "0xeAaB116532B268e6Fd210E0BC6E33B07C0F0Ec38";
const OLD_MANAGER = process.env.AI_JOB_MANAGER_V2_ADDRESS ?? "0x551a8Fa20486f53a446643F01788abf6cCC243A5";
const GATEWAY = process.env.AI_API_GATEWAY_V2_ADDRESS ?? "0x3b2AAF5fbDc33Be0962C696cE2a4D9E82ebAe2c1";

function artifactRuntime(contractPath: string) {
  const path = join(process.cwd(), "artifacts", "contracts", contractPath);
  const artifact = JSON.parse(readFileSync(path, "utf8"));
  return artifact.deployedBytecode as string;
}

async function assertRuntimeMatches(
  ethers: any,
  address: string,
  contractPath: string,
  label: string,
) {
  const onChain = await ethers.provider.getCode(address);
  const local = artifactRuntime(contractPath);
  const onChainHash = ethers.keccak256(onChain);
  const localHash = ethers.keccak256(local);

  console.log(`${label}:`);
  console.log(`  address: ${address}`);
  console.log(`  on-chain bytes: ${(onChain.length - 2) / 2}`);
  console.log(`  local bytes:    ${(local.length - 2) / 2}`);
  console.log(`  on-chain hash:  ${onChainHash}`);
  console.log(`  local hash:     ${localHash}`);

  if (onChain.toLowerCase() !== local.toLowerCase()) {
    throw new Error(`${label} bytecode mismatch after deployment`);
  }
}

async function main() {
  const { ethers } = await network.connect("arcTestnet");
  const [owner] = await ethers.getSigners();

  console.log("=================================");
  console.log("ARC AI HUB - SECURE PIPELINE V2 MIGRATION");
  console.log("=================================");
  console.log("Owner:", owner.address);
  console.log("");
  console.log("OLD DEPLOYMENTS");
  console.log("---------------------------------");
  console.log("Runtime:", OLD_RUNTIME);
  console.log("Pool:", OLD_POOL);
  console.log("Oracle:", OLD_ORACLE);
  console.log("Manager:", OLD_MANAGER);
  console.log("Gateway:", GATEWAY);

  // Read immutable dependencies from the currently deployed contracts.
  const oldPool = await ethers.getContractAt("AIComputePoolV2", OLD_POOL);
  const oldOracle = await ethers.getContractAt("AIReputationOracleV2", OLD_ORACLE);
  const oldManager = await ethers.getContractAt("AIJobManagerV2", OLD_MANAGER);

  const rewardToken = await oldPool.rewardToken();
  const reputation = await oldOracle.reputation();
  const scheduler = await oldManager.scheduler();

  console.log("");
  console.log("DEPENDENCIES");
  console.log("---------------------------------");
  console.log("Reward token:", rewardToken);
  console.log("Reputation:", reputation);
  console.log("Scheduler:", scheduler);

  console.log("");
  console.log("1. DEPLOY AIAgentRuntimeV2");
  console.log("---------------------------------");
  const Runtime = await ethers.getContractFactory("AIAgentRuntimeV2");
  const runtime = await Runtime.deploy(owner.address);
  await runtime.waitForDeployment();
  const runtimeAddress = await runtime.getAddress();
  console.log("New Runtime:", runtimeAddress);

  console.log("");
  console.log("2. DEPLOY AIComputePoolV2");
  console.log("---------------------------------");
  const Pool = await ethers.getContractFactory("AIComputePoolV2");
  const pool = await Pool.deploy(rewardToken, owner.address);
  await pool.waitForDeployment();
  const poolAddress = await pool.getAddress();
  console.log("New Pool:", poolAddress);

  console.log("");
  console.log("3. DEPLOY AIReputationOracleV2");
  console.log("---------------------------------");
  const Oracle = await ethers.getContractFactory("AIReputationOracleV2");
  const oracle = await Oracle.deploy(reputation, owner.address);
  await oracle.waitForDeployment();
  const oracleAddress = await oracle.getAddress();
  console.log("New Oracle:", oracleAddress);

  console.log("");
  console.log("4. DEPLOY AIJobManagerV2");
  console.log("---------------------------------");
  const Manager = await ethers.getContractFactory("AIJobManagerV2");
  const manager = await Manager.deploy(owner.address, rewardToken);
  await manager.waitForDeployment();
  const managerAddress = await manager.getAddress();
  console.log("New Manager:", managerAddress);

  console.log("");
  console.log("5. CONNECT CONTRACTS");
  console.log("---------------------------------");
  console.log("Setting Runtime controller...");
  await (await runtime.setController(managerAddress, true)).wait();

  console.log("Setting Pool controller...");
  await (await pool.setController(managerAddress, true)).wait();

  console.log("Setting Oracle controller...");
  await (await oracle.setController(managerAddress, true)).wait();

  console.log("Connecting Scheduler / Runtime / Pool / Oracle to Manager...");
  await (
    await manager.setContracts(
      scheduler,
      runtimeAddress,
      poolAddress,
      oracleAddress,
    )
  ).wait();

  console.log("Updating Gateway -> Manager...");
  const gateway = await ethers.getContractAt("AIAPIGatewayV2", GATEWAY);
  await (await gateway.setJobManager(managerAddress)).wait();

  console.log("");
  console.log("6. VERIFY CONTROLLERS");
  console.log("---------------------------------");
  console.log("Runtime manager controller:", await runtime.isController(managerAddress));
  console.log("Pool manager controller:", await pool.controllers(managerAddress));
  console.log("Oracle manager controller:", await oracle.controllers(managerAddress));
  console.log("Gateway manager:", await gateway.jobManager());
  console.log("Manager scheduler:", await manager.scheduler());
  console.log("Manager runtime:", await manager.runtime());
  console.log("Manager pool:", await manager.computePool());
  console.log("Manager oracle:", await manager.reputationOracle());

  console.log("");
  console.log("7. VERIFY BYTECODE");
  console.log("---------------------------------");
  await assertRuntimeMatches(
    ethers,
    runtimeAddress,
    "ai/AIAgentRuntimeV2.sol/AIAgentRuntimeV2.json",
    "AIAgentRuntimeV2",
  );
  await assertRuntimeMatches(
    ethers,
    poolAddress,
    "ai/AIComputePoolV2.sol/AIComputePoolV2.json",
    "AIComputePoolV2",
  );
  await assertRuntimeMatches(
    ethers,
    oracleAddress,
    "ai/AIReputationOracleV2.sol/AIReputationOracleV2.json",
    "AIReputationOracleV2",
  );
  await assertRuntimeMatches(
    ethers,
    managerAddress,
    "core/AIJobManagerV2.sol/AIJobManagerV2.json",
    "AIJobManagerV2",
  );

  console.log("");
  console.log("=================================");
  console.log("MIGRATION COMPLETE");
  console.log("=================================");
  console.log(`AI_AGENT_RUNTIME_V2_ADDRESS=${runtimeAddress}`);
  console.log(`AI_COMPUTE_POOL_V2_ADDRESS=${poolAddress}`);
  console.log(`AI_REPUTATION_ORACLE_V2_ADDRESS=${oracleAddress}`);
  console.log(`AI_JOB_MANAGER_V2_ADDRESS=${managerAddress}`);
  console.log(`AI_API_GATEWAY_V2_ADDRESS=${GATEWAY}`);
  console.log("");
  console.log("NEXT STEP: register a fresh compute node in the new Pool and run the end-to-end pipeline test.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
