// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.7.6;

import "./LibTypes.sol";
import "./LibMath.sol";

library LibUtils {
    int32 constant PAD_VALUE = 2**31 - 1;
    uint256 constant PAD_VALUE_UINT256 = uint256(PAD_VALUE);
    uint256 constant PAD_ID = 0x007fffffff0000000000000000000000007fffffff;
    uint256 constant BN_128_PRIME = 21888242871839275222246405745257275088548364400416034343698204186575808495617;

    function addInt256(uint256 a, int256 b) internal pure returns (uint256 out) {
        if (b > 0) {
            out = a + uint256(b);
        } else {
            require(a >= uint256(-b), "underflow");
            out = a - uint256(-b);
        }
    }

    /**
     * packed uint256 contains 8 int32, corresponding to 4 coords
     * packed = x0 y0 x1 y1 x2 y2 x3 y3
     */
    function unpackCoords(uint256 packed) internal pure returns (LibTypes.Coord[4] memory coords) {
        uint256 temp = packed;
        uint256 mask = 0xFFFFFFFF;
        for (uint256 i = 0; i < 4; i++) {
            int32 y = int32(mask & temp);
            temp = temp >> 32;
            int32 x = int32(mask & temp);
            temp = temp >> 32;
            LibTypes.Coord memory coord = LibTypes.Coord(x, y);
            coords[3 - i] = coord;
        }
    }

    function packCoords(LibTypes.Coord[4] memory coords) internal pure returns (uint256 packed) {
        uint256 mask = 0xFFFFFFFF;
        for (uint256 i = 0; i < 4; i++) {
            packed = packed << 32;
            packed = packed | (mask & uint256(coords[i].x));
            packed = packed << 32;
            packed = packed | (mask & uint256(coords[i].y));
        }
    }

    function coordToId(LibTypes.Coord memory coord) internal pure returns (uint256 id) {
        uint256 mask = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF;
        id = mask & uint256(coord.x);
        id = id << 128;
        id = id | (mask & uint256(coord.y));
    }

    function idToCoord(uint256 id) internal pure returns (LibTypes.Coord memory coord) {
        uint256 temp = id;
        uint256 mask = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF;
        int32 y = int32(mask & temp);
        temp = temp >> 128;
        int32 x = int32(mask & temp);
        coord = LibTypes.Coord(x, y);
    }

    function packedToIds(uint256 packed) internal pure returns (uint256[4] memory ids) {
        LibTypes.Coord[4] memory coords = unpackCoords(packed);
        for (uint256 i = 0; i < 4; i++) {
            ids[i] = coordToId(coords[i]);
        }
    }

    function unpackCoordList(uint256[] memory packed) internal pure returns (LibTypes.Coord[] memory coords) {
        coords = new LibTypes.Coord[](packed.length * 4);
        for (uint256 i = 0; i < packed.length; i++) {
            LibTypes.Coord[4] memory unpacked = unpackCoords(packed[i]);
            for (uint256 j = 0; j < 4; j++) {
                if (unpacked[j].x == PAD_VALUE && unpacked[j].y == PAD_VALUE) {
                    // Resize coord array to remove padding and return it
                    LibTypes.Coord[] memory unpaddedCoords = new LibTypes.Coord[](i * 4 + j);
                    for (uint256 k = 0; k < i * 4 + j; k++) {
                        unpaddedCoords[k] = coords[k];
                    }
                    return unpaddedCoords;
                }
                coords[i * 4 + j] = unpacked[j];
            }
        }
    }

    function unpackCoordListToIds(uint256[] memory packed) internal pure returns (uint256[] memory ids) {
        ids = new uint256[](packed.length * 4);

        for (uint256 i = 0; i < packed.length; i++) {
            uint256[4] memory unpacked = packedToIds(packed[i]);
            for (uint256 j = 0; j < 4; j++) {
                if (unpacked[j] == PAD_ID) {
                    // Resize ids array to remove padding and return it
                    uint256[] memory unpaddedIds = new uint256[](i * 4 + j);
                    for (uint256 k = 0; k < i * 4 + j; k++) {
                        unpaddedIds[k] = ids[k];
                    }
                    return unpaddedIds;
                }
                ids[i * 4 + j] = unpacked[j];
            }
        }
    }

    function toRegionCoord(LibTypes.Coord memory tileCoord, int32 regionLength)
        internal
        pure
        returns (LibTypes.Coord memory regionCoord)
    {
        int32 x = int32(LibMath.toInt(LibMath.divi(int256(tileCoord.x), int256(regionLength))));
        int32 y = int32(LibMath.toInt(LibMath.divi(int256(tileCoord.y), int256(regionLength))));
        regionCoord = LibTypes.Coord(x, y);
    }

    function toTopLeftTileCoord(LibTypes.Coord memory regionCoord, int32 regionLength)
        internal
        pure
        returns (LibTypes.Coord memory tileCoord)
    {
        int32 x = regionCoord.x * int32(regionLength);
        int32 y = regionCoord.y * int32(regionLength);
        tileCoord = LibTypes.Coord(x, y);
    }

    function tileIdToRegionId(uint256 tileId, int32 regionLength) internal pure returns (uint256 regionId) {
        regionId = coordToId(toRegionCoord(idToCoord(tileId), regionLength));
    }

    function manhattan(LibTypes.Coord memory a, LibTypes.Coord memory b) internal pure returns (uint256 distance) {
        int32 d1 = a.x - b.x;
        int32 d2 = a.y - b.y;
        if (d1 < 0) d1 = -d1;
        if (d2 < 0) d2 = -d2;
        distance = uint256(d1 + d2);
    }

    function chebyshev(LibTypes.Coord memory a, LibTypes.Coord memory b) internal pure returns (uint256 distance) {
        int32 d1 = a.x - b.x;
        int32 d2 = a.y - b.y;
        if (d1 < 0) d1 = -d1;
        if (d2 < 0) d2 = -d2;
        if (d1 < d2) {
            distance = uint256(d2);
        } else {
            distance = uint256(d1);
        }
    }

    function getUniqueEntries(uint256[] memory _array) internal pure returns (uint256[] memory uniqueEntries) {
        uint256 numUniqueEntries = 0;
        uint256[] memory filteredArray = new uint256[](_array.length);

        for (uint256 i = 0; i < _array.length; i++) {
            bool unique = true;
            for (uint256 j = 0; j < i; j++) {
                if (_array[j] == _array[i]) {
                    unique = false;
                    break;
                }
            }
            if (unique) {
                filteredArray[numUniqueEntries] = _array[i];
                numUniqueEntries++;
            }
        }

        uniqueEntries = new uint256[](numUniqueEntries);
        for (uint256 i = 0; i < numUniqueEntries; i++) {
            uniqueEntries[i] = filteredArray[i];
        }
    }

    function recoverCoordinateFromBN128Point(uint256 point) internal pure returns (int32 n) {
        if (point > PAD_VALUE_UINT256) {
            int256 signedPoint = int256(point) - int256(BN_128_PRIME);
            require(signedPoint < int256(PAD_VALUE));
            return int32(signedPoint);
        } else {
            require(point < PAD_VALUE_UINT256);
            return int32(point);
        }
    }
}
