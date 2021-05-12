// import { expect } from "chai";
// import hre, { ethers } from "hardhat";
// import { PerlinConfig } from "../../packages/hashing/dist";
// import { Coordinate } from "./utils/GenerateTouchInput";
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

// describe("Creatures", function () {
//     let world: World;

//     describe("be able to spawn and move around", function () {
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

//             await world.user1DungeonFacet.upgradeTile(hashCoordinate(0, 0), 6);
//             await world.user1DungeonFacet.upgradeTile(hashCoordinate(1, 0), 6);
//             await world.user1DungeonFacet.upgradeTile(hashCoordinate(2, 0), 6);
//             // init player 2
//             const snarkArgs2 = await makeSpecialRegionArgs(
//                 1,
//                 0,
//                 MAX,
//                 MAX,
//                 hre.initializers.snarkConstants.DISABLE_ZK_CHECKS
//             );
//             //@ts-ignore
//             await expect(world.user2DungeonFacet.initializePlayer(...snarkArgs2)).to.not.be.reverted;

//             await world.user2DungeonFacet.upgradeTile(hashCoordinate(8, 0), 6);
//             await world.user2DungeonFacet.upgradeTile(hashCoordinate(9, 0), 6);
//             await world.user2DungeonFacet.upgradeTile(hashCoordinate(10, 0), 6);
//         });
//         it("should be able to spawn creatures", async function () {
//             this.timeout(0);
//             await expect(world.user1CreaturesFacet.spawnCreature(hashCoordinate(3, 3), 0, 0)).to.emit(
//                 world.contracts.creatureFacet,
//                 "CreatureMovedToRegion"
//             );
//         });
//         it("should be able to spawn creatures and move", async function () {
//             this.timeout(0);
//             await expect(world.user1CreaturesFacet.spawnCreature(hashCoordinate(3, 3), 0, 0)).to.emit(
//                 world.contracts.creatureFacet,
//                 "CreatureMovedToRegion"
//             );
//             const [creatureBef] = await world.user1GetterFacet.bulkGetCreaturesByIds([0]);
//             expect(creatureBef.tileId).to.eq(hashCoordinate(3, 3));
//             const path: Coordinate[] = [
//                 { x: 3, y: 3 },
//                 { x: 4, y: 3 },
//                 { x: 5, y: 3 },
//                 { x: 6, y: 3 },
//                 { x: 7, y: 3 },
//                 { x: 8, y: 3 },
//             ];
//             const snarkArgs1 = await makePathArgs(path, MAX, MAX, hre.initializers.snarkConstants.DISABLE_ZK_CHECKS);
//             //@ts-ignore
//             await expect(world.user1CreaturesFacet.moveCreatures(...snarkArgs1, [0])).to.not.be.reverted;
//             const [creature] = await world.user1GetterFacet.bulkGetCreaturesByIds([0]);
//             expect(creature.tileId).to.eq(hashCoordinate(8, 3));
//             // not be able to move into the same region
//             const path2: Coordinate[] = [
//                 { x: 8, y: 3 },
//                 { x: 9, y: 3 },
//             ];
//             const snarkArgs2 = await makePathArgs(path2, MAX, MAX, hre.initializers.snarkConstants.DISABLE_ZK_CHECKS);
//             //@ts-ignore
//             await expect(world.user1CreaturesFacet.moveCreatures(...snarkArgs2, [0])).to.be.revertedWith(
//                 "cannot move to same region"
//             );
//         });
//     });
//     describe("be able to spawn and fight", function () {
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

//             await world.user1DungeonFacet.upgradeTile(hashCoordinate(0, 0), 6);
//             await world.user1DungeonFacet.upgradeTile(hashCoordinate(1, 0), 6);
//             await world.user1DungeonFacet.upgradeTile(hashCoordinate(2, 0), 6);

