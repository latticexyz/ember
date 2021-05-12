// import { expect } from "chai";
// import hre, { ethers } from "hardhat";
// import { PerlinConfig } from "../../packages/hashing/dist";
// import {
//     hashCoordinate,
//     makeDfsArgs,
//     makePathArgs,
//     makeSpecialRegionArgs,
//     makeTouchAndPerlinArgs,
//     makeTouchArgs,
// } from "./utils/TestUtils";
// import { initializeWorld, World } from "./utils/TestWorld";

// const MAX = 31;

// describe("Dungeon", function () {
//     let world: World;

//     describe("Be able to init in a valid region", function () {
//         before(async function () {
//             world = await initializeWorld();
//         });
//         it("should be able to init in an empty region", async function () {
//             this.timeout(0);
//             const snarkArgs = await makeSpecialRegionArgs(
//                 0,
//                 0,
//                 MAX,
//                 MAX,
//                 hre.initializers.snarkConstants.DISABLE_ZK_CHECKS
//             );
//             //@ts-ignore
//             await expect(world.user1DungeonFacet.initializePlayer(...snarkArgs)).to.emit(
//                 world.contracts.dungeonFacet,
//                 "PlayerInitialized"
//             );
//         });
//         it("should not be able to init in a isMined region", async function () {
//             this.timeout(0);
//             const snarkArgs = await makeSpecialRegionArgs(
//                 0,
//                 0,
//                 MAX,
//                 MAX,
//                 hre.initializers.snarkConstants.DISABLE_ZK_CHECKS
//             );
//             //@ts-ignore
//             await expect(world.user2DungeonFacet.initializePlayer(...snarkArgs)).to.be.revertedWith(
//                 "this region has already been mined"
//             );
//         });
//         it("should not be able to init twice", async function () {
//             this.timeout(0);
//             const snarkArgs = await makeSpecialRegionArgs(
//                 1,
//                 1,
//                 MAX,
//                 MAX,
//                 hre.initializers.snarkConstants.DISABLE_ZK_CHECKS
//             );
//             //@ts-ignore
//             await expect(world.user1DungeonFacet.initializePlayer(...snarkArgs)).to.be.revertedWith(
//                 "this player has already been initialized"
//             );
//         });
//     });
//     describe("Be able to mine", function () {
//         before(async function () {
//             this.timeout(0);
//             world = await initializeWorld();
//             const snarkArgs = await makeSpecialRegionArgs(
//                 0,
//                 0,
//                 MAX,
//                 MAX,
//                 hre.initializers.snarkConstants.DISABLE_ZK_CHECKS
//             );
//             //@ts-ignore
//             await expect(world.user1DungeonFacet.initializePlayer(...snarkArgs)).to.emit(
//                 world.contracts.dungeonFacet,
//                 "PlayerInitialized"
//             );
//         });
//         it("should be able to mine an unmined tile with a valid path", async function () {
//             const path1 = [
//                 { x: 7, y: 0 },
//                 { x: 8, y: 0 },
//             ];
//             const snarkArgs = await makeTouchArgs(path1, MAX, MAX, hre.initializers.snarkConstants.DISABLE_ZK_CHECKS);
//             //@ts-ignore
//             await expect(world.user1DungeonFacet.mineTile(...snarkArgs))
//                 .to.emit(world.contracts.dungeonFacet, "TileMined")
//                 .withArgs(hashCoordinate(8, 0), hashCoordinate(1, 0), true, world.user1.address);
//         });
//         it("should be able to mine an another unmined tile with a valid path", async function () {
//             const path1 = [
//                 { x: 7, y: 0 },
//                 { x: 8, y: 0 },
//                 { x: 8, y: 1 },
//             ];
//             const snarkArgs = await makeTouchArgs(path1, MAX, MAX, hre.initializers.snarkConstants.DISABLE_ZK_CHECKS);
//             //@ts-ignore
//             await expect(world.user1DungeonFacet.mineTile(...snarkArgs))
//                 .to.emit(world.contracts.dungeonFacet, "TileMined")
//                 .withArgs(hashCoordinate(8, 1), hashCoordinate(1, 0), true, world.user1.address);
//         });
//         it("should be able to mine an another (another) unmined tile with a valid path", async function () {
//             const path1 = [
//                 { x: 7, y: 0 },
//                 { x: 8, y: 0 },
//                 { x: 8, y: 1 },
//                 { x: 8, y: 2 },
//             ];
//             const snarkArgs = await makeTouchArgs(path1, MAX, MAX, hre.initializers.snarkConstants.DISABLE_ZK_CHECKS);
//             //@ts-ignore
//             await expect(world.user1DungeonFacet.mineTile(...snarkArgs))
//                 .to.emit(world.contracts.dungeonFacet, "TileMined")
//                 .withArgs(hashCoordinate(8, 2), hashCoordinate(1, 0), true, world.user1.address);
//         });
//         if (!hre.initializers.snarkConstants.DISABLE_ZK_CHECKS) {
//             it("should not be able to mine a tile with an invalid path (skipping blocks)", async function () {
//                 const path1 = [
//                     { x: 7, y: 0 },
//                     { x: 8, y: 0 },
//                     { x: 8, y: 1 },
//                     { x: 8, y: 3 },
//                 ];
//                 const snarkArgs = await makeTouchArgs(
//                     path1,
//                     MAX,
//                     MAX,
//                     hre.initializers.snarkConstants.DISABLE_ZK_CHECKS
//                 );
//                 //@ts-ignore
//                 await expect(world.user1DungeonFacet.mineTile(...snarkArgs)).to.be.revertedWith(
//                     "failed touch proof check"
//                 );
//             });
//         }
//         it("should not be able to mine a tile with an invalid path (going through unmined blocks)", async function () {
//             const path1 = [
//                 { x: 7, y: 0 },
//                 { x: 8, y: 0 },
//                 { x: 8, y: 1 },
//                 { x: 8, y: 2 },
//                 { x: 8, y: 3 },
//                 { x: 8, y: 4 },
//             ];
//             const snarkArgs = await makeTouchArgs(path1, MAX, MAX, hre.initializers.snarkConstants.DISABLE_ZK_CHECKS);
//             //@ts-ignore
//             await expect(world.user1DungeonFacet.mineTile(...snarkArgs)).to.be.revertedWith(
//                 "one tile in the path is not mined!"
//             );
//         });
//         it("should not be able to mine a tile that has already been mined", async function () {
//             const path1 = [
//                 { x: 7, y: 0 },
//                 { x: 8, y: 0 },
//                 { x: 8, y: 1 },
//                 { x: 8, y: 2 },
//             ];
//             const snarkArgs = await makeTouchArgs(path1, MAX, MAX, hre.initializers.snarkConstants.DISABLE_ZK_CHECKS);
//             //@ts-ignore
//             await expect(world.user1DungeonFacet.mineTile(...snarkArgs)).to.be.revertedWith(
//                 "this tile has already been mined!"
//             );
//         });
//     });
//     describe("Be able to claim", function () {
//         before(async function () {
//             this.timeout(0);
//             world = await initializeWorld();
//             // init player 1
//             const snarkArgs1 = await makeSpecialRegionArgs(
//                 0,
//                 0,
//                 MAX,
//                 MAX,
//                 hre.initializers.snarkConstants.DISABLE_ZK_CHECKS
//             );
//             //@ts-ignore
//             await expect(world.user1DungeonFacet.initializePlayer(...snarkArgs1)).to.not.be.reverted;
//             // mine a bunch of tiles
//             const path1 = [
//                 { x: 7, y: 0 },
//                 { x: 8, y: 0 },
//             ];
//             const snarkArgs2 = await makeTouchArgs(path1, MAX, MAX, hre.initializers.snarkConstants.DISABLE_ZK_CHECKS);
//             //@ts-ignore
//             await expect(world.user1DungeonFacet.mineTile(...snarkArgs2)).to.not.be.reverted;
//             const path2 = [
//                 { x: 7, y: 0 },
//                 { x: 8, y: 0 },
//                 { x: 8, y: 1 },
//             ];
//             const snarkArgs3 = await makeTouchArgs(path2, MAX, MAX, hre.initializers.snarkConstants.DISABLE_ZK_CHECKS);
//             //@ts-ignore
//             await expect(world.user1DungeonFacet.mineTile(...snarkArgs3)).to.not.be.reverted;
//             const path3 = [
//                 { x: 7, y: 0 },
//                 { x: 8, y: 0 },
//                 { x: 9, y: 0 },
//             ];
//             const snarkArgs4 = await makeTouchArgs(path3, MAX, MAX, hre.initializers.snarkConstants.DISABLE_ZK_CHECKS);
//             //@ts-ignore
//             await expect(world.user1DungeonFacet.mineTile(...snarkArgs4)).to.not.be.reverted;
//             // init player 2
//             const snarkArgs5 = await makeSpecialRegionArgs(
//                 2,
//                 0,
//                 MAX,
//                 MAX,
//                 hre.initializers.snarkConstants.DISABLE_ZK_CHECKS
//             );
//             //@ts-ignore
//             await expect(world.user2DungeonFacet.initializePlayer(...snarkArgs5)).to.not.be.reverted;
//         });
//         it("should be able to claim a tile", async function () {
//             const path1 = [
//                 { x: 7, y: 0 },
//                 { x: 8, y: 0 },
//             ];
//             const snarkArgs = await makeTouchArgs(path1, MAX, MAX, hre.initializers.snarkConstants.DISABLE_ZK_CHECKS);
//             //@ts-ignore
//             await expect(world.user1DungeonFacet.claimTile(...snarkArgs))
//                 .to.emit(world.contracts.dungeonFacet, "TileClaimed")
//                 .withArgs(hashCoordinate(8, 0), world.user1.address);
//         });
//         it("should add resources from previously owned tile to new owner", async function () {
//             // TODO
//         });
//         it("should not be able to claim a tile that is not mined", async function () {
//             const path1 = [
//                 { x: 7, y: 0 },
//                 { x: 8, y: 0 },
//                 { x: 8, y: 1 },
//                 { x: 8, y: 2 },
//             ];
//             const snarkArgs = await makeTouchArgs(path1, MAX, MAX, hre.initializers.snarkConstants.DISABLE_ZK_CHECKS);
//             //@ts-ignore
//             await expect(world.user1DungeonFacet.claimTile(...snarkArgs)).to.be.revertedWith(
//                 "this tile has not been mined!"
//             );
//         });
//         it("should not be able to claim a tile with an invalid path (going through unmined blocks)", async function () {
//             const path1 = [
//                 { x: 16, y: 0 },
//                 { x: 15, y: 0 },
//                 { x: 14, y: 0 },
//                 { x: 13, y: 0 },
//                 { x: 12, y: 0 },
//                 { x: 11, y: 0 },
//                 { x: 10, y: 0 },
//                 { x: 9, y: 0 },
//             ];
//             const snarkArgs = await makeTouchArgs(path1, MAX, MAX, hre.initializers.snarkConstants.DISABLE_ZK_CHECKS);
//             //@ts-ignore
//             await expect(world.user2DungeonFacet.claimTile(...snarkArgs)).to.be.revertedWith(
//                 "one tile in the path is not mined!"
//             );
//         });
//         if (!hre.initializers.snarkConstants.DISABLE_ZK_CHECKS) {
//             it("should not be able to claim a tile with an invalid path (skipping blocks)", async function () {
//                 const path1 = [
//                     { x: 7, y: 0 },
//                     { x: 9, y: 0 },
//                 ];
//                 const snarkArgs = await makeTouchArgs(
//                     path1,
//                     MAX,
//                     MAX,
//                     hre.initializers.snarkConstants.DISABLE_ZK_CHECKS
//                 );
//                 //@ts-ignore
//                 await expect(world.user1DungeonFacet.claimTile(...snarkArgs)).to.be.revertedWith(
//                     "failed touch proof check"
//                 );
//             });
//         }
//     });
//     describe("Be able to harvest", function () {
//         before(async function () {
//             this.timeout(0);
//             world = await initializeWorld();
//             // init player 1
//             const snarkArgs1 = await makeSpecialRegionArgs(
//                 0,
//                 0,
//                 MAX,
//                 MAX,
//                 hre.initializers.snarkConstants.DISABLE_ZK_CHECKS
//             );
//             //@ts-ignore
//             await expect(world.user1DungeonFacet.initializePlayer(...snarkArgs1)).to.not.be.reverted;

