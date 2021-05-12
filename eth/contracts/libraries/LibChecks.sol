// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.7.6;

import "./LibTypes.sol";
import "./LibAppStorage.sol";

/// @title Ember Checks Library
/// @notice Contains functions for checking various state conditions for use in Facet contracts.
library LibChecks {

    /// @notice Returns the AppStorage object for use in the rest of the library.
    /// @return ret AppStorage object.
    function getAppStorage() internal pure returns (AppStorage storage ret) {
        ret = LibAppStorage.diamondStorage();
    }

    /// @notice Checks if a given LibTypes.Coord coordinate is within the 
    /// max x and y bounds of the game.
    /// @param coord The coordinate to check.
    function requireInBounds(LibTypes.Coord memory coord) internal view {
        AppStorage storage s = getAppStorage();
        require(
            coord.x < s.MAX_X && coord.x > -s.MAX_X && coord.y < s.MAX_Y && coord.y > -s.MAX_Y,
            "Coord is out of bounds."
        );
    }
}
