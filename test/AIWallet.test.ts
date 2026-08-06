import { expect } from "chai";
import { network } from "hardhat";

const { ethers } = await network.create();

describe("AIWallet", function () {

    async function deployWallet() {

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

        const wallet =
            await ethers.deployContract(
                "AIWallet",
                [
                    await token.getAddress(),
                    owner.address
                ]
            );

        await wallet.waitForDeployment();

        return {
            wallet,
            token,
            owner,
            user1,
            user2
        };
    }

    it("Should deploy", async function () {

        const {
            wallet
        } = await deployWallet();

        expect(
            await wallet.paymentToken()
        ).to.not.equal(
            ethers.ZeroAddress
        );

    });

    it("Deposit works", async function () {

        const {
            wallet,
            token,
            owner
        } = await deployWallet();

        await token.approve(
            await wallet.getAddress(),
            ethers.parseEther("100")
        );

        await wallet.deposit(
            ethers.parseEther("100")
        );

        expect(
            await wallet.availableBalance(
                owner.address
            )
        ).to.equal(
            ethers.parseEther("100")
        );

    });

    it("Withdraw works", async function () {

        const {
            wallet,
            token,
            owner
        } = await deployWallet();

        await token.approve(
            await wallet.getAddress(),
            ethers.parseEther("100")
        );

        await wallet.deposit(
            ethers.parseEther("100")
        );

        await wallet.withdraw(
            ethers.parseEther("40")
        );

        expect(
            await wallet.availableBalance(
                owner.address
            )
        ).to.equal(
            ethers.parseEther("60")
        );

    });

    it("Internal transfer works", async function () {

        const {
            wallet,
            token,
            owner,
            user1
        } = await deployWallet();

        await token.approve(
            await wallet.getAddress(),
            ethers.parseEther("100")
        );

        await wallet.deposit(
            ethers.parseEther("100")
        );

        await wallet.transferInternal(
            user1.address,
            ethers.parseEther("25")
        );

        expect(
            await wallet.availableBalance(
                user1.address
            )
        ).to.equal(
            ethers.parseEther("25")
        );

    });

    it("Owner can lock", async function () {

        const {
            wallet,
            token,
            owner
        } = await deployWallet();

        await token.approve(
            await wallet.getAddress(),
            ethers.parseEther("100")
        );

        await wallet.deposit(
            ethers.parseEther("100")
        );

        await wallet.lock(
            owner.address,
            ethers.parseEther("50")
        );

        expect(
            await wallet.availableBalance(
                owner.address
            )
        ).to.equal(
            ethers.parseEther("50")
        );

    });

});