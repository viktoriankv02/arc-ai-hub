import hre from "hardhat";

const TREASURY =
"0x3d3d2611001731a614854a0C71FA5987306AF056";

const STAKING =
"0xfA6A146d22bd4ff54E98b33f126bA2cd479d6E24";

async function main() {

    const network = await hre.network.connect("arcTestnet");
    const { ethers } = network;

    const treasury = await ethers.getContractAt(
        "TreasuryV2",
        TREASURY
    );

    console.log("Granting role...");

    const tx =
        await treasury.grantTreasuryManager(
            STAKING
        );

    await tx.wait();

    console.log("Success");
}

main().catch(console.error);