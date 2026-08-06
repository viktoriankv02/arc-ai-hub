import { expect } from "chai";
import { network } from "hardhat";

const { ethers } = await network.create();

describe("AIInferenceMarketplaceV2", function () {

    async function deploySystem() {

        const [owner, provider, user] =
            await ethers.getSigners();

        const token =
            await ethers.deployContract(
                "AAIHToken",
                [
                    owner.address
                ]
            );

        await token.waitForDeployment();

        const market =
            await ethers.deployContract(
                "AIInferenceMarketplaceV2",
                [
                    await token.getAddress(),
                    owner.address,
                    owner.address
                ]
            );

        await market.waitForDeployment();

        await token.transfer(
            user.address,
            ethers.parseEther("1000")
        );

        return {
            owner,
            provider,
            user,
            token,
            market
        };
    }

    it("Should deploy", async function () {

        const { market } =
            await deploySystem();

        expect(
            await market.nextAgentId()
        ).to.equal(0n);

    });

    it("Provider registers agent", async function () {

        const {
            market,
            provider
        } =
            await deploySystem();

        await market
            .connect(provider)
            .registerAgent(
                ethers.parseEther("10")
            );

        expect(
            await market.nextAgentId()
        ).to.equal(1n);

    });

    it("User requests inference", async function () {

        const {
            market,
            provider,
            user,
            token
        } =
            await deploySystem();

        await market
            .connect(provider)
            .registerAgent(
                ethers.parseEther("10")
            );

        await token
            .connect(user)
            .approve(
                await market.getAddress(),
                ethers.parseEther("10")
            );

        await market
            .connect(user)
            .requestInference(
                0,
                ethers.id("input")
            );

        expect(
            await market.nextRequestId()
        ).to.equal(1n);

    });

    it("Provider completes inference", async function () {

        const {
            market,
            provider,
            user,
            token
        } =
            await deploySystem();

        await market
            .connect(provider)
            .registerAgent(
                ethers.parseEther("10")
            );

        await token
            .connect(user)
            .approve(
                await market.getAddress(),
                ethers.parseEther("10")
            );

        await market
            .connect(user)
            .requestInference(
                0,
                ethers.id("input")
            );

        await market
            .connect(provider)
            .completeInference(
                0,
                ethers.id("output")
            );

        const request =
            await market.getRequest(0);

        expect(
            request.status
        ).to.equal(1);

    });

    it("Settlement pays provider", async function () {

        const {
            market,
            provider,
            user,
            token
        } =
            await deploySystem();

        await market
            .connect(provider)
            .registerAgent(
                ethers.parseEther("100")
            );

        await token
            .connect(user)
            .approve(
                await market.getAddress(),
                ethers.parseEther("100")
            );

        await market
            .connect(user)
            .requestInference(
                0,
                ethers.id("input")
            );

        await market
            .connect(provider)
            .completeInference(
                0,
                ethers.id("output")
            );

        const before =
            await token.balanceOf(
                provider.address
            );

        await market
            .settleInference(0);

        const after =
            await token.balanceOf(
                provider.address
            );

        expect(after)
            .to.be.gt(before);

    });

});