import { network } from "hardhat";
import { keccak256 } from "ethers";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const OLD_RUNTIME = process.env.AI_AGENT_RUNTIME_V2_ADDRESS ?? "0xC98D7fFD4961573C41B2B115411074822D9D33bf";
const OLD_POOL = process.env.AI_COMPUTE_POOL_V2_ADDRESS ?? "0x3E1F5B682A2e6dF9403eb9354aB04d509dB3612c";
const OLD_ORACLE = process.env.AI_REPUTATION_ORACLE_V2_ADDRESS ?? "0xeAaB116532B268e6Fd210E0BC6E33B07C0F0Ec38";
const OLD_MANAGER = process.env.AI_JOB_MANAGER_V2_ADDRESS ?? "0x551a8Fa20486f53a446643F01788abf6cCC243A5";
const GATEWAY = process.env.AI_API_GATEWAY_V2_ADDRESS ?? "0x3b2AAF5fbDc33Be0962C696cE2a4D9E82ebAe2c1";

function loadArtifact(contractPath: string) {
  const path = join(process.cwd(), "artifacts", "contracts", contractPath);
  const artifact = JSON.parse(readFileSync(path, "utf8"));
  if (!artifact.deployedBytecode || artifact.deployedBytecode === "0x") {
    throw new Error(`Missing deployedBytecode in ${path}. Run: npx hardhat clean; npx hardhat compile`);
  }
  return artifact;
}

function normalizeImmutableBytes(bytecode: string, immutableReferences: Record<string, Array<{ start: number; length: number }>> | undefined) {
  const bytes = Buffer.from(bytecode.slice(2), "hex");
  for (const refs of Object.values(immutableReferences ?? {})) {
    for (const ref of refs) {
      bytes.fill(0, ref.start, ref.start + ref.length);
    }
  }
  return `0x${bytes.toString("hex")}`;
}

async function assertBytecode(ethers: any, address: string, contractPath: string, label: string) {
  const onChain = await ethers.provider.getCode(address);
  const artifact = loadArtifact(contractPath);
  const local = artifact.deployedBytecode as string;
  const normalizedOnChain = normalizeImmutableBytes(onChain, artifact.immutableReferences);
  const normalizedLocal = normalizeImmutableBytes(local, artifact.immutableReferences);
  const onChainHash = keccak256(onChain);
  const localHash = keccak256(local);
  const normalizedOnChainHash = keccak256(normalizedOnChain);
  const normalizedLocalHash = keccak256(normalizedLocal);

  console.log(`${label}:`);
  console.log(`  address: ${address}`);
  console.log(`  on-chain bytes: ${(onChain.length - 2) / 2}`);
  console.log(`  local bytes:    ${(local.length - 2) / 2}`);
  console.log(`  on-chain hash:  ${onChainHash}`);
  console.log(`  local hash:     ${localHash}`);

  const immutableCount = Object.values(artifact.immutableReferences ?? {}).reduce(
    (sum, refs) => sum + refs.length,
    0,
  );

  if (immutableCount > 0) {
    console.log(`  immutable regions: ${immutableCount}`);
    console.log(`  normalized on-chain hash: ${normalizedOnChainHash}`);
    console.log(`  normalized local hash:    ${normalizedLocalHash}`);
  }

  if (normalizedOnChain.toLowerCase() !== normalizedLocal.toLowerCase()) {
    throw new Error(`${label} bytecode mismatch after immutable normalization`);
  }
}

