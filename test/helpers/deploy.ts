import { network } from "hardhat";

const { ethers } = await network.create();

export async function deployAAIHToken() {
    const [owner, user1, user2] = await ethers.getSigners();

    const token = await ethers.deployContract(
        "AAIHToken",
        [owner.address]
    );

    await token.waitForDeployment();

    return {
        token,
        owner,
        user1,
        user2
    };
}