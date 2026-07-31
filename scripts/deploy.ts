import { network } from "hardhat";

const { ethers } = await network.connect("arcTestnet");

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Deploying from:", deployer.address);

  const Token = await ethers.getContractFactory("AIToken");

  const token = await Token.deploy(deployer.address);

  await token.waitForDeployment();

  console.log("=================================");
  console.log("AIToken deployed successfully!");
  console.log("Contract:", await token.getAddress());
  console.log("Owner:", deployer.address);
  console.log("=================================");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});