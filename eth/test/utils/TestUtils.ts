import { BigNumberish, BigNumber, constants, providers } from "ethers";
const snarkjs = require("snarkjs");
import fs from "fs";
import { perlin, PerlinConfig } from "@latticexyz/ember-hashing";

export const ZERO_ADDRESS = constants.AddressZero;
export const BN_ZERO = constants.Zero;

export function hexToBigNumber(hex: string): BigNumber {
    return BigNumber.from(`0x${hex}`);
}

// export function hashCoordinate(x: number, y: number): BigNumber {
//     const hash = mimcHash(0);
//     return BigNumber.from(hash(x, y).toString());
// }

// async function snarkJsProof(
//     circuitPath: string,
//     zkeyPath: string,
//     input: any
// ): Promise<
//     [
//         [BigNumberish, BigNumberish],
//         [[BigNumberish, BigNumberish], [BigNumberish, BigNumberish]],
//         [BigNumberish, BigNumberish]
//     ]
// > {
//     const wasm = fs.readFileSync(circuitPath);
//     const zkey = fs.readFileSync(zkeyPath);
//     try {
//         const { proof } = await snarkjs.groth16.fullProve(input, wasm, zkey);

//         return [
//             proof.pi_a.slice(0, 2), // pi_a
//             // genZKSnarkProof reverses values in the inner arrays of pi_b
//             [proof.pi_b[0].slice(0).reverse(), proof.pi_b[1].slice(0).reverse()], // pi_b
//             proof.pi_c.slice(0, 2), // pi_c
//         ];
//     } catch (e) {
//         console.error(e);
//         throw e;
//     }
// }

// export async function makeSpecialRegionArgs(
//     regionX: number,
//     regionY: number,
//     maxX: number,
//     maxY: number,
//     skipProof: boolean = false
// ): Promise<
//     [
//         [BigNumberish, BigNumberish],
//         [[BigNumberish, BigNumberish], [BigNumberish, BigNumberish]],
//         [BigNumberish, BigNumberish],
//         BigNumberish[]
//     ]
// > {
//     const { hashes, xs, ys, regionHash } = generateSpecialRegionInput(regionX, regionY);
//     if (skipProof) {
//         return [
//             [BN_ZERO, BN_ZERO],
//             [
//                 [BN_ZERO, BN_ZERO],
//                 [BN_ZERO, BN_ZERO],
//             ],
//             [BN_ZERO, BN_ZERO],
//             [...hashes, regionHash, maxX, maxY],
//         ];
//     } else {
//         const circuitPath = "../circuits/artifacts/specialRegion.wasm";
//         const zkeyPath = "../circuits/artifacts/specialRegion.zkey";
//         const snarkJsInput = {
//             xs: xs,
//             ys: ys,
//             hashes: hashes,
//             maxX,
//             maxY,
//             regionHash: regionHash,
//         };
//         const proof = await snarkJsProof(circuitPath, zkeyPath, snarkJsInput);
//         return [...proof, [...hashes, regionHash, maxX, maxY]];
//     }
// }

// export async function makeTouchArgs(
//     path: Coordinate[],
//     maxX: number,
//     maxY: number,
//     skipProof: boolean = false
// ): Promise<
//     [
//         [BigNumberish, BigNumberish],
//         [[BigNumberish, BigNumberish], [BigNumberish, BigNumberish]],
//         [BigNumberish, BigNumberish],
//         BigNumberish[]
//     ]
// > {
//     while (path.length < 20) {
//         // Add the former to last one before the last one (to extend the path, but keeping the unmined tile as the latest in the path)
//         path.splice(path.length - 2, 0, path[path.length - 2]);
//     }
//     const { hashes, xs, ys, fromRegionHash, toRegionHash } = generateTouchInput(path);
//     if (skipProof) {
//         return [
//             [BN_ZERO, BN_ZERO],
//             [
//                 [BN_ZERO, BN_ZERO],
//                 [BN_ZERO, BN_ZERO],
//             ],
//             [BN_ZERO, BN_ZERO],
//             [...hashes, fromRegionHash, toRegionHash, maxX, maxY],
//         ];
//     } else {
//         const circuitPath = "../circuits/artifacts/touch.wasm";
//         const zkeyPath = "../circuits/artifacts/touch.zkey";

//         const snarkJsInput = {
//             xs: xs,
//             ys: ys,
//             hashes: hashes,
//             maxX,
//             maxY,
//             fromRegionHash,
//             toRegionHash,
//         };
//         const proof = await snarkJsProof(circuitPath, zkeyPath, snarkJsInput);
//         return [...proof, [...hashes, fromRegionHash, toRegionHash, maxX, maxY]];
//     }
// }

