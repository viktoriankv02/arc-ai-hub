import hre from "hardhat";

async function main() {

    const network = await hre.network.connect("arcTestnet");
    const { ethers } = network;

    const [owner] = await ethers.getSigners();

    console.log("======================================");
    console.log("Deploying Treasury V2...");
    console.log("Owner:", owner.address);
    console.log("======================================");

    const Factory = await ethers.getContractFactory("TreasuryV2");

    const treasury = await Factory.deploy(
        owner.address
    );

    await treasury.waitForDeployment();

    console.log("======================================");
    console.log("Treasury V2 deployed!");
    console.log(await treasury.getAddress());
    console.log("======================================");
}

main().catch(console.error);