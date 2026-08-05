import { expect } from "chai";
import { network } from "hardhat";

const { ethers } = await network.create();

describe("Treasury", function () {

    async function deployFixture() {

        const [owner, user1] =
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

        const Treasury =
            await ethers.getContractFactory(
                "Treasury"
            );

        const treasury =
            await Treasury.deploy(
                owner.address
            );

        await treasury.waitForDeployment();

        return {
            owner,
            user1,
            token,
            treasury
        };
    }

    describe("Deployment", function () {

        it("Should deploy", async function () {

            const {
                treasury
            } = await deployFixture();

            expect(
                await treasury.getAddress()
            ).to.properAddress;

        });

        it("Owner should be deployer", async function () {

            const {
                treasury,
                owner
            } = await deployFixture();

            expect(
                await treasury.owner()
            ).to.equal(
                owner.address
            );

        });

    });

    describe("ETH", function () {

        it("Should receive ETH", async function () {

            const {
                treasury,
                owner
            } = await deployFixture();

            await owner.sendTransaction({

                to:
                    await treasury.getAddress(),

                value:
                    ethers.parseEther("1")

            });

            expect(

                await treasury.ethBalance()

            ).to.equal(

                ethers.parseEther("1")

            );

        });

    });
        describe("ERC20", function () {

        it("Owner can deposit ERC20", async function () {

            const {
                owner,
                token,
                treasury
            } = await deployFixture();

            await token.approve(
                await treasury.getAddress(),
                ethers.parseEther("1000")
            );

            await treasury.depositToken(
                await token.getAddress(),
                ethers.parseEther("1000")
            );

            expect(
                await token.balanceOf(
                    await treasury.getAddress()
                )
            ).to.equal(
                ethers.parseEther("1000")
            );

        });

        it("Owner can withdraw ERC20", async function () {

            const {
                owner,
                user1,
                token,
                treasury
            } = await deployFixture();

            await token.approve(
                await treasury.getAddress(),
                ethers.parseEther("1000")
            );

            await treasury.depositToken(
                await token.getAddress(),
                ethers.parseEther("1000")
            );

            await treasury.withdrawToken(
                await token.getAddress(),
                user1.address,
                ethers.parseEther("400")
            );

            expect(
                await token.balanceOf(
                    user1.address
                )
            ).to.equal(
                ethers.parseEther("400")
            );

        });

        it("Non owner cannot withdraw", async function () {

            const {
                user1,
                token,
                treasury
            } = await deployFixture();

            await expect(

                treasury
                    .connect(user1)
                    .withdrawToken(
                        await token.getAddress(),
                        user1.address,
                        1
                    )

            ).to.be.rejected;

        });

    });
        describe("ETH Withdraw", function () {

        it("Owner can withdraw ETH", async function () {

            const {
                owner,
                user1,
                treasury
            } = await deployFixture();

            await owner.sendTransaction({
                to: await treasury.getAddress(),
                value: ethers.parseEther("1")
            });

            const before =
                await ethers.provider.getBalance(
                    user1.address
                );

            await treasury.withdrawETH(
                user1.address,
                ethers.parseEther("0.4")
            );

            const after =
                await ethers.provider.getBalance(
                    user1.address
                );

            expect(
                after - before
            ).to.equal(
                ethers.parseEther("0.4")
            );

        });

        it("Non owner cannot withdraw ETH", async function () {

            const {
                treasury,
                user1
            } = await deployFixture();

            await expect(

                treasury
                    .connect(user1)
                    .withdrawETH(
                        user1.address,
                        1
                    )

            ).to.be.rejected;

        });

    });

    describe("View functions", function () {

        it("Token balance should be correct", async function () {

            const {
                token,
                treasury
            } = await deployFixture();

            expect(

                await treasury.tokenBalance(
                    await token.getAddress()
                )

            ).to.equal(0n);

        });

        it("ETH balance should start at zero", async function () {

            const {
                treasury
            } = await deployFixture();

            expect(

                await treasury.ethBalance()

            ).to.equal(0n);

        });

    });

});