// export async function makeTouchAndPerlinArgs(
//     path: Coordinate[],
//     maxX: number,
//     maxY: number,
//     perlin1: PerlinConfig,
//     perlin2: PerlinConfig,
//     skipProof: boolean = false
// ): Promise<
//     [
//         [BigNumberish, BigNumberish],
//         [[BigNumberish, BigNumberish], [BigNumberish, BigNumberish]],
//         [BigNumberish, BigNumberish],
//         BigNumberish[]
//     ]
// > {
//     while (path.length < 20) {
//         // Add the former to last one before the last one (to extend the path, but keeping the unmined tile as the latest in the path)
//         path.splice(path.length - 2, 0, path[path.length - 2]);
//     }
//     const { hashes, xs, ys, fromRegionHash, toRegionHash, perlinValue1, perlinValue2 } = generateTouchAndPerlinInput(
//         path,
//         perlin1,
//         perlin2
//     );
//     const scale1 = perlin1.scale;
//     const scale2 = perlin2.scale;
//     const key1 = perlin1.key;
//     const key2 = perlin2.key;
//     if (skipProof) {
//         return [
//             [BN_ZERO, BN_ZERO],
//             [
//                 [BN_ZERO, BN_ZERO],
//                 [BN_ZERO, BN_ZERO],
//             ],
//             [BN_ZERO, BN_ZERO],
//             [
//                 ...hashes,
//                 fromRegionHash,
//                 toRegionHash,
//                 perlinValue1,
//                 perlinValue2,
//                 scale1,
//                 scale2,
//                 key1,
//                 key2,
//                 maxX,
//                 maxY,
//             ],
//         ];
//     } else {
//         const circuitPath = "../circuits/artifacts/touchAndPerlin.wasm";
//         const zkeyPath = "../circuits/artifacts/touchAndPerlin.zkey";
//         const snarkJsInput = {
//             xs: xs,
//             ys: ys,
//             hashes: hashes,
//             fromRegionHash,
//             toRegionHash,
//             perlinValue1,
//             perlinValue2,
//             scale1,
//             scale2,
//             key1,
//             key2,
//             maxX,
//             maxY,
//         };
//         const proof = await snarkJsProof(circuitPath, zkeyPath, snarkJsInput);
//         return [
//             ...proof,
//             [
//                 ...hashes,
//                 fromRegionHash,
//                 toRegionHash,
//                 perlinValue1,
//                 perlinValue2,
//                 scale1,
//                 scale2,
//                 key1,
//                 key2,
//                 maxX,
//                 maxY,
//             ],
//         ];
//     }
// }

// export async function makePathArgs(
//     path: Coordinate[],
//     maxX: number,
//     maxY: number,
//     skipProof: boolean = false
// ): Promise<
//     [
//         [BigNumberish, BigNumberish],
//         [[BigNumberish, BigNumberish], [BigNumberish, BigNumberish]],
//         [BigNumberish, BigNumberish],
//         BigNumberish[]
//     ]
// > {
//     while (path.length < 64) {
//         path.splice(path.length - 1, 0, path[path.length - 1]);
//     }
//     const { hashes, xs, ys } = generateTouchInput(path);
//     if (skipProof) {
//         return [
//             [BN_ZERO, BN_ZERO],
//             [
//                 [BN_ZERO, BN_ZERO],
//                 [BN_ZERO, BN_ZERO],
//             ],
//             [BN_ZERO, BN_ZERO],
//             [...hashes, maxX, maxY],
//         ];
//     } else {
//         const circuitPath = "../circuits/artifacts/path.wasm";
//         const zkeyPath = "../circuits/artifacts/path.zkey";

//         const snarkJsInput = {
//             xs: xs,
//             ys: ys,
//             hashes: hashes,
//             maxX,
//             maxY,
//         };
//         const proof = await snarkJsProof(circuitPath, zkeyPath, snarkJsInput);
//         return [...proof, [...hashes, maxX, maxY]];
//     }
// }

// export async function makeDfsArgs(
//     path: Coordinate[],
//     maxX: number,
//     maxY: number,
//     skipProof: boolean = false
// ): Promise<
//     [
//         [BigNumberish, BigNumberish],
//         [[BigNumberish, BigNumberish], [BigNumberish, BigNumberish]],
//         [BigNumberish, BigNumberish],
//         BigNumberish[]
//     ]
// > {
//     while (path.length < 75) {
//         path.splice(path.length - 1, 0, path[path.length - 1]);
//     }
//     const { hashes, fromIndices, xs, ys } = generateDfsInput(path);
//     if (skipProof) {
//         return [
//             [BN_ZERO, BN_ZERO],
//             [
//                 [BN_ZERO, BN_ZERO],
//                 [BN_ZERO, BN_ZERO],
//             ],
//             [BN_ZERO, BN_ZERO],
//             [...hashes, ...fromIndices, maxX, maxY],
//         ];
//     } else {
//         const circuitPath = "../circuits/artifacts/dfs.wasm";
//         const zkeyPath = "../circuits/artifacts/dfs.zkey";

//         const snarkJsInput = {
//             xs,
//             ys,
//             hashes,
//             fromIndices,
//             maxX,
//             maxY,
//         };
//         const proof = await snarkJsProof(circuitPath, zkeyPath, snarkJsInput);
//         return [...proof, [...hashes, ...fromIndices, maxX, maxY]];
//     }
// }
