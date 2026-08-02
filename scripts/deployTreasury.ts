import hre from "hardhat";

async function main() {

    const network = await hre.network.connect();

    const { ethers } = network;

    const [owner] = await ethers.getSigners();

    console.log("Deploy Treasury...");
    console.log(owner.address);

    const Treasury = await ethers.getContractFactory("Treasury");

    const treasury = await Treasury.deploy(owner.address);

    await treasury.waitForDeployment();

    console.log("--------------------------------");
    console.log("Treasury deployed");
    console.log(await treasury.getAddress());
    console.log("--------------------------------");
}

main().catch(console.error);