async function main() {
  const { ethers } = await network.connect("arcTestnet");
  const [owner] = await ethers.getSigners();

  console.log("=================================");
  console.log("ARC AI HUB - FRESH SECURE PIPELINE V2 MIGRATION");
  console.log("=================================");
  console.log("Owner:", owner.address);
  console.log("Gateway:", GATEWAY);

  const oldPool = await ethers.getContractAt("AIComputePoolV2", OLD_POOL);
  const oldOracle = await ethers.getContractAt("AIReputationOracleV2", OLD_ORACLE);
  const oldManager = await ethers.getContractAt("AIJobManagerV2", OLD_MANAGER);
  const gateway = await ethers.getContractAt("AIAPIGatewayV2", GATEWAY);

  const rewardToken = await oldPool.rewardToken();
  const oldReputation = await oldOracle.reputation();
  const scheduler = await oldManager.scheduler();

  console.log("\nDEPENDENCIES");
  console.log("---------------------------------");
  console.log("Reward token:", rewardToken);
  console.log("Legacy reputation (kept untouched):", oldReputation);
  console.log("Scheduler:", scheduler);
  console.log("Current Gateway manager:", await gateway.jobManager());

  console.log("\n1. DEPLOY FRESH RUNTIME");
  console.log("---------------------------------");
  const Runtime = await ethers.getContractFactory("AIAgentRuntimeV2");
  const runtime = await Runtime.deploy(owner.address);
  await runtime.waitForDeployment();
  const runtimeAddress = await runtime.getAddress();
  await assertBytecode(ethers, runtimeAddress, "ai/AIAgentRuntimeV2.sol/AIAgentRuntimeV2.json", "AIAgentRuntimeV2");

  console.log("\n2. DEPLOY FRESH COMPUTE POOL");
  console.log("---------------------------------");
  const Pool = await ethers.getContractFactory("AIComputePoolV2");
  const pool = await Pool.deploy(rewardToken, owner.address);
  await pool.waitForDeployment();
  const poolAddress = await pool.getAddress();
  await assertBytecode(ethers, poolAddress, "ai/AIComputePoolV2.sol/AIComputePoolV2.json", "AIComputePoolV2");

  console.log("\n3. DEPLOY FRESH REPUTATION CONTRACT");
  console.log("---------------------------------");
  const Reputation = await ethers.getContractFactory("AIReputation");
  const reputationContract = await Reputation.deploy(owner.address);
  await reputationContract.waitForDeployment();
  const reputationAddress = await reputationContract.getAddress();
  await assertBytecode(ethers, reputationAddress, "ai/AIReputation.sol/AIReputation.json", "AIReputation");
  console.log("Legacy reputation remains untouched:", oldReputation);
  console.log("Fresh reputation:", reputationAddress);

  console.log("\n4. DEPLOY FRESH REPUTATION ORACLE");
  console.log("---------------------------------");
  const Oracle = await ethers.getContractFactory("AIReputationOracleV2");
  const oracle = await Oracle.deploy(reputationAddress, owner.address);
  await oracle.waitForDeployment();
  const oracleAddress = await oracle.getAddress();
  await assertBytecode(ethers, oracleAddress, "ai/AIReputationOracleV2.sol/AIReputationOracleV2.json", "AIReputationOracleV2");

  console.log("\n5. DEPLOY FRESH JOB MANAGER");
  console.log("---------------------------------");
  const Manager = await ethers.getContractFactory("AIJobManagerV2");
  const manager = await Manager.deploy(owner.address, rewardToken);
  await manager.waitForDeployment();
  const managerAddress = await manager.getAddress();
  await assertBytecode(ethers, managerAddress, "core/AIJobManagerV2.sol/AIJobManagerV2.json", "AIJobManagerV2");

  console.log("\n6. CONFIGURE FRESH PIPELINE");
  console.log("---------------------------------");
  console.log("Runtime controller -> Manager");
  await (await runtime.setController(managerAddress, true)).wait();

  console.log("Pool controller -> Manager");
  await (await pool.setController(managerAddress, true)).wait();

  console.log("Oracle controller -> Manager");
  await (await oracle.setController(managerAddress, true)).wait();

  console.log("Manager gateway -> Gateway");
  await (await manager.setGateway(GATEWAY)).wait();

  console.log("Manager dependencies -> Scheduler/Runtime/Pool/Oracle");
  await (await manager.setContracts(scheduler, runtimeAddress, poolAddress, oracleAddress)).wait();

  console.log("\n7. PRE-CUTOVER VERIFICATION");
  console.log("---------------------------------");
  if (!(await runtime.isController(managerAddress))) throw new Error("Runtime controller was not configured");
  if (!(await pool.controllers(managerAddress))) throw new Error("Pool controller was not configured");
  if (!(await oracle.controllers(managerAddress))) throw new Error("Oracle controller was not configured");
  if ((await manager.gateway()).toLowerCase() !== GATEWAY.toLowerCase()) throw new Error("Manager gateway mismatch");
  if ((await manager.scheduler()).toLowerCase() !== scheduler.toLowerCase()) throw new Error("Manager scheduler mismatch");
  if ((await manager.runtime()).toLowerCase() !== runtimeAddress.toLowerCase()) throw new Error("Manager runtime mismatch");
  if ((await manager.computePool()).toLowerCase() !== poolAddress.toLowerCase()) throw new Error("Manager pool mismatch");
  if ((await manager.reputationOracle()).toLowerCase() !== oracleAddress.toLowerCase()) throw new Error("Manager oracle mismatch");
  if ((await oracle.reputation()).toLowerCase() !== reputationAddress.toLowerCase()) throw new Error("Oracle reputation mismatch");
  console.log("Runtime controller: OK");
  console.log("Pool controller: OK");
  console.log("Oracle controller: OK");
  console.log("Manager wiring: OK");
  console.log("Fresh reputation wiring: OK");

  console.log("\n8. FRESH REPUTATION OWNERSHIP CUTOVER");
  console.log("---------------------------------");
  const reputationOwner = await reputationContract.owner();
  console.log("Fresh reputation owner:", reputationOwner);
  if (reputationOwner.toLowerCase() !== owner.address.toLowerCase()) {
    throw new Error(`Unexpected fresh Reputation owner: ${reputationOwner}`);
  }
  await (await reputationContract.transferOwnership(oracleAddress)).wait();
  console.log("Fresh reputation ownership -> fresh Oracle: OK");

  console.log("\n9. GATEWAY CUTOVER");
  console.log("---------------------------------");
  await (await gateway.setJobManager(managerAddress)).wait();
  console.log("Gateway -> fresh Manager: OK");

  console.log("\n10. FINAL VERIFICATION");
  console.log("---------------------------------");
  console.log("Runtime manager controller:", await runtime.isController(managerAddress));
  console.log("Pool manager controller:", await pool.controllers(managerAddress));
  console.log("Oracle manager controller:", await oracle.controllers(managerAddress));
  console.log("Manager gateway:", await manager.gateway());
  console.log("Gateway manager:", await gateway.jobManager());
  console.log("Oracle reputation:", await oracle.reputation());
  console.log("Reputation owner:", await reputationContract.owner());

  const result = {
    network: "arcTestnet",
    owner: owner.address,
    runtime: runtimeAddress,
    pool: poolAddress,
    oracle: oracleAddress,
    manager: managerAddress,
    gateway: GATEWAY,
    rewardToken,
    reputation: reputationAddress,
    legacyReputation: oldReputation,
    scheduler,
  };

  mkdirSync(join(process.cwd(), "deployments"), { recursive: true });
  writeFileSync(join(process.cwd(), "deployments", "secure-pipeline-v2-latest.json"), JSON.stringify(result, null, 2) + "\n");

  console.log("\n=================================");
  console.log("FRESH MIGRATION COMPLETE");
  console.log("=================================");
  console.log(JSON.stringify(result, null, 2));
  console.log("Saved: deployments/secure-pipeline-v2-latest.json");
  console.log("NEXT: register a fresh node/agent in the new V2 contracts and run the E2E pipeline test.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
