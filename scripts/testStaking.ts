import hre from "hardhat";

const TOKEN = "0x4bFb7674a83e9F98308E43AF9D766033874e87db";
const STAKING = "0xfA6A146d22bd4ff54E98b33f126bA2cd479d6E24";

async function main() {

    const network = await hre.network.connect("arcTestnet");
    const { ethers } = network;

    const [owner] = await ethers.getSigners();

    const token = await ethers.getContractAt(
        "AAIHToken",
        TOKEN
    );

    const staking = await ethers.getContractAt(
        "AAIHStakingV2",
        STAKING
    );

    console.log("====================================");
    console.log("Wallet:", owner.address);
    console.log("====================================");

    const walletBefore =
        await token.balanceOf(owner.address);

    const stakingBefore =
        await token.balanceOf(STAKING);

    console.log(
        "Wallet before:",
        ethers.formatEther(walletBefore)
    );

    console.log(
        "Staking before:",
        ethers.formatEther(stakingBefore)
    );

    const amount = ethers.parseEther("1000");

    console.log("------------------------------------");
    console.log("Approve...");
    console.log("------------------------------------");

    let tx = await token.approve(
        STAKING,
        amount
    );

    await tx.wait();

    console.log("Approve OK");

    console.log("------------------------------------");
    console.log("Stake...");
    console.log("------------------------------------");

    // Pool 1 = 30 days / 8%
    tx = await staking.stake(
        1,
        amount
    );

    await tx.wait();

    console.log("Stake OK");

    const walletAfter =
        await token.balanceOf(owner.address);

    const stakingAfter =
        await token.balanceOf(STAKING);

    console.log("------------------------------------");

    console.log(
        "Wallet after:",
        ethers.formatEther(walletAfter)
    );

    console.log(
        "Staking after:",
        ethers.formatEther(stakingAfter)
    );

    const count =
        await staking.stakeCount(
            owner.address
        );

    console.log("------------------------------------");
    console.log(
        "Stake count:",
        count.toString()
    );

    const position =
        await staking.getStake(
            owner.address,
            0
        );

    console.log("------------------------------------");

    console.log(
        "Pool:",
        position.poolId.toString()
    );

    console.log(
        "Amount:",
        ethers.formatEther(position.amount)
    );

    console.log(
        "Unlock time:",
        position.unlockTime.toString()
    );

    console.log(
        "Withdrawn:",
        position.withdrawn
    );

    const reward =
        await staking.calculateReward(
            owner.address,
            0
        );

    console.log(
        "Reward:",
        ethers.formatEther(reward)
    );

    console.log("====================================");
}

main().catch(console.error);