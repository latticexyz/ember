// import { expect } from "chai";
// import hre from "hardhat";
// import { PerlinConfig } from "../../packages/hashing/dist";
// import {
//     makeDfsArgs,
//     makePathArgs,
//     makeSpecialRegionArgs,
//     makeTouchAndPerlinArgs,
//     makeTouchArgs,
// } from "./utils/TestUtils";
// import { initializeWorld, World } from "./utils/TestWorld";

// describe("Snarks", function () {
//     let world: World;

//     describe("Snarks should be valid for valid inputs", function () {
//         before(async function () {
//             world = await initializeWorld();
//         });

//         it("should go through the dfs verifier", async function () {
//             this.timeout(0);
//             if (!hre.initializers.snarkConstants.DISABLE_ZK_CHECKS) {
//                 expect(
//                     await world.user1Verifier3.verifyDfsProof(
//                         //@ts-ignore
//                         ...(await makeDfsArgs(
//                             [
//                                 { x: 0, y: 0 },
//                                 { x: 1, y: 0 },
//                                 { x: 1, y: 1 },
//                                 { x: 1, y: 2 },
//                                 { x: 0, y: 0 },
//                                 { x: 0, y: 1 },
//                             ],
//                             256,
//                             256,
//                             hre.initializers.snarkConstants.DISABLE_ZK_CHECKS
//                         ))
//                     )
//                 ).to.be.true;
//             }
//         });

//         it("should go through the special region verifier", async function () {
//             this.timeout(0);
//             if (!hre.initializers.snarkConstants.DISABLE_ZK_CHECKS) {
//                 expect(
//                     await world.user1Verifier1.verifySpecialRegionProof(
//                         //@ts-ignore
//                         ...(await makeSpecialRegionArgs(
//                             -2,
//                             0,
//                             16,
//                             16,
//                             hre.initializers.snarkConstants.DISABLE_ZK_CHECKS
//                         ))
//                     )
//                 ).to.be.true;
//             }
//         });
//         it("should go through the touch verifier", async function () {
//             this.timeout(0);
//             if (!hre.initializers.snarkConstants.DISABLE_ZK_CHECKS) {
//                 expect(
//                     await world.user1Verifier1.verifyTouchProof(
//                         //@ts-ignore
//                         ...(await makeTouchArgs(
//                             [
//                                 { x: -2, y: 0 },
//                                 { x: -1, y: 0 },
//                                 { x: 0, y: 0 },
//                                 { x: 1, y: 0 },
//                                 { x: 1, y: 1 },
//                             ],
//                             256,
//                             256,
//                             hre.initializers.snarkConstants.DISABLE_ZK_CHECKS
//                         ))
//                     )
//                 ).to.be.true;
//             }
//         });
//         it("should go through the touch and perlin verifier", async function () {
//             this.timeout(0);
//             const perlin1: PerlinConfig = {
//                 floor: true,
//                 key: 10,
//                 mirrorX: false,
//                 mirrorY: false,
//                 scale: 64,
//             };
//             const perlin2: PerlinConfig = {
//                 floor: true,
//                 key: 42,
//                 mirrorX: false,
//                 mirrorY: false,
//                 scale: 64,
//             };
//             if (!hre.initializers.snarkConstants.DISABLE_ZK_CHECKS) {
//                 expect(
//                     await world.user1Verifier1.verifyTouchAndPerlinProof(
//                         //@ts-ignore
//                         ...(await makeTouchAndPerlinArgs(
//                             [
//                                 { x: -2, y: 0 },
//                                 { x: -1, y: 0 },
//                                 { x: 0, y: 0 },
//                                 { x: 1, y: 0 },
//                                 { x: 1, y: 1 },
//                             ],
//                             256,
//                             256,
//                             perlin1,
//                             perlin2,
//                             hre.initializers.snarkConstants.DISABLE_ZK_CHECKS
//                         ))
//                     )
//                 ).to.be.true;
//             }
//         });
//         it("should go through the path verifier", async function () {
//             this.timeout(0);
//             if (!hre.initializers.snarkConstants.DISABLE_ZK_CHECKS) {
//                 expect(
//                     await world.user1Verifier2.verifyPathProof(
//                         //@ts-ignore
//                         ...(await makePathArgs(
//                             [
//                                 { x: 0, y: 0 },
//                                 { x: 1, y: 0 },
//                                 { x: 1, y: 1 },
//                             ],
//                             256,
//                             256,
//                             hre.initializers.snarkConstants.DISABLE_ZK_CHECKS
//                         ))
//                     )
//                 ).to.be.true;
//             }
//         });
//     });
// });
