import hre from "hardhat";

const TOKEN = "0x4bFb7674a83e9F98308E43AF9D766033874e87db";

async function main() {

    const network = await hre.network.connect("arcTestnet");
    const { ethers } = network;

    const [owner] = await ethers.getSigners();

    console.log("======================================");
    console.log("Deploying AAIH Staking...");
    console.log("Owner:", owner.address);
    console.log("======================================");

    const Factory = await ethers.getContractFactory("AAIHStaking");

    const staking = await Factory.deploy(
        TOKEN,
        owner.address
    );

    await staking.waitForDeployment();

    console.log("======================================");
    console.log("AAIH Staking deployed!");
    console.log("Contract:", await staking.getAddress());
    console.log("======================================");
}

main().catch(console.error);