import { expect } from "chai";
import { network } from "hardhat";

const { ethers } = await network.create();

describe("AAIHStakingV3", function () {

    async function deployFixture() {

        const [owner, user1, user2] =
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
                    "TreasuryV2"
                );

            const treasury =
                await Treasury.deploy(
                    owner.address
                );

            await treasury.waitForDeployment();

        const NFT =
            await ethers.getContractFactory(
                "NFTBoostManager"
            );

        const nft =
            await NFT.deploy(
                owner.address
            );

        await nft.waitForDeployment();

        const Staking =
            await ethers.getContractFactory(
                "AAIHStakingV3"
            );

        const staking =
            await Staking.deploy(
                await token.getAddress(),
                await treasury.getAddress(),
                owner.address
            );

        await staking.waitForDeployment();

        // grant the staking contract permission to withdraw from the treasury
        await treasury.grantTreasuryManager(
            await staking.getAddress()
        );

        return {

            owner,
            user1,
            user2,

            token,
            treasury,
            nft,

            staking

        };

    }

    describe("Deployment", function () {

        it("Should deploy", async function () {

            const {

                staking

            } = await deployFixture();

            expect(

                await staking.getAddress()

            ).to.properAddress;

        });

        it("Owner should be correct", async function () {

            const {

                staking,
                owner

            } = await deployFixture();

            expect(

                await staking.owner()

            ).to.equal(

                owner.address

            );

        });

        it("Token should be correct", async function () {

            const {

                staking,
                token

            } = await deployFixture();

            expect(

                await staking.token()

            ).to.equal(

                await token.getAddress()

            );

        });

    });
        describe("Pools", function () {

        it("Pool 1 should exist", async function () {

            const {
                staking
            } = await deployFixture();

            const pool =
                await staking.pools(1);

            expect(
                pool.active
            ).to.equal(true);

            expect(
                pool.lockDays
            ).to.equal(30);

            expect(
                pool.apy
            ).to.equal(8);

        });

        it("Pool 2 should exist", async function () {

            const {
                staking
            } = await deployFixture();

            const pool =
                await staking.pools(2);

            expect(
                pool.active
            ).to.equal(true);

            expect(
                pool.lockDays
            ).to.equal(90);

            expect(
                pool.apy
            ).to.equal(12);

        });

        it("Pool 3 should exist", async function () {

            const {
                staking
            } = await deployFixture();

            const pool =
                await staking.pools(3);

            expect(
                pool.active
            ).to.equal(true);

            expect(
                pool.lockDays
            ).to.equal(180);

            expect(
                pool.apy
            ).to.equal(18);

        });

        it("Pool 4 should exist", async function () {

            const {
                staking
            } = await deployFixture();

            const pool =
                await staking.pools(4);

            expect(
                pool.active
            ).to.equal(true);

            expect(
                pool.lockDays
            ).to.equal(365);

            expect(
                pool.apy
            ).to.equal(25);

        });

        it("Flexible Pool should exist", async function () {

            const {
                staking
            } = await deployFixture();

            const pool =
                await staking.pools(5);

            expect(
                pool.active
            ).to.equal(true);

            expect(
                pool.flexible
            ).to.equal(true);

            expect(
                pool.lockDays
            ).to.equal(0);

        });

    });

    describe("NFT Manager", function () {

        it("Owner can set NFT manager", async function () {

            const {
                staking,
                nft
            } = await deployFixture();

            await staking.setNFTBoostManager(
                await nft.getAddress()
            );

            expect(

                await staking.nftBoost()

            ).to.equal(

                await nft.getAddress()

            );

        });

        it("Non owner cannot set NFT manager", async function () {

            const {
                staking,
                nft,
                user1
            } = await deployFixture();

            await expect(

                staking
                    .connect(user1)
                    .setNFTBoostManager(
                        await nft.getAddress()
                    )

            ).to.revert(ethers);

        });

    });

    describe("Stake", function () {

        it("User can stake into Pool 1", async function () {

            const {
                staking,
                token,
                user1
            } = await deployFixture();

            await token.transfer(
                user1.address,
                ethers.parseEther("1000")
            );

            await token
                .connect(user1)
                .approve(
                    await staking.getAddress(),
                    ethers.parseEther("1000")
                );

            await staking
                .connect(user1)
                .stake(
                    1,
                    ethers.parseEther("100")
                );

            expect(
                await staking.totalStaked()
            ).to.equal(
                ethers.parseEther("100")
            );

        });

        it("Cannot stake zero amount", async function () {

            const {
                staking,
                user1
            } = await deployFixture();

            await expect(

                staking
                    .connect(user1)
                    .stake(
                        1,
                        0
                    )

            ).to.revert(ethers);

        });

        it("Cannot stake into inactive pool", async function () {

            const {
                staking,
                token,
                user1
            } = await deployFixture();

            await token.transfer(
                user1.address,
                ethers.parseEther("100")
            );

            await ethers.provider.send(
                "hardhat_impersonateAccount",
                [await staking.getAddress()]
            );

            // fund the impersonated address so it can send transactions
            await ethers.provider.send(
                "hardhat_setBalance",
                [await staking.getAddress(), "0x8AC7230489E80000"]
            );
            await token
                .connect(user1)
                .approve(
                    await staking.getAddress(),
                    ethers.parseEther("100")
                );

            await expect(

                staking
                    .connect(user1)
                    .stake(
                        99,
                        ethers.parseEther("100")
                    )

            ).to.revert(ethers);

        });

        it("Multiple users can stake", async function () {

            const {
                staking,
                token,
                user1,
                user2
            } = await deployFixture();

            await token.transfer(
                user1.address,
                ethers.parseEther("100")
            );

            await token.transfer(
                user2.address,
                ethers.parseEther("200")
            );

            await token
                .connect(user1)
                .approve(
                    await staking.getAddress(),
                    ethers.parseEther("100")
                );

            await token
                .connect(user2)
                .approve(
                    await staking.getAddress(),
                    ethers.parseEther("200")
                );

            await staking
                .connect(user1)
                .stake(
                    1,
                    ethers.parseEther("100")
                );

            await staking
                .connect(user2)
                .stake(
                    2,
                    ethers.parseEther("200")
                );

            expect(
                await staking.totalStaked()
            ).to.equal(
                ethers.parseEther("300")
            );

        });

    });

    describe("Withdraw", function () {

        it("Flexible pool user can withdraw", async function () {

            const {
                staking,
                token,
                user1
            } = await deployFixture();

            await token.transfer(
                user1.address,
                ethers.parseEther("500")
            );

            await token
                .connect(user1)
                .approve(
                    await staking.getAddress(),
                    ethers.parseEther("500")
                );

            await staking
                .connect(user1)
                .stake(
                    5,
                    ethers.parseEther("200")
                );

            await staking
                .connect(user1)
                .withdraw(0);

            expect(
                await staking.totalStaked()
            ).to.equal(0n);

        });

        it("Cannot withdraw invalid position", async function () {

            const {
                staking,
                user1
            } = await deployFixture();

            await expect(

                staking
                    .connect(user1)
                    .withdraw(999)

            ).to.revert(ethers);

        });

        it("User balance increases after withdraw", async function () {

            const {
                staking,
                token,
                user1
            } = await deployFixture();

            await token.transfer(
                user1.address,
                ethers.parseEther("300")
            );

            await token
                .connect(user1)
                .approve(
                    await staking.getAddress(),
                    ethers.parseEther("300")
                );

            await staking
                .connect(user1)
                .stake(
                    5,
                    ethers.parseEther("300")
                );

            const before =
                await token.balanceOf(
                    user1.address
                );

            await staking
                .connect(user1)
                .withdraw(0);

            const after =
                await token.balanceOf(
                    user1.address
                );

            expect(after).to.be.gt(before);

        });

    });

});