//             const tilesToMineAndClaim: any[] = [];
//             for (const [x, _] of Array(9).entries()) {
//                 tilesToMineAndClaim.push({ x: 7 + x, y: 0 });
//             }
//             for (const [i, entry] of Array(8).entries()) {
//                 const path = tilesToMineAndClaim.slice(0, i + 2);
//                 const snarkArgs = await makeTouchArgs(
//                     path,
//                     MAX,
//                     MAX,
//                     hre.initializers.snarkConstants.DISABLE_ZK_CHECKS
//                 );
//                 //@ts-ignore
//                 await expect(world.user1DungeonFacet.mineTile(...snarkArgs)).to.not.be.reverted;
//                 //@ts-ignore
//                 await expect(world.user1DungeonFacet.claimTile(...snarkArgs))
//                     .to.emit(world.contracts.dungeonFacet, "TileClaimed")
//                     .withArgs(hashCoordinate(8 + i, 0), world.user1.address);
//             }
//             // mine+claim one out of the line to test the dfs
//             const pathOutOfTheLine = [
//                 { x: 8, y: 0 },
//                 { x: 8, y: 1 },
//             ];
//             const snarkArgs = await makeTouchArgs(
//                 pathOutOfTheLine,
//                 MAX,
//                 MAX,
//                 hre.initializers.snarkConstants.DISABLE_ZK_CHECKS
//             );
//             //@ts-ignore
//             await expect(world.user1DungeonFacet.mineTile(...snarkArgs)).to.not.be.reverted;
//             //@ts-ignore
//             await expect(world.user1DungeonFacet.claimTile(...snarkArgs))
//                 .to.emit(world.contracts.dungeonFacet, "TileClaimed")
//                 .withArgs(hashCoordinate(8, 1), world.user1.address);

