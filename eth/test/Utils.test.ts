import { expect } from "chai";
import { ethers } from "hardhat";
import { BigNumber, BigNumberish } from "ethers";
import { LibUtilsWrapper } from "../typechain";
import { cleanStructArray, cleanStruct } from "./utils/Structs";

type Coords = [
    { x: BigNumberish; y: BigNumberish },
    { x: BigNumberish; y: BigNumberish },
    { x: BigNumberish; y: BigNumberish },
    { x: BigNumberish; y: BigNumberish }
];

describe("Utils", function () {
    let utils: LibUtilsWrapper;

    before(async function () {
        this.timeout(0);
        const UtilsTestContract = await ethers.getContractFactory("LibUtilsWrapper");
        utils = (await UtilsTestContract.deploy()) as LibUtilsWrapper;
    });

    describe("unpackCoords", () => {
        it("should unpack a uint256 into 4 coord structs", async () => {
            const packed = BigNumber.from("0x0000000100000002000000030000000400000005000000060000000700000008");

            const coords = await utils.unpackCoords(packed);
            expect(coords.length).to.equal(4);
            expect(coords).to.deep.equal([
                [1, 2],
                [3, 4],
                [5, 6],
                [7, 8],
            ]);
        });

        it("should work with negative coords", async () => {
            const packed = BigNumber.from("0xfffffffffffffffefffffffdfffffffcfffffffbfffffffafffffff9fffffff8");

            const coords = await utils.unpackCoords(packed);
            expect(coords.length).to.equal(4);
            expect(coords).to.deep.equal([
                [-1, -2],
                [-3, -4],
                [-5, -6],
                [-7, -8],
            ]);
        });
    });

    describe("packCoords", () => {
        it("should pack four coord structs into one uint256", async () => {
            const coords: Coords = [
                { x: 1, y: 2 },
                { x: 3, y: 4 },
                { x: 5, y: 6 },
                { x: 7, y: 8 },
            ];

            const packed = await utils.packCoords(coords);
            expect(packed).to.equal(
                BigNumber.from("0x0000000100000002000000030000000400000005000000060000000700000008")
            );
        });

        it("should work with negative coordinates", async () => {
            const coords: Coords = [
                { x: -1, y: -2 },
                { x: -3, y: -4 },
                { x: -5, y: -6 },
                { x: -7, y: -8 },
            ];

            const packed = await utils.packCoords(coords);
            expect(packed).to.equal(
                BigNumber.from("0xfffffffffffffffefffffffdfffffffcfffffffbfffffffafffffff9fffffff8")
            );
        });
    });

    it("unpackCoords should be inverse of packCoords", async () => {
        const rounds: Coords[] = [
            [
                { x: 1, y: 2 },
                { x: 3, y: 4 },
                { x: 5, y: 6 },
                { x: 7, y: 8 },
            ],
            [
                { x: -1, y: -2 },
                { x: -3, y: -4 },
                { x: -5, y: -6 },
                { x: -7, y: -8 },
            ],
            [
                { x: 13245, y: 745676 },
                { x: 83838272, y: 848823737 },
                { x: -8472666, y: 99827772 },
                { x: 8277, y: -6699483 },
            ],
            [
                { x: 2 ** 31 - 1, y: 2 ** 31 - 1 },
                { x: 2 ** 31 - 1, y: -(2 ** 31) },
                { x: -(2 ** 31), y: 2 ** 31 - 1 },
                { x: -(2 ** 31), y: -(2 ** 31) },
            ],
        ];

        for (const coords of rounds) {
            const packed = await utils.packCoords(coords);
            console.log(packed);
            const unpacked = await utils.unpackCoords(packed);
            const cleaned = cleanStructArray<{ x: number; y: number }>(unpacked);
            expect(cleaned).to.deep.equal(coords);
        }
    });
    it("packCoords should be inverse of unpackCoords", async () => {
        const rounds: BigNumberish[] = [
            "0x0100000002000000030000000400000005000000060000000700000008",
            "0xfffffffffffffffefffffffdfffffffcfffffffbfffffffafffffff9fffffff8",
            "0x33bd000b60cc04ff4540329805b9ff7eb7a605f3403c00002055ff99c625",
            "0x7fffffff7fffffff7fffffff80000000800000007fffffff8000000080000000",
        ];

        for (const round of rounds) {
            const unpacked = await utils.unpackCoords(round);
            console.log(unpacked);
            const cleaned = cleanStructArray<{ x: number; y: number }>(unpacked);
            console.log(cleaned);
            const packed = await utils.packCoords(unpacked);
            console.log(packed);
            expect(packed).to.equal(round);
        }
    });

    describe("unpackCoordList", () => {
        it("should unpack a list of packed coords", async () => {
            const packedList = [
                "0x0100000002000000030000000400000005000000060000000700000008",
                "0xfffffffffffffffefffffffdfffffffcfffffffbfffffffafffffff9fffffff8",
                "0x33bd000b60cc04ff4540329805b9ff7eb7a605f3403c00002055ff99c625",
                "0x7ffffffe7ffffffe7ffffffe80000000800000007fffffff8000000080000000",
            ];

            const unpacked = await utils.unpackCoordList(packedList);
            const cleaned = cleanStructArray(unpacked);

            expect(cleaned).to.deep.equal([
                { x: 1, y: 2 },
                { x: 3, y: 4 },
                { x: 5, y: 6 },
                { x: 7, y: 8 },
                { x: -1, y: -2 },
                { x: -3, y: -4 },
                { x: -5, y: -6 },
                { x: -7, y: -8 },
                { x: 13245, y: 745676 },
                { x: 83838272, y: 848823737 },
                { x: -8472666, y: 99827772 },
                { x: 8277, y: -6699483 },
                { x: 2 ** 31 - 2, y: 2 ** 31 - 2 },
                { x: 2 ** 31 - 2, y: -(2 ** 31) },
                { x: -2147483648, y: 2147483647 },
                { x: -2147483648, y: -2147483648 },
            ]);
        });

        it("should infer the length of the original array", async () => {
            const packedList = [
                "0x0100000002000000030000000400000005000000060000000700000008",
                "0xfffffffffffffffefffffffdfffffffcfffffffbfffffffafffffff9fffffff8",
                "0x33bd000b60cc04ff4540329805b9ff7eb7a605f3403c00002055ff99c625",
                "0x7ffffffe7ffffffe7ffffffe800000007fffffff7fffffff7fffffff7fffffff",
            ];

            const unpacked = await utils.unpackCoordList(packedList);
            const cleaned = cleanStructArray(unpacked);

            expect(cleaned).to.deep.equal([
                { x: 1, y: 2 },
                { x: 3, y: 4 },
                { x: 5, y: 6 },
                { x: 7, y: 8 },
                { x: -1, y: -2 },
                { x: -3, y: -4 },
                { x: -5, y: -6 },
                { x: -7, y: -8 },
                { x: 13245, y: 745676 },
                { x: 83838272, y: 848823737 },
                { x: -8472666, y: 99827772 },
                { x: 8277, y: -6699483 },
                { x: 2 ** 31 - 2, y: 2 ** 31 - 2 },
                { x: 2 ** 31 - 2, y: -(2 ** 31) },
            ]);
        });
    });

    describe("coordToId", () => {
        it("should build a uint256 id from a given coord", async () => {
            const coord = { x: 1, y: 2 };
            const id = await utils.coordToId(coord);
            expect(id).to.equal("0x0000000000000000000000000000000100000000000000000000000000000002");
        });

        it("should build a uint256 id from a given negative coord", async () => {
            const coord = { x: -1, y: -2 };
            const id = await utils.coordToId(coord);
            expect(id).to.equal("0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe");
        });
    });

    describe("idToCoord", () => {
        it("should construct the coord from a given id", async () => {
            const id = "0x0000000000000000000000000000000100000000000000000000000000000002";
            const coord = await utils.idToCoord(id);
            const cleaned = cleanStruct(coord);
            expect(cleaned).to.deep.equal({ x: 1, y: 2 });
        });

        it("should construct the negative coord from a given id", async () => {
            const id = "0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe";
            const coord = await utils.idToCoord(id);
            const cleaned = cleanStruct(coord);
            expect(cleaned).to.deep.equal({ x: -1, y: -2 });
        });
    });

    it("idToCoord should be inverse to coordToId", async () => {
        const coords = [
            { x: 1, y: 2 },
            { x: 3, y: 4 },
            { x: 5, y: 6 },
            { x: 7, y: 8 },
            { x: -1, y: -2 },
            { x: -3, y: -4 },
            { x: -5, y: -6 },
            { x: -7, y: -8 },
            { x: 13245, y: 745676 },
            { x: 83838272, y: 848823737 },
            { x: -8472666, y: 99827772 },
            { x: 8277, y: -6699483 },
            { x: 2 ** 31 - 1, y: 2 ** 31 - 1 },
            { x: 2 ** 31 - 1, y: -(2 ** 31) },
            { x: -(2 ** 31), y: 2 ** 31 - 1 },
            { x: -(2 ** 31), y: -(2 ** 31) },
        ];

        for (const coord of coords) {
            const id = await utils.coordToId(coord);
            const reconstructedCoord = await utils.idToCoord(id);
            const cleaned = cleanStruct(reconstructedCoord);
            expect(cleaned).to.deep.equal(coord);
        }
    });

    it("coordToId should be inverse to idToCoord", async () => {
        const ids = [
            "0x0100000000000000000000000000000002",
            "0x0300000000000000000000000000000004",
            "0x0500000000000000000000000000000006",
            "0x0700000000000000000000000000000008",
            "0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe",
            "0xfffffffffffffffffffffffffffffffdfffffffffffffffffffffffffffffffc",
            "0xfffffffffffffffffffffffffffffffbfffffffffffffffffffffffffffffffa",
            "0xfffffffffffffffffffffffffffffff9fffffffffffffffffffffffffffffff8",
            "0x33bd000000000000000000000000000b60cc",
            "0x04ff4540000000000000000000000000329805b9",
            "0xffffffffffffffffffffffffff7eb7a600000000000000000000000005f3403c",
            "0x2055ffffffffffffffffffffffffff99c625",
            "0x7fffffff0000000000000000000000007fffffff",
            "0x7fffffffffffffffffffffffffffffff80000000",
            "0xffffffffffffffffffffffff800000000000000000000000000000007fffffff",
            "0xffffffffffffffffffffffff80000000ffffffffffffffffffffffff80000000",
        ];
        for (const id of ids) {
            const coord = await utils.idToCoord(id);
            const cleaned = cleanStruct<{ x: number; y: number }>(coord);
            const reconstructedId = await utils.coordToId(cleaned);
            expect(reconstructedId).to.equal(id);
        }
    });

    describe("toRegionCoord", () => {
        it("should map a tileCoord to its corresponding region coord", async () => {
            const tileCoords = [
                { x: 1, y: 2 },
                { x: -1, y: -1 },
                { x: 1, y: -1 },
                { x: -1, y: 1 },
                { x: -16, y: 16 },
            ];
            const expectedRegionCoords = [
                { x: 0, y: 0 },
                { x: -1, y: -1 },
                { x: 0, y: -1 },
                { x: -1, y: 0 },
                { x: -2, y: 2 },
            ];

            for (let i = 0; i < tileCoords.length; i++) {
                const tileCoord = tileCoords[i];
                const regionCoord = await utils.toRegionCoord(tileCoord, 8);
                const cleaned = cleanStruct(regionCoord);
                expect(cleaned).to.deep.equal(expectedRegionCoords[i]);
            }
        });
    });

    describe("toTopLeftTileCoord", () => {
        it("should map a region coord to its top left tile coord", async () => {
            const regionCoords = [
                { x: 0, y: 0 },
                { x: -1, y: -1 },
                { x: 0, y: -1 },
                { x: -1, y: 0 },
                { x: -2, y: 2 },
            ];

            const expectedTileCoords = [
                { x: 0, y: 0 },
                { x: -8, y: -8 },
                { x: 0, y: -8 },
                { x: -8, y: 0 },
                { x: -16, y: 16 },
            ];

            for (let i = 0; i < regionCoords.length; i++) {
                const regionCoord = regionCoords[i];
                const tileCoord = await utils.toTopLeftTileCoord(regionCoord, 8);
                const cleaned = cleanStruct(tileCoord);
                console.log(cleaned);
                expect(cleaned).to.deep.equal(expectedTileCoords[i]);
            }
        });
    });

    it("toRegionCoord should be inverse of toTopLeftTileCoord", async () => {
        const regionCoords = [
            { x: 0, y: 0 },
            { x: -1, y: -1 },
            { x: 0, y: -1 },
            { x: -1, y: 0 },
            { x: -2, y: 2 },
            { x: -(2 ** 28), y: -(2 ** 28) },
        ];

        for (const regionCoord of regionCoords) {
            const tileCoord = await utils.toTopLeftTileCoord(regionCoord, 8);
            const reconstructedRegionCoord = await utils.toRegionCoord(cleanStruct(tileCoord), 8);
            expect(cleanStruct(reconstructedRegionCoord)).to.deep.equal(regionCoord);
        }
    });
});
