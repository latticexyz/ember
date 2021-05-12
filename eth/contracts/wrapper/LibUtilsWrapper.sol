// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import "../libraries/LibTypes.sol";
import "../libraries/LibUtils.sol";

contract LibUtilsWrapper {
    function unpackCoords(uint256 packed) public pure returns (LibTypes.Coord[4] memory coords) {
        return LibUtils.unpackCoords(packed);
    }

    function packCoords(LibTypes.Coord[4] memory coords) public pure returns (uint256 packed) {
        return LibUtils.packCoords(coords);
    }

    function unpackCoordList(uint256[] memory packed) public pure returns (LibTypes.Coord[] memory coords) {
        return LibUtils.unpackCoordList(packed);
    }

    function coordToId(LibTypes.Coord memory coord) public pure returns (uint256 id) {
        return LibUtils.coordToId(coord);
    }

    function idToCoord(uint256 id) public pure returns (LibTypes.Coord memory coord) {
        return LibUtils.idToCoord(id);
    }

    function toRegionCoord(LibTypes.Coord memory tileCoord, int32 regionLength)
        public
        pure
        returns (LibTypes.Coord memory regionCoord)
    {
        return LibUtils.toRegionCoord(tileCoord, regionLength);
    }

    function toTopLeftTileCoord(LibTypes.Coord memory regionCoord, int32 regionLength)
        public
        pure
        returns (LibTypes.Coord memory tileCoord)
    {
        return LibUtils.toTopLeftTileCoord(regionCoord, regionLength);
    }
}
