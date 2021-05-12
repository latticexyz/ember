// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import "./libraries/LibAppStorage.sol";
import "./libraries/LibDiamond.sol";

/// @title Config Facet
/// @notice EIP-2535 Facet for Configuration of various settings.
contract ConfigFacet {
    AppStorage internal s;

    /// @notice Initializes the game by setting the values for various settings.
    /// @param initArgs Initialization arguments in the form of LibTypes.InitArgs.
    function initialize(LibTypes.InitArgs calldata initArgs) external {
        LibDiamond.enforceIsContractOwner();
        s.gameConstants = initArgs.gameConstants;
        s.REGION_LENGTH = 8;
        s.MAX_X = s.REGION_LENGTH * int32(initArgs.numberOfRegionsPerSide) - 1;
        s.MAX_Y = s.REGION_LENGTH * int32(initArgs.numberOfRegionsPerSide) - 1;
        s.isPaused = false;
    }

    /// @param paused Whether the game should be paused.
    function setPaused(bool paused) external {
        LibDiamond.enforceIsContractOwner();
        s.isPaused = paused;
    }

    /// @notice This sets the trusted forwarder when using the Gas Station Network
    /// @param forwarder the address of the trusted forwarder on the network where Ember has been deployed.
    function setTrustedForwarder(address forwarder) external {
        // TODO: use block.chainid to select this automatically
        LibDiamond.enforceIsContractOwner();
        LibDiamond.setTrustedForwarder(forwarder);
    }
}
