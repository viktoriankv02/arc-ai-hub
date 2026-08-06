import { expect } from "chai";
import hre from "hardhat";

const { ethers } = await hre.network.create();

describe("AIComputeRewards", function () {

    async function deploy() {

        const [owner, node] =
            await ethers.getSigners();

        const Token =
            await ethers.getContractFactory(
                "AAIHToken"
            );

        const token =
            await Token.deploy(
                owner.address
            );

        await token.waitForDeployment();

        const Rewards =
            await ethers.getContractFactory(
                "AIComputeRewards"
            );

        const rewards =
            await Rewards.deploy(
                await token.getAddress(),
                owner.address
            );

        await rewards.waitForDeployment();

        await token.transfer(
            await rewards.getAddress(),
            ethers.parseEther("100000")
        );

        return {
            token,
            rewards,
            owner,
            node
        };
    }

    it("Should deploy", async function () {

        const { rewards } =
            await deploy();

        expect(
            await rewards.rewardPerJob()
        ).to.equal(
            ethers.parseEther("5")
        );

    });

    it("Owner adds reward", async function () {

        const {
            rewards,
            node
        } = await deploy();

        await rewards.addReward(
            node.address
        );

        expect(
            await rewards.pendingRewards(
                node.address
            )
        ).to.equal(
            ethers.parseEther("5")
        );

    });

    it("Node claims reward", async function () {

        const {
            rewards,
            token,
            node
        } = await deploy();

        await rewards.addReward(
            node.address
        );

        const before =
            await token.balanceOf(
                node.address
            );

        await rewards
            .connect(node)
            .claimReward();

        const after =
            await token.balanceOf(
                node.address
            );

        expect(after - before)
            .to.equal(
                ethers.parseEther("5")
            );

    });

    it("Cannot claim twice", async function () {

        const {
            rewards,
            node
        } = await deploy();

        await rewards.addReward(
            node.address
        );

        await rewards
            .connect(node)
            .claimReward();

        await expect(

            rewards
                .connect(node)
                .claimReward()

        ).to.be.revertedWith(
            "No rewards"
        );

    });

    it("Owner changes reward size", async function () {

        const {
            rewards
        } = await deploy();

        await rewards.setRewardPerJob(
            ethers.parseEther("10")
        );

        expect(
            await rewards.rewardPerJob()
        ).to.equal(
            ethers.parseEther("10")
        );

    });

});