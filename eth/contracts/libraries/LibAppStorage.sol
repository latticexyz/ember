// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import "./LibTypes.sol";

/// @notice Struct representing the AppStorage object Ember uses for data storage.
struct AppStorage {
    /*///////////////////////////////////////////////////////////////
                            IMPERSONATION
    //////////////////////////////////////////////////////////////*/

    // Maps Impersonators to an Impersonated address.
    mapping(address => address) impersonators;
    // Whether the game is paused or not
    bool isPaused;
    /*///////////////////////////////////////////////////////////////
                                UNIVERSE
    //////////////////////////////////////////////////////////////*/

    // Used to store the current length of the universe TODO: what does this mean?
    int32 REGION_LENGTH;
    // Stores the maximum x coordinate of the universe.
    int32 MAX_X;
    // Stores the maximum y coordinate of the universe.
    int32 MAX_Y;
    /*///////////////////////////////////////////////////////////////
                            CONFIGURATION
    //////////////////////////////////////////////////////////////*/

    // Stores various gmae rule configuration constants.
    LibTypes.GameConstants gameConstants;
    /*///////////////////////////////////////////////////////////////
                                GAME
    //////////////////////////////////////////////////////////////*/

    // Maps Tile Ids to their respective LibTypes.Tile tiles.
    mapping(uint256 => LibTypes.Tile) tiles;
    // Maps Tile Ids to their respective tile delayed actions
    mapping(uint256 => LibTypes.TileDelayedAction[]) tileToTileDelayedActions;
    // Maps Tile Ids to their respective LibTypes.HarvestableGroundResources type tiles.
    mapping(uint256 => LibTypes.HarvestableGroundResources) tileHarvestableGroundResources;
    // Maps Region Ids to their respective LibTypes.Region regions.
    mapping(uint256 => LibTypes.Region) regions;
    // Maps addresses of players in the game to their respective LibTypes.Player player data.
    mapping(address => LibTypes.Player) players;
    // Maps Creature Ids to their respective LibTypes.Creature creature data
    mapping(uint256 => LibTypes.Creature) creatures;
    /*///////////////////////////////////////////////////////////////
                                CREATURES
    //////////////////////////////////////////////////////////////*/

    // Creature ID increments monotonically
    uint256 currentCreatureId;
    /*///////////////////////////////////////////////////////////////
                                INFLUENCE
    //////////////////////////////////////////////////////////////*/

    // Maps Player Addresses to a mapping of Region Ids to a bool representing
    // whether or not the player has influence in the region.
    mapping(address => mapping(uint256 => bool)) playerHasInfluenceInRegion;
    // Maps regions ID to their influence data
    mapping(uint256 => LibTypes.InfluenceData) influenceDataInRegion;
    /*///////////////////////////////////////////////////////////////
                                LOADERS
    //////////////////////////////////////////////////////////////*/

    // Stores tile ids of tiles with delayed actions.
    uint256[] tilesWithDelayedActions;
    // Stores tile ids of tiles with harvestable ground resources.
    uint256[] tilesWithHarvestableGroundResources;
    // Stores all existing tile ids. TODO: does this deserve some explanation on what tile ids exist and which don't?
    uint256[] tileIds;
    // Stores all existing region ids. TODO: does this deserve some explanation on what region ids exist and which don't?
    uint256[] regionIds;
    // Stores all existing player addresses.
    address[] playerIds;
    /*///////////////////////////////////////////////////////////////
                                BANK
    //////////////////////////////////////////////////////////////*/

    // Maps address to the timestamp of the last drip
    mapping(address => uint256) lastDrip;
    // Maps address to the total drip (in wei)
    mapping(address => uint256) totalDrip;
}

/// @title Ember AppStorage
/// @notice AppStorage pattern implementation of storage for the game.
library LibAppStorage {
    /// @notice TODO
    /// @return ds The AppStorage object.
    function diamondStorage() internal pure returns (AppStorage storage ds) {
        assembly {
            ds.slot := 0
        }
    }
}
