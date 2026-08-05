import { expect } from "chai";
import { network } from "hardhat";

const { ethers } = await network.create();

describe("NFTBoostManager V3", function () {

    async function deployFixture() {

        const [owner, user1, user2] =
            await ethers.getSigners();

        const manager =
            await ethers.deployContract(
                "NFTBoostManager",
                [
                    owner.address
                ]
            );

        await manager.waitForDeployment();

        return {
            manager,
            owner,
            user1,
            user2
        };
    }

    describe("Deployment", function () {

        it("Should deploy correctly", async function () {

            const {
                manager
            } = await deployFixture();

            expect(
                await manager.version()
            ).to.equal(
                "NFTBoostManager V3"
            );

        });

        it("Should start with zero collections", async function () {

            const {
                manager
            } = await deployFixture();

            expect(
                await manager.collectionCount()
            ).to.equal(0n);

        });

    });

    describe("ERC721 Collections", function () {

        it("Owner can add ERC721 collection", async function () {

            const {
                manager
            } = await deployFixture();

            const collection =
                "0x0000000000000000000000000000000000000001";

            await manager.addERC721Collection(
                collection,
                "Genesis NFT",
                4,
                120,
                0
            );

            expect(
                await manager.collectionCount()
            ).to.equal(1n);

        });

        it("Cannot add duplicate collection", async function () {

            const {
                manager
            } = await deployFixture();

            const collection =
                "0x0000000000000000000000000000000000000001";

            await manager.addERC721Collection(
                collection,
                "Genesis NFT",
                4,
                120,
                0
            );

            await expect(

                manager.addERC721Collection(
                    collection,
                    "Genesis NFT",
                    4,
                    120,
                    0
                )

            ).to.be.rejected;

        });

        it("Non owner cannot add collection", async function () {

            const {
                manager,
                user1
            } = await deployFixture();

            const collection =
                "0x0000000000000000000000000000000000000001";

            await expect(

                manager
                    .connect(user1)
                    .addERC721Collection(
                        collection,
                        "Genesis NFT",
                        4,
                        120,
                        0
                    )

            ).to.be.rejected;

        });

    });
        describe("ERC1155 Collections", function () {

        it("Owner can add ERC1155 collection", async function () {

            const {
                manager
            } = await deployFixture();

            const collection =
                "0x0000000000000000000000000000000000000002";

            await manager.addERC1155Collection(
                collection,
                1,
                "Game NFT",
                2,
                140,
                0
            );

            expect(
                await manager.collectionCount()
            ).to.equal(1n);

        });

    });

    describe("Update Collection", function () {

        it("Owner can update collection", async function () {

            const {
                manager
            } = await deployFixture();

            const collection =
                "0x0000000000000000000000000000000000000001";

            await manager.addERC721Collection(
                collection,
                "Genesis NFT",
                4,
                120,
                0
            );

            await manager.updateCollection(
                collection,
                150,
                true,
                0
            );

            const info =
                await manager.collections(
                    collection
                );

            expect(
                info.boostPercent
            ).to.equal(150);

        });

    });

    describe("Pause", function () {

        it("Owner can pause", async function () {

            const {
                manager
            } = await deployFixture();

            await manager.pause();

            expect(
                await manager.paused()
            ).to.equal(true);

        });

        it("Owner can unpause", async function () {

            const {
                manager
            } = await deployFixture();

            await manager.pause();

            await manager.unpause();

            expect(
                await manager.paused()
            ).to.equal(false);

        });

    });

    describe("Whitelist", function () {

        it("Owner can whitelist user", async function () {

            const {
                manager,
                user1
            } = await deployFixture();

            await manager.setWhitelist(
                user1.address,
                true
            );

            expect(
                await manager.whitelist(
                    user1.address
                )
            ).to.equal(true);

        });

    });

    describe("Blacklist", function () {

        it("Owner can blacklist user", async function () {

            const {
                manager,
                user1
            } = await deployFixture();

            await manager.setBlacklist(
                user1.address,
                true
            );

            expect(
                await manager.blacklist(
                    user1.address
                )
            ).to.equal(true);

        });

    });
        
            describe("View functions", function () {

        it("Can get collection", async function () {

            const {
                manager
            } = await deployFixture();

            const collection =
                "0x0000000000000000000000000000000000000001";

            await manager.addERC721Collection(
                collection,
                "Genesis NFT",
                4,
                120,
                0
            );

            const result =
                await manager.getCollection(0);

            expect(
                result[0]
            ).to.equal(
                collection
            );

        });

    });

});