//             await expect(world.user1CreaturesFacet.spawnCreature(hashCoordinate(3, 3), 0, 0)).to.emit(
//                 world.contracts.creatureFacet,
//                 "CreatureMovedToRegion"
//             );
//             await expect(world.user1CreaturesFacet.spawnCreature(hashCoordinate(4, 3), 0, 0)).to.emit(
//                 world.contracts.creatureFacet,
//                 "CreatureMovedToRegion"
//             );
//             await expect(world.user1CreaturesFacet.spawnCreature(hashCoordinate(4, 4), 0, 0)).to.emit(
//                 world.contracts.creatureFacet,
//                 "CreatureMovedToRegion"
//             );
//             await expect(world.user1CreaturesFacet.spawnCreature(hashCoordinate(4, 4), 0, 0)).to.emit(
//                 world.contracts.creatureFacet,
//                 "CreatureMovedToRegion"
//             );
//             // init player 2
//             const snarkArgs2 = await makeSpecialRegionArgs(
//                 1,
//                 0,
//                 MAX,
//                 MAX,
//                 hre.initializers.snarkConstants.DISABLE_ZK_CHECKS
//             );
//             //@ts-ignore
//             await expect(world.user2DungeonFacet.initializePlayer(...snarkArgs2)).to.not.be.reverted;

//             await world.user2DungeonFacet.upgradeTile(hashCoordinate(8, 0), 6);
//             await world.user2DungeonFacet.upgradeTile(hashCoordinate(9, 0), 6);
//             await world.user2DungeonFacet.upgradeTile(hashCoordinate(10, 0), 6);

//             await expect(world.user2CreaturesFacet.spawnCreature(hashCoordinate(11, 3), 0, 1)).to.emit(
//                 world.contracts.creatureFacet,
//                 "CreatureMovedToRegion"
//             );
//             await expect(world.user2CreaturesFacet.spawnCreature(hashCoordinate(12, 3), 0, 1)).to.emit(
//                 world.contracts.creatureFacet,
//                 "CreatureMovedToRegion"
//             );
//         });
//         it("should be able to fight", async function () {
//             this.timeout(0);
//             const creaturesBef = await world.user1GetterFacet.bulkGetCreaturesByIds([0, 1, 2, 3, 4, 5]);
//             const path: Coordinate[] = [
//                 { x: 3, y: 3 },
//                 { x: 4, y: 3 },
//                 { x: 4, y: 4 },
//                 { x: 4, y: 3 },
//                 { x: 5, y: 3 },
//                 { x: 6, y: 3 },
//                 { x: 7, y: 3 },
//                 { x: 8, y: 3 },
//             ];
//             const snarkArgs1 = await makePathArgs(path, MAX, MAX, hre.initializers.snarkConstants.DISABLE_ZK_CHECKS);
//             // trying to not fight creatures
//             //@ts-ignore
//             await expect(world.user1CreaturesFacet.moveCreatures(...snarkArgs1, [0, 1, 2, 3])).to.be.revertedWith(
//                 "ennemy creature in regionId not found on path"
//             );
//             const path2: Coordinate[] = [
//                 { x: 3, y: 3 },
//                 { x: 4, y: 3 },
//                 { x: 4, y: 4 },
//                 { x: 4, y: 3 },
//                 { x: 5, y: 3 },
//                 { x: 6, y: 3 },
//                 { x: 7, y: 3 },
//                 { x: 8, y: 3 },
//                 { x: 9, y: 3 },
//                 { x: 10, y: 3 },
//                 { x: 11, y: 3 },
//                 { x: 12, y: 3 },
//                 { x: 13, y: 3 },
//             ];
//             const snarkArgs2 = await makePathArgs(path2, MAX, MAX, hre.initializers.snarkConstants.DISABLE_ZK_CHECKS);
//             //@ts-ignore
//             const tx = await world.user1CreaturesFacet.moveCreatures(...snarkArgs2, [0, 1, 2, 3]);
//             const creaturesAfter = await world.user1GetterFacet.bulkGetCreaturesByIds([0, 1, 2, 3, 4, 5]);
//             for (const i of [0, 1, 2, 3]) {
//                 expect(creaturesAfter[i].tileId).to.be.eq(hashCoordinate(13, 3));
//                 expect(creaturesAfter[i].life.toNumber()).to.be.greaterThan(0);
//             }
//             for (const i of [4, 5]) {
//                 expect(creaturesAfter[i].life.toNumber()).to.be.eq(0);
//             }
//             //const receipt = await tx.wait();
//             //const creatureInterface = world.user1CreaturesFacet.interface;
//             //const combatArgs = receipt.events?.map(e => creatureInterface.parseLog(e)).filter(e => e.name === "Combat").pop()?.args
//             //if(combatArgs) {
//             //  // console.log(combatArgs)
//             //  // console.log(JSON.stringify(parseCombatLog(combatArgs.squad1, combatArgs.squad2, combatArgs.trace), null, 2))
//             //}
//         });
//     });
// });
