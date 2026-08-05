import { ethers } from "hardhat";

export async function deployAAIHToken() {
    const [owner, user1, user2] = await ethers.getSigners();

    const Token = await ethers.getContractFactory("AAIHToken");

    const token = await Token.deploy(
        owner.address
    );

    await token.waitForDeployment();

    return {
        token,
        owner,
        user1,
        user2
    };
}