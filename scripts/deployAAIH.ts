import { network } from "hardhat";

async function main() {
    const { ethers } = await network.connect("arcTestnet");

    const [deployer] = await ethers.getSigners();

    console.log("======================================");
    console.log("Deploying Arc AI Hub Token...");
    console.log("Deployer:", deployer.address);
    console.log("======================================");

    const Token = await ethers.getContractFactory("AAIHToken");

    const token = await Token.deploy(deployer.address);

    await token.waitForDeployment();

    console.log("======================================");
    console.log("DEPLOY SUCCESS");
    console.log("Contract:", await token.getAddress());
    console.log("Owner:", deployer.address);
    console.log("======================================");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});