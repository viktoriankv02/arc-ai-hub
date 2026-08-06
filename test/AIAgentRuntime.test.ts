import { expect } from "chai";
import { network } from "hardhat";

const { ethers } = await network.create();

describe("AIAgentRuntime", function () {

    async function deployRuntime() {

        const [owner, developer, user] =
            await ethers.getSigners();

        const runtime =
            await ethers.deployContract(
                "AIAgentRuntime",
                [
                    owner.address
                ]
            );

        await runtime.waitForDeployment();

        return {
            runtime,
            owner,
            developer,
            user
        };
    }

    it("Should deploy", async function () {

        const { runtime } =
            await deployRuntime();

        expect(
            await runtime.nextAgentId()
        ).to.equal(0n);

    });

    it("Developer can register agent", async function () {

        const {
            runtime,
            developer
        } =
            await deployRuntime();

        await runtime
            .connect(developer)
            .registerAgent(
                "GPT Agent",
                "https://localhost",
                "ipfs://metadata",
                "1.0"
            );

        expect(
            await runtime.nextAgentId()
        ).to.equal(1n);

    });

    it("Developer owns registered agent", async function () {

        const {
            runtime,
            developer
        } =
            await deployRuntime();

        await runtime
            .connect(developer)
            .registerAgent(
                "Agent",
                "endpoint",
                "uri",
                "1.0"
            );

        const agent =
            await runtime.getAgent(0);

        expect(agent.owner)
            .to.equal(developer.address);

    });

    it("Owner can start agent", async function () {

        const {
            runtime,
            developer
        } =
            await deployRuntime();

        await runtime
            .connect(developer)
            .registerAgent(
                "Agent",
                "endpoint",
                "uri",
                "1.0"
            );

        await runtime
            .connect(developer)
            .startAgent(0);

        const agent =
            await runtime.getAgent(0);

        expect(agent.status)
            .to.equal(1);

    });

    it("Another user cannot start agent", async function () {

        const {
            runtime,
            developer,
            user
        } =
            await deployRuntime();

        await runtime
            .connect(developer)
            .registerAgent(
                "Agent",
                "endpoint",
                "uri",
                "1.0"
            );

        await expect(

            runtime
                .connect(user)
                .startAgent(0)

        ).to.be.revertedWithCustomError(runtime, "NotAgentOwner");

    });

});