//             await world.user1DungeonFacet.upgradeTile(hashCoordinate(8, 0), 2);
//             await world.user1DungeonFacet.upgradeTile(hashCoordinate(8, 1), 2);
//             await world.user1DungeonFacet.upgradeTile(hashCoordinate(9, 0), 2);
//             for (const [i, entry] of Array(100).entries()) {
//                 await ethers.provider.send("evm_mine", []);
//             }
//         });
//         it("should be able to harvest", async function () {
//             this.timeout(0);
//             const path1 = [
//                 { x: 8, y: 0 },
//                 { x: 9, y: 0 },
//                 { x: 8, y: 0 },
//                 { x: 8, y: 1 },
//             ];
//             const snarkArgs = await makeDfsArgs(path1, MAX, MAX, hre.initializers.snarkConstants.DISABLE_ZK_CHECKS);
//             //@ts-ignore
//             await world.user1DungeonFacet.harvestTiles(...snarkArgs);
//             await world.user1DungeonFacet.upgradeTile(hashCoordinate(10, 0), 2);
//             const path2 = [
//                 { x: 8, y: 0 },
//                 { x: 9, y: 0 },
//                 { x: 10, y: 0 },
//                 { x: 8, y: 0 },
//                 { x: 8, y: 1 },
//             ];
//             const snarkArgsNext = await makeDfsArgs(path2, MAX, MAX, hre.initializers.snarkConstants.DISABLE_ZK_CHECKS);
//             //@ts-ignore
//             await world.user1DungeonFacet.harvestTiles(...snarkArgsNext);
//         });
//     });
//     describe("Be able to wall", function () {
//         before(async function () {
//             this.timeout(0);
//             world = await initializeWorld();
//             // init player 1
//             const snarkArgs1 = await makeSpecialRegionArgs(
//                 0,
//                 0,
//                 MAX,
//                 MAX,
//                 hre.initializers.snarkConstants.DISABLE_ZK_CHECKS
//             );
//             //@ts-ignore
//             await expect(world.user1DungeonFacet.initializePlayer(...snarkArgs1)).to.not.be.reverted;

