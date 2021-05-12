// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;
import "./libraries/LibAppStorage.sol";
import "./libraries/LibDiamond.sol";

contract ConfigFacet {
    AppStorage internal s;

    function initialize(LibTypes.InitArgs calldata initArgs) external {
        LibDiamond.enforceIsContractOwner();
        s.gameConstants = initArgs.gameConstants;
        s.REGION_LENGTH = 8;
        s.MAX_X = s.REGION_LENGTH * int32(initArgs.numberOfRegionsPerSide) - 1;
        s.MAX_Y = s.REGION_LENGTH * int32(initArgs.numberOfRegionsPerSide) - 1;
        s.isPaused = false;
    }

    function setPaused(bool paused) external {
        LibDiamond.enforceIsContractOwner();
        s.isPaused = paused;
    }

    function setTrustedForwarder(address forwarder) external {
        LibDiamond.enforceIsContractOwner();
        LibDiamond.setTrustedForwarder(forwarder);
    }
}
