import { expect } from "chai";
import hre from "hardhat";

const { ethers } = await hre.network.create();

describe("AIAgentEngine", function () {

    async function deploy() {

        const [owner, user, agent] = await ethers.getSigners();

        const Token = await ethers.getContractFactory("AAIHToken");

        const token = await Token.deploy(owner.address);

        await token.waitForDeployment();

        const Engine = await ethers.getContractFactory("AIAgentEngine");

        const engine = await Engine.deploy(
            owner.address,
            await token.getAddress()
        );

        await engine.waitForDeployment();

        return {
            owner,
            user,
            agent,
            token,
            engine
        };
    }

    it("Complete Job Flow", async function () {

        const { user, agent, token, engine } = await deploy();

        await token.transfer(
            user.address,
            ethers.parseEther("1000")
        );

        await token.connect(user).approve(
            await engine.getAddress(),
            ethers.parseEther("100")
        );

        await engine.connect(user).createJob(
            1,
            "Analyze BTC",
            ethers.parseEther("100")
        );

        await engine.assignJob(0);

        await engine.completeJob(0);

        await engine.payReward(
            0,
            agent.address
        );

        expect(
            await token.balanceOf(agent.address)
        ).to.equal(
            ethers.parseEther("100")
        );

    });

});