//             const tilesToMineAndClaim: any[] = [];
//             for (const [x, _] of Array(9).entries()) {
//                 tilesToMineAndClaim.push({ x: 7 + x, y: 0 });
//             }
//             for (const [i, entry] of Array(8).entries()) {
//                 const path = tilesToMineAndClaim.slice(0, i + 2);
//                 const snarkArgs = await makeTouchArgs(
//                     path,
//                     MAX,
//                     MAX,
//                     hre.initializers.snarkConstants.DISABLE_ZK_CHECKS
//                 );
//                 //@ts-ignore
//                 await expect(world.user1DungeonFacet.mineTile(...snarkArgs)).to.not.be.reverted;
//                 //@ts-ignore
//                 await expect(world.user1DungeonFacet.claimTile(...snarkArgs))
//                     .to.emit(world.contracts.dungeonFacet, "TileClaimed")
//                     .withArgs(hashCoordinate(8 + i, 0), world.user1.address);
//             }
//         });
//         it("should be able to wall a tile", async function () {
//             await world.user1DungeonFacet.initiateWallTile(hashCoordinate(8, 0));
//             const nTilesWithDelayedActions = await world.user1GetterFacet.getNTilesWithDelayedActions();
//             expect(nTilesWithDelayedActions.toNumber()).to.be.eq(1);
//             for (const [i, entry] of Array(60).entries()) {
//                 await ethers.provider.send("evm_mine", []);
//             }
//             await world.user1DungeonFacet.completeWallTile(hashCoordinate(8, 0));
//             const nTilesWithDelayedActionsAfter = await world.user1GetterFacet.getNTilesWithDelayedActions();
//             expect(nTilesWithDelayedActionsAfter.toNumber()).to.be.eq(0);
//             const tile = await world.user1GetterFacet.getTile(hashCoordinate(8, 0));
//             expect(tile.isWalled).to.be.true;
//         });
//     });
//     describe("Be able to unwall", function () {
//         before(async function () {
//             this.timeout(0);
//             world = await initializeWorld();
//             // init player 1
//             const snarkArgs1 = await makeSpecialRegionArgs(
//                 0,
//                 0,
//                 MAX,
//                 MAX,
//                 hre.initializers.snarkConstants.DISABLE_ZK_CHECKS
//             );
//             //@ts-ignore
//             await expect(world.user1DungeonFacet.initializePlayer(...snarkArgs1)).to.not.be.reverted;

