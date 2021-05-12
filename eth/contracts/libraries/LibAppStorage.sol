pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;
import "./LibTypes.sol";
// SPDX-License-Identifier: GPL-3.0
struct AppStorage {
    // impersonation
    mapping(address => address) impersonators;
    bool isPaused;
    // universe
    int32 REGION_LENGTH;
    int32 MAX_X;
    int32 MAX_Y;
    // config
    LibTypes.GameConstants gameConstants;
    // game
    mapping(uint256 => LibTypes.Tile) tiles;
    mapping(uint256 => LibTypes.TileDelayedAction[]) tileToTileDelayedActions;
    mapping(uint256 => LibTypes.HarvestableGroundResources) tileHarvestableGroundResources;
    mapping(uint256 => LibTypes.Region) regions;
    mapping(uint256 => LibTypes.Settlement) settlements;
    mapping(address => uint256[]) playerToSettlements;
    mapping(address => LibTypes.Player) players;
    mapping(uint256 => LibTypes.Creature) creatures;
    mapping(address => mapping(LibTypes.CreatureSpecies => uint256)) playersToNumberOfCreaturesWithSpecies;
    mapping(uint256 => mapping(LibTypes.TileUpgrade => uint256)) settlementToNumberOfTileUpgrades;
    // creatures
    uint256 currentCreatureId;
    // influence
    mapping(address => mapping(uint256 => bool)) playerHasInfluenceInRegion;
    mapping(uint256 => LibTypes.InfluenceData) influenceDataInRegion;
    // loaders
    uint256[] tilesWithDelayedActions;
    uint256[] tilesWithHarvestableGroundResources;
    uint256[] tileIds;
    uint256[] regionIds;
    uint256[] settlementIds;
    address[] playerIds;
    // bank
    mapping(address => uint256) lastDrip;
    mapping(address => uint256) totalDrip;
}

library LibAppStorage {
    function diamondStorage() internal pure returns (AppStorage storage ds) {
        assembly {
            ds.slot := 0
        }
    }
}
