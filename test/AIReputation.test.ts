import { expect } from "chai";
import { ethers } from "hardhat";

describe("AIReputation", function () {

    async function deploy() {

        const [owner] =
            await ethers.getSigners();

        const Factory =
            await ethers.getContractFactory(
                "AIReputation"
            );

        const rep =
            await Factory.deploy(
                owner.address
            );

        await rep.waitForDeployment();

        return { rep };
    }

    it("Successful job", async function () {

        const { rep } =
            await deploy();

        await rep.addSuccessfulJob(1);

        const data =
            await rep.agents(1);

        expect(data.completedJobs)
            .to.equal(1);

    });

    it("Rating", async function () {

        const { rep } =
            await deploy();

        await rep.addRating(1,5);

        expect(
            await rep.averageRating(1)
        ).to.equal(500);

    });

    it("Verification", async function () {

        const { rep } =
            await deploy();

        await rep.verifyAgent(1);

        const data =
            await rep.agents(1);

        expect(data.verified)
            .to.equal(true);

    });

});