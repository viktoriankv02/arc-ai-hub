import hre from "hardhat";

const TREASURY = "0x3d3d2611001731a614854a0C71FA5987306AF056";

async function main() {
    const network = await hre.network.connect("arcTestnet");
    const { ethers } = network;

    const [owner] = await ethers.getSigners();

    const treasury = await ethers.getContractAt(
        "TreasuryV2",
        TREASURY
    );

    console.log("Wallet:", owner.address);

    console.log(
        "Admin:",
        await treasury.hasRole(
            ethers.ZeroHash,
            owner.address
        )
    );
}

main().catch(console.error);