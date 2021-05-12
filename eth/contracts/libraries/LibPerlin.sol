// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import "hardhat/console.sol";
import "./LibMath.sol";

library LibPerlin {
    uint32 constant LARGE_NUMBER = 2**20 - 1;

    // interpolation function [0,1] -> [0,1]
    function smoothStep(int128 x) public pure returns (int128) {
        return x;
    }

    // returns a random unit vector
    // implicit denominator of vecsDenom
    function getGradientAt(
        uint32 x,
        uint32 y,
        uint32 key
    ) public pure returns (int16[2] memory) {
        int16[2][16] memory vecs = [
            [int16(1024), int16(0)],
            [int16(946), int16(391)],
            [int16(724), int16(724)],
            [int16(391), int16(946)],
            [int16(0), int16(1024)],
            [int16(-392), int16(946)],
            [int16(-725), int16(724)],
            [int16(-947), int16(391)],
            [int16(-1024), int16(0)],
            [int16(-947), int16(-392)],
            [int16(-725), int16(-725)],
            [int16(-392), int16(-947)],
            [int16(0), int16(-1024)],
            [int16(391), int16(-947)],
            [int16(724), int16(-725)],
            [int16(946), int16(-392)]
        ];

        uint256 idx = uint256(keccak256(abi.encodePacked(x, y, key))) % 16;
        return vecs[idx];
    }

    // the computed perlin value at a point is a weighted average of dot products with
    // gradient vectors at the four corners of a grid square.
    // this isn't scaled; there's an implicit denominator of scale ** 2
    function getWeight(
        uint32 cornerX,
        uint32 cornerY,
        uint32 x,
        uint32 y,
        uint32 scale
    ) public pure returns (uint64) {
        uint64 res = 1;

        if (cornerX > x) res *= (scale - (cornerX - x));
        else res *= (scale - (x - cornerX));

        if (cornerY > y) res *= (scale - (cornerY - y));
        else res *= (scale - (y - cornerY));

        return res;
    }

    function getCorners(
        uint32 x,
        uint32 y,
        uint32 scale
    ) public pure returns (uint32[2][4] memory) {
        uint32 lowerX = (x / scale) * scale;
        uint32 lowerY = (y / scale) * scale;

        return [[lowerX, lowerY], [lowerX + scale, lowerY], [lowerX + scale, lowerY + scale], [lowerX, lowerY + scale]];
    }

    function getSingleScalePerlin(
        uint32 x,
        uint32 y,
        uint32 key,
        uint32 scale
    ) public pure returns (int128) {
        uint32[2][4] memory corners = getCorners(x, y, scale);

        int128 resNumerator = 0;

        for (uint8 i = 0; i < 4; i++) {
            uint32[2] memory corner = corners[i];

            // this has an implicit denominator of scale
            int32[2] memory offset = [int32(corner[0]) - int32(x), int32(corner[1]) - int32(y)];

            // this has an implicit denominator of vecsDenom
            int16[2] memory gradient = getGradientAt(corner[0], corner[1], key);

            // this has an implicit denominator of vecsDenom * scale
            int64 dot = offset[0] * int64(gradient[0]) + offset[1] * int64(gradient[1]);

            // this has an implicit denominator of scale ** 2
            uint64 weight = getWeight(corner[0], corner[1], x, y, scale);

            // this has an implicit denominator of vecsDenom * scale ** 3
            resNumerator += int128(int64(weight)) * int128(dot);
        }

        // vecsDenum = 1024
        return LibMath.divi(int256(resNumerator), int256(1024) * int256(int32(scale))**3);
    }

    function computePerlin(
        int32 _x,
        int32 _y,
        uint32 key,
        uint32 scale
    ) public pure returns (uint256) {
        uint256 perlinMax = 64;
        int128 perlin = LibMath.fromUInt(0);
        uint8 denom = 0;

        // handle negative coordinates by shifting
        uint32 x = _x < 0 ? LARGE_NUMBER - uint32(-_x) : uint32(_x);
        uint32 y = _y < 0 ? LARGE_NUMBER - uint32(-_y) : uint32(_y);

        for (uint8 i = 0; i < 3; i++) {
            perlin = LibMath.add(
                perlin,
                LibMath.mul(getSingleScalePerlin(x, y, key, scale * uint32(2**i)), LibMath.fromUInt(2**i))
            );
            denom += uint8(2**i);
        }
        perlin = LibMath.div(perlin, LibMath.fromUInt(denom)); // this is in [-sqrt(2)/2, +sqrt(2)/2]

        int128 perlinScaledShifted = LibMath.add(
            LibMath.mul(perlin, LibMath.fromUInt(perlinMax / 2)),
            LibMath.fromUInt((perlinMax / 2))
        );

        return LibMath.toUInt(perlinScaledShifted);
    }
}
