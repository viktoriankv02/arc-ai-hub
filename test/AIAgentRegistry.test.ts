import { expect } from "chai";
import { network } from "hardhat";

const { ethers } = await network.create();

describe("AIAgentRegistry", function () {

    async function deployRegistry() {

        const [owner, dev1, dev2] =
            await ethers.getSigners();

        const registry =
            await ethers.deployContract(
                "AIAgentRegistry",
                [owner.address]
            );

        await registry.waitForDeployment();

        return {
            registry,
            owner,
            dev1,
            dev2
        };
    }

    it("Should deploy", async function () {

        const { registry } =
            await deployRegistry();

        expect(
            await registry.nextAgentId()
        ).to.equal(1);

    });

    it("Developer can register agent", async function () {

        const {
            registry,
            dev1
        } = await deployRegistry();

        await registry
            .connect(dev1)
            .registerAgent(
                "GPT Agent",
                "AI assistant",
                "1.0",
                "https://api.test"
            );

        const agent =
            await registry.agents(1);

        expect(agent.name)
            .to.equal("GPT Agent");

        expect(agent.developer)
            .to.equal(dev1.address);

    });

    it("Developer can update own agent", async function () {

        const {
            registry,
            dev1
        } = await deployRegistry();

        await registry
            .connect(dev1)
            .registerAgent(
                "Agent",
                "Old",
                "1.0",
                "url"
            );

        await registry
            .connect(dev1)
            .updateAgent(
                1,
                "New Description",
                "2.0",
                "new-url"
            );

        const agent =
            await registry.agents(1);

        expect(agent.description)
            .to.equal("New Description");

        expect(agent.version)
            .to.equal("2.0");

    });

    it("Other developer cannot update", async function () {

        const {
            registry,
            dev1,
            dev2
        } = await deployRegistry();

        await registry
            .connect(dev1)
            .registerAgent(
                "Agent",
                "Desc",
                "1.0",
                "url"
            );

        await expect(

            registry
                .connect(dev2)
                .updateAgent(
                    1,
                    "Hack",
                    "9.0",
                    "hack"
                )

        ).to.be.revertedWith("Not developer");

    });

    it("Owner can verify agent", async function () {

        const {
            registry,
            dev1
        } = await deployRegistry();

        await registry
            .connect(dev1)
            .registerAgent(
                "Agent",
                "Desc",
                "1.0",
                "url"
            );

        await registry.verifyAgent(1);

        const agent =
            await registry.agents(1);

        expect(agent.verified)
            .to.equal(true);

    });

    it("Developer list should work", async function () {

        const {
            registry,
            dev1
        } = await deployRegistry();

        await registry
            .connect(dev1)
            .registerAgent(
                "One",
                "",
                "",
                ""
            );

        await registry
            .connect(dev1)
            .registerAgent(
                "Two",
                "",
                "",
                ""
            );

        const list =
            await registry.getDeveloperAgents(
                dev1.address
            );

        expect(list.length)
            .to.equal(2);

    });

});