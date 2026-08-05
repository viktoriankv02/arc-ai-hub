import { expect } from "chai";
import { network } from "hardhat";

const { ethers } = await network.create();

describe("AAIHToken", function () {

    async function deployToken() {

        const [owner, user1, user2] =
            await ethers.getSigners();

        const token =
            await ethers.deployContract(
                "AAIHToken",
                [
                    owner.address
                ]
            );

        await token.waitForDeployment();

        return {
            token,
            owner,
            user1,
            user2
        };
    }

    it("Owner should own initial supply", async function () {

        const {
            token,
            owner
        } = await deployToken();

        expect(
            await token.balanceOf(
                owner.address
            )
        ).to.be.gt(0n);

    });

    it("Transfer should work", async function () {

        const {
            token,
            user1
        } = await deployToken();

        await token.transfer(
            user1.address,
            ethers.parseEther("100")
        );

        expect(
            await token.balanceOf(
                user1.address
            )
        ).to.equal(
            ethers.parseEther("100")
        );

    });

    it("Owner can mint", async function () {

        const {
            token,
            user1
        } = await deployToken();

        await token.mint(
            user1.address,
            ethers.parseEther("1000")
        );

        expect(
            await token.balanceOf(
                user1.address
            )
        ).to.equal(
            ethers.parseEther("1000")
        );

    });

});