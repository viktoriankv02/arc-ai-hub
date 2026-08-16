import { network } from "hardhat";

const TOKEN = "0xCf9b53A409e6F899016F3b9E0E635Dd2A347B3a5";
const RUNTIME = "0xC98D7fFD4961573C41B2B115411074822D9D33bf";
const SCHEDULER = "0xC4274F6dDEa03c04F724B2e2dd9ea4AdFa9C4025";
const REPUTATION = "0x580c024910191C440ac611cE4699904E50952b3A";

async function main() {
  const { ethers } = await network.connect("arcTestnet");
  const [owner] = await ethers.getSigners();

  console.log("=================================");
  console.log("ARC AI HUB - SECURE PIPELINE V2");
  console.log("=================================");
  console.log("Owner:", owner.address);

  const Pool = await ethers.getContractFactory("AIComputePoolV2");
  const pool = await Pool.deploy(TOKEN, owner.address);
  await pool.waitForDeployment();
  const poolAddress = await pool.getAddress();
  console.log("AIComputePoolV2:", poolAddress);

  const Oracle = await ethers.getContractFactory("AIReputationOracleV2");
  const oracle = await Oracle.deploy(REPUTATION, owner.address);
  await oracle.waitForDeployment();
  const oracleAddress = await oracle.getAddress();
  console.log("AIReputationOracleV2:", oracleAddress);

  const Manager = await ethers.getContractFactory("AIJobManagerV2");
  const manager = await Manager.deploy(owner.address, TOKEN);
  await manager.waitForDeployment();
  const managerAddress = await manager.getAddress();
  console.log("AIJobManagerV2:", managerAddress);

  const Gateway = await ethers.getContractFactory("AIAPIGatewayV2");
  const gateway = await Gateway.deploy(owner.address, managerAddress);
  await gateway.waitForDeployment();
  const gatewayAddress = await gateway.getAddress();
  console.log("AIAPIGatewayV2:", gatewayAddress);

  console.log("\nCONFIGURE CONTROLLERS");
  await (await pool.setController(managerAddress, true)).wait();
  await (await oracle.setController(managerAddress, true)).wait();
  await (await manager.setGateway(gatewayAddress)).wait();
  await (await manager.setContracts(SCHEDULER, RUNTIME, poolAddress, oracleAddress)).wait();

  const runtime = await ethers.getContractAt("AIAgentRuntimeV2", RUNTIME);
  await (await runtime.setController(managerAddress, true)).wait();

  const reputation = await ethers.getContractAt("AIReputation", REPUTATION);
  await (await reputation.transferOwnership(oracleAddress)).wait();

  console.log("\n=================================");
  console.log("SECURE PIPELINE V2 DEPLOYED");
  console.log("=================================");
  console.log("AIComputePoolV2=", poolAddress);
  console.log("AIReputationOracleV2=", oracleAddress);
  console.log("AIJobManagerV2=", managerAddress);
  console.log("AIAPIGatewayV2=", gatewayAddress);
  console.log("Runtime controller enabled for manager.");
  console.log("Pool controller enabled for manager.");
  console.log("Oracle controller enabled for manager.");
  console.log("Reputation ownership transferred to Oracle V2.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
