// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import "../libraries/LibPerlin.sol";

contract LibPerlinWrapper {
    function computePerlin(
        int32 x,
        int32 y,
        uint32 key,
        uint32 scale
    ) public pure returns (uint256) {
        return LibPerlin.computePerlin(x, y, key, scale);
    }
}
