const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("AAIHToken", function () {

    let token;
    let owner;
    let user1;
    let user2;

    beforeEach(async function () {

        [owner, user1, user2] =
            await ethers.getSigners();

        const Token =
            await ethers.getContractFactory("AAIHToken");

        token =
            await Token.deploy(
                owner.address
            );

        await token.waitForDeployment();

    });

    it("Owner should own initial supply", async function () {

        const balance =
            await token.balanceOf(
                owner.address
            );

        expect(balance)
            .to.be.gt(0);

    });

    it("Transfer should work", async function () {

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

    it("Mint by owner", async function () {

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

    it("Non owner cannot mint", async function () {

        await expect(

            token.connect(user1)
                .mint(
                    user1.address,
                    1
                )

        ).to.be.reverted;

    });

});