//             const tilesToMineAndClaim: any[] = [];
//             for (const [x, _] of Array(9).entries()) {
//                 tilesToMineAndClaim.push({ x: 7 + x, y: 0 });
//             }
//             for (const [i, entry] of Array(8).entries()) {
//                 const path = tilesToMineAndClaim.slice(0, i + 2);
//                 const snarkArgs = await makeTouchArgs(
//                     path,
//                     MAX,
//                     MAX,
//                     hre.initializers.snarkConstants.DISABLE_ZK_CHECKS
//                 );
//                 //@ts-ignore
//                 await expect(world.user1DungeonFacet.mineTile(...snarkArgs)).to.not.be.reverted;
//                 //@ts-ignore
//                 await expect(world.user1DungeonFacet.claimTile(...snarkArgs))
//                     .to.emit(world.contracts.dungeonFacet, "TileClaimed")
//                     .withArgs(hashCoordinate(8 + i, 0), world.user1.address);
//             }
//             await world.user1DungeonFacet.initiateWallTile(hashCoordinate(8, 0));
//             const nTilesWithDelayedActions = await world.user1GetterFacet.getNTilesWithDelayedActions();
//             expect(nTilesWithDelayedActions.toNumber()).to.be.eq(1);
//             for (const [i, entry] of Array(60).entries()) {
//                 await ethers.provider.send("evm_mine", []);
//             }
//             await world.user1DungeonFacet.completeWallTile(hashCoordinate(8, 0));
//             const nTilesWithDelayedActionsAfter = await world.user1GetterFacet.getNTilesWithDelayedActions();
//             expect(nTilesWithDelayedActionsAfter.toNumber()).to.be.eq(0);
//             const tile = await world.user1GetterFacet.getTile(hashCoordinate(8, 0));
//             expect(tile.isWalled).to.be.true;
//         });
//         it("should be able to unwall a tile", async function () {
//             const path1 = [
//                 { x: 7, y: 0 },
//                 { x: 8, y: 0 },
//             ];
//             const snarkArgs = await makeTouchArgs(path1, MAX, MAX, hre.initializers.snarkConstants.DISABLE_ZK_CHECKS);
//             //@ts-ignore
//             await expect(world.user1DungeonFacet.initiateUnwallTile(...snarkArgs)).to.not.be.reverted;
//             for (const [i, entry] of Array(10).entries()) {
//                 await ethers.provider.send("evm_mine", []);
//             }
//             //@ts-ignore
//             await expect(world.user1DungeonFacet.completeUnwallTile(...snarkArgs))
//                 .to.emit(world.contracts.dungeonFacet, "TileUnwalled")
//                 .withArgs(hashCoordinate(8, 0));
//             const tile = await world.user1GetterFacet.getTile(hashCoordinate(8, 0));
//             expect(tile.isWalled).to.be.false;
//         });
//     });
//     describe("Be able to force mine", function () {
//         before(async function () {
//             this.timeout(0);
//             world = await initializeWorld();
//             // init player 1
//             const snarkArgs1 = await makeSpecialRegionArgs(
//                 0,
//                 0,
//                 MAX,
//                 MAX,
//                 hre.initializers.snarkConstants.DISABLE_ZK_CHECKS
//             );
//             //@ts-ignore
//             await expect(world.user1DungeonFacet.initializePlayer(...snarkArgs1)).to.not.be.reverted;

