import hre from "hardhat";

const TOKEN = "0x4bFb7674a83e9F98308E43AF9D766033874e87db";
const TREASURY = "0xCfEe60be6175b3D5c4eA43C350bA6057BE1b7F1b";

async function main() {

    const network = await hre.network.connect("arcTestnet");
    const { ethers } = network;

    const [owner] = await ethers.getSigners();

    console.log("======================================");
    console.log("Deploying AAIH Staking V2");
    console.log("Owner:", owner.address);
    console.log("======================================");

    const Factory = await ethers.getContractFactory("AAIHStakingV2");

    const staking = await Factory.deploy(
        TOKEN,
        TREASURY,
        owner.address
    );

    await staking.waitForDeployment();

    console.log("======================================");
    console.log("AAIH Staking V2 deployed!");
    console.log(await staking.getAddress());
    console.log("======================================");
}

main().catch(console.error);