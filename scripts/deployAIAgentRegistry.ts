import { network } from "hardhat";

const { ethers } = await network.getOrCreate("arcTestnet");

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Deploying AIAgentRegistry from:", deployer.address);

  const Registry = await ethers.getContractFactory("AIAgentRegistry");
  const registry = await Registry.deploy(deployer.address);

  await registry.waitForDeployment();

  const address = await registry.getAddress();

  console.log("=================================");
  console.log("AIAgentRegistry deployed successfully!");
  console.log("Contract:", address);
  console.log("Owner:", deployer.address);
  console.log("=================================");
  console.log(`AI_AGENT_REGISTRY_ADDRESS=${address}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