//             const tilesToMineAndClaim: any[] = [];
//             for (const [x, _] of Array(9).entries()) {
//                 tilesToMineAndClaim.push({ x: 7 + x, y: 0 });
//             }
//             for (const [i, entry] of Array(8).entries()) {
//                 const path = tilesToMineAndClaim.slice(0, i + 2);
//                 const snarkArgs = await makeTouchArgs(
//                     path,
//                     MAX,
//                     MAX,
//                     hre.initializers.snarkConstants.DISABLE_ZK_CHECKS
//                 );
//                 //@ts-ignore
//                 await expect(world.user1DungeonFacet.mineTile(...snarkArgs)).to.not.be.reverted;
//                 //@ts-ignore
//                 await expect(world.user1DungeonFacet.claimTile(...snarkArgs))
//                     .to.emit(world.contracts.dungeonFacet, "TileClaimed")
//                     .withArgs(hashCoordinate(8 + i, 0), world.user1.address);
//             }
//             // init player 2
//             const snarkArgs2 = await makeSpecialRegionArgs(
//                 2,
//                 0,
//                 MAX,
//                 MAX,
//                 hre.initializers.snarkConstants.DISABLE_ZK_CHECKS
//             );
//             //@ts-ignore
//             await expect(world.user2DungeonFacet.initializePlayer(...snarkArgs2)).to.not.be.reverted;
//         });
//         it("should not be able to mine in a region controlled by another player", async function () {
//             const path1 = [
//                 { x: 16, y: 1 },
//                 { x: 15, y: 1 },
//             ];
//             const snarkArgs = await makeTouchArgs(path1, MAX, MAX, hre.initializers.snarkConstants.DISABLE_ZK_CHECKS);
//             //@ts-ignore
//             await expect(world.user2DungeonFacet.mineTile(...snarkArgs)).to.be.revertedWith(
//                 "someone else controls the to region"
//             );
//         });
//         it("should be able to force mine in a region it does not control", async function () {
//             const perlin1: PerlinConfig = {
//                 floor: true,
//                 key: 42,
//                 mirrorX: false,
//                 mirrorY: false,
//                 scale: 4,
//             };
//             const perlin2: PerlinConfig = {
//                 floor: true,
//                 key: 43,
//                 mirrorX: false,
//                 mirrorY: false,
//                 scale: 4,
//             };
//             const path1 = [
//                 { x: 16, y: 1 },
//                 { x: 15, y: 1 },
//             ];
//             const snarkArgs1 = await makeTouchArgs(path1, MAX, MAX, hre.initializers.snarkConstants.DISABLE_ZK_CHECKS);
//             const snarkArgs2 = await makeTouchAndPerlinArgs(
//                 path1,
//                 MAX,
//                 MAX,
//                 perlin1,
//                 perlin2,
//                 hre.initializers.snarkConstants.DISABLE_ZK_CHECKS
//             );
//             //@ts-ignore
//             await expect(world.user2DungeonFacet.initiateForceMineTile(...snarkArgs1)).to.not.be.reverted;

