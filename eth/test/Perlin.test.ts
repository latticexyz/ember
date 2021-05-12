import { expect } from "chai";
import { ethers } from "hardhat";
import { LibPerlinWrapper } from "../typechain";
import { perlin } from "@latticexyz/ember-hashing";

describe("Perlin", function () {
    let libPerlin: LibPerlinWrapper;

    before(async function () {
        this.timeout(0);

        const LibPerlin = await ethers.getContractFactory("LibPerlin");
        const lib = await LibPerlin.deploy();
        await lib.deployed();

        const PerlinTestContract = await ethers.getContractFactory("LibPerlinWrapper", {
            libraries: {
                LibPerlin: lib.address,
            },
        });

        libPerlin = (await PerlinTestContract.deploy()) as LibPerlinWrapper;
    });

    describe("computePerlin", () => {
        it("should compute the same value as the client package", async () => {
            const coords = [
                {
                    x: -4,
                    y: -9,
                },
                {
                    x: 1,
                    y: 1,
                },
                {
                    x: -10,
                    y: 8,
                },
                {
                    x: 5,
                    y: -91,
                },
                {
                    x: -11,
                    y: -42,
                },
                {
                    x: 23499,
                    y: 29498,
                },
                {
                    x: 0,
                    y: 0,
                },
            ];

            const keys = [42, 43];

            for (const key of keys) {
                for (const { x, y } of coords) {
                    const scale = 4;

                    const libPerlinValue = await libPerlin.computePerlin(x, y, key, scale);
                    const clientValue = perlin({ x, y }, { scale, key });

                    console.log("Perlin", x, y, scale, key, libPerlinValue.toNumber(), clientValue);

                    expect(libPerlinValue.toNumber()).to.equal(clientValue);
                }
            }
        });
    });
});
