import hre from "hardhat";

const TOKEN = "0x4bFb7674a83e9F98308E43AF9D766033874e87db";
const TREASURY = "0xCfEe60be6175b3D5c4eA43C350bA6057BE1b7F1b";

async function main() {

    const network = await hre.network.connect("arcTestnet");
    const { ethers } = network;

    const [owner] = await ethers.getSigners();

    const token = await ethers.getContractAt("AAIHToken", TOKEN);

    console.log("Owner:", owner.address);

    const beforeOwner = await token.balanceOf(owner.address);
    const beforeTreasury = await token.balanceOf(TREASURY);

    console.log("Owner before :", ethers.formatUnits(beforeOwner,18));
    console.log("Treasury before :", ethers.formatUnits(beforeTreasury,18));

    const amount = ethers.parseUnits("1000000",18);

    console.log("Sending 1,000,000 AAIH...");

    const tx = await token.transfer(TREASURY, amount);

    console.log("Tx:", tx.hash);

    await tx.wait();

    const afterOwner = await token.balanceOf(owner.address);
    const afterTreasury = await token.balanceOf(TREASURY);

    console.log("----------------------------------");
    console.log("Owner after :", ethers.formatUnits(afterOwner,18));
    console.log("Treasury after :", ethers.formatUnits(afterTreasury,18));
    console.log("----------------------------------");
}

main().catch(console.error);