//             for (const [i, entry] of Array(5).entries()) {
//                 await ethers.provider.send("evm_mine", []);
//             }
//             // completing early
//             //@ts-ignore
//             await expect(world.user2DungeonFacet.completeForceMineTile(...snarkArgs2)).to.be.revertedWith(
//                 "you cannot complete this delayed action yet"
//             );
//             for (const [i, entry] of Array(6).entries()) {
//                 await ethers.provider.send("evm_mine", []);
//             }
//             //@ts-ignore
//             await expect(world.user2DungeonFacet.completeForceMineTile(...snarkArgs2))
//                 .to.emit(world.contracts.dungeonFacet, "TileMined")
//                 .withArgs(hashCoordinate(15, 1), hashCoordinate(1, 0), true, world.user2.address);
//             const tile = await world.user1GetterFacet.getTile(hashCoordinate(15, 1));
//             expect(tile.isMined).to.be.true;
//         });
//     });
//     describe("Getters", function () {
//         before(async function () {
//             this.timeout(0);
//             world = await initializeWorld();
//             // init player 1
//             const snarkArgs1 = await makeSpecialRegionArgs(
//                 0,
//                 0,
//                 MAX,
//                 MAX,
//                 hre.initializers.snarkConstants.DISABLE_ZK_CHECKS
//             );
//             //@ts-ignore
//             await expect(world.user1DungeonFacet.initializePlayer(...snarkArgs1)).to.not.be.reverted;
//             // mine a bunch of tiles
//             const path1 = [
//                 { x: 7, y: 0 },
//                 { x: 8, y: 0 },
//             ];
//             const snarkArgs2 = await makeTouchArgs(path1, MAX, MAX, hre.initializers.snarkConstants.DISABLE_ZK_CHECKS);
//             //@ts-ignore
//             await expect(world.user1DungeonFacet.mineTile(...snarkArgs2)).to.not.be.reverted;
//             const path2 = [
//                 { x: 7, y: 0 },
//                 { x: 8, y: 0 },
//                 { x: 8, y: 1 },
//             ];
//             const snarkArgs3 = await makeTouchArgs(path2, MAX, MAX, hre.initializers.snarkConstants.DISABLE_ZK_CHECKS);
//             //@ts-ignore
//             await expect(world.user1DungeonFacet.mineTile(...snarkArgs3)).to.not.be.reverted;
//             const path3 = [
//                 { x: 7, y: 0 },
//                 { x: 8, y: 0 },
//                 { x: 9, y: 0 },
//             ];
//             const snarkArgs4 = await makeTouchArgs(path3, MAX, MAX, hre.initializers.snarkConstants.DISABLE_ZK_CHECKS);
//             //@ts-ignore
//             await expect(world.user1DungeonFacet.mineTile(...snarkArgs4)).to.not.be.reverted;
//             // init player 2
//             const snarkArgs5 = await makeSpecialRegionArgs(
//                 2,
//                 0,
//                 MAX,
//                 MAX,
//                 hre.initializers.snarkConstants.DISABLE_ZK_CHECKS
//             );
//             //@ts-ignore
//             await expect(world.user2DungeonFacet.initializePlayer(...snarkArgs5)).to.not.be.reverted;
//             // Claim
//             const path4 = [
//                 { x: 7, y: 0 },
//                 { x: 8, y: 0 },
//             ];
//             const snarkArgs6 = await makeTouchArgs(path4, MAX, MAX, hre.initializers.snarkConstants.DISABLE_ZK_CHECKS);
//             //@ts-ignore
//             await expect(world.user1DungeonFacet.claimTile(...snarkArgs6)).to.not.be.reverted;
//         });
//         it("should be able to get a single tile", async function () {
//             const hash = hashCoordinate(0, 0);
//             const tile = await world.user1GetterFacet.getTile(hash);
//             expect(tile.isMined).to.be.true;
//             expect(tile.owner).to.be.eq(world.user1.address);
//         });
//         it("should be able to get an unmined tile", async function () {
//             const hash = hashCoordinate(20, 20);
//             const tile = await world.user1GetterFacet.getTile(hash);
//             expect(tile.isMined).to.be.false;
//         });
//         it("should be able to get a claimed tile", async function () {
//             const hash = hashCoordinate(8, 0);
//             const tile = await world.user1GetterFacet.getTile(hash);
//             expect(tile.isMined).to.be.true;
//             expect(tile.owner).to.be.eq(world.user1.address);
//         });
//         it("should be able to get all tiles", async function () {
//             const nTiles = await world.user1GetterFacet.getNTiles();
//             const tiles = await world.user1GetterFacet.bulkGetTiles(0, nTiles);
//             expect(tiles.length).to.be.eq(64 + 64 + 3);
//         });
//         it("should be able to get all regions", async function () {
//             const nRegions = await world.user1GetterFacet.getNRegions();
//             const regions = await world.user1GetterFacet.bulkGetRegions(0, nRegions);
//             expect(regions.length).to.be.eq(3);
//         });
//         it("should be able to get all players", async function () {
//             const nPlayers = await world.user1GetterFacet.getNPlayers();
//             const players = await world.user1GetterFacet.bulkGetPlayers(0, nPlayers);
//             expect(players.length).to.be.eq(2);
//         });
//     });
// });
