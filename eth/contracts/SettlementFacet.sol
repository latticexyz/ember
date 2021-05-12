// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import "./libraries/LibAppStorage.sol";
import "./libraries/LibTypes.sol";
import "./libraries/LibDungeon.sol";
import "./libraries/LibUpgrade.sol";
import "./libraries/LibChecks.sol";
import "./libraries/LibPerlin.sol";
import "./libraries/LibMana.sol";
import "./libraries/LibCreatures.sol";
import "hardhat/console.sol";

contract SettlementFacet {
    AppStorage internal s;

    event PlayerInitialized(address indexed player, LibTypes.Player data, uint256 region);
    event PlayerUpdated(address player, LibTypes.Player data);
    event TileMined(uint256 tile, bool touchable, address miner);
    event TileWalled(uint256 tile);
    event TileUnwalled(uint256 tile);
    event RegionMined(uint256 region, address miner);
    event RegionUpdated(uint256 region, LibTypes.Region data);
    event TileClaimed(uint256 tile, address player);
    event TileUpgraded(uint256 tile, LibTypes.TileUpgrade upgrade);
    event SettlementUpdated(uint256 region, LibTypes.Settlement data);
    event PlayerInfluenceInRegionUpdated(address player, uint256 region, uint256 amount);
    // harvesting
    event TileLastHarvestTimestampUpdated(uint256 tile, uint32 timestamp);
    event TileHarvestableGroundResourcesUpdated(uint256 tile, LibTypes.HarvestableGroundResources data);
    // delayed actions
    event TileDelayedActionInitiated(LibTypes.TileDelayedAction delayedAction);
    event TileDelayedActionCompleted(LibTypes.TileDelayedAction delayedAction);
    // others
    event DungeonHeartClaimed(uint256 region, address previousOwner, address newOwner);

    // DEBUGGING
    event Time(uint256 time);

    function __msgSender() internal view returns (address) {
        address impersonating = s.impersonators[msg.sender];
        if (impersonating != address(0)) {
            return impersonating;
        } else {
            return msg.sender;
        }
    }

    modifier onlyInitialized() {
        require(s.players[__msgSender()].isInitialized, "player is not initialized");
        _;
    }

    modifier notPaused() {
        require(!s.isPaused, "game is paused");
        emit Time(block.timestamp);
        _;
    }

    function _deleteSettlementFromPlayerToSettlements(address owner, uint256 id) internal {
        uint256[] storage array = s.playerToSettlements[owner];
        uint256 index = array.length;
        for (uint256 i = 0; i < array.length; i++) {
            if (array[i] == id) {
                index = i;
                break;
            }
        }
        require(index < array.length);
        for (uint256 i = index; i < array.length - 1; i++) {
            array[i] = array[i + 1];
        }
        array.pop();
    }

    function createSettlement(uint256 regionId) external onlyInitialized notPaused {
        address player = __msgSender();
        // Check that the player controls the fromRegion
        (address fromRegionController, bool fromRegionContested) = LibDungeon._getRegionController(regionId);
        require(fromRegionController == player && !fromRegionContested, "player does not control the region");
        // check if the four tiles in the center are mined and not upgraded nor walled
        LibTypes.Coord memory regionCoord = LibUtils.idToCoord(regionId);
        LibTypes.Coord memory topLeftTileCoord = LibUtils.toTopLeftTileCoord(regionCoord, s.REGION_LENGTH);
        uint256 tileId;
        for (int32 i = 0; i < int32(s.REGION_LENGTH); i++) {
            for (int32 j = 0; j < int32(s.REGION_LENGTH); j++) {
                tileId = LibUtils.coordToId(LibTypes.Coord(topLeftTileCoord.x + i, topLeftTileCoord.y + j));
                LibTypes.Tile storage tile = s.tiles[tileId];
                if (
                    (i == s.REGION_LENGTH / 2 || i == s.REGION_LENGTH / 2 - 1) &&
                    (j == s.REGION_LENGTH / 2 || j == s.REGION_LENGTH / 2 - 1)
                ) {
                    require(!tile.isWalled, "one of the tile is walled");
                    require(tile.isMined, "one of the tile is not mined");
                    require(tile.upgrade == LibTypes.TileUpgrade.NONE, "one of the tile is already upgraded");
                    LibDungeon._upgradeTile(tileId, player, LibTypes.TileUpgrade.DUNGEON_HEART, regionId);
                }
                if (tile.isMined) {
                    LibDungeon._claimTile(tileId, player);
                }
            }
        }
        LibTypes.Creature storage hero;
        // Check that the player's hero is present in the region
        bool found;
        for (uint256 i = 0; i < s.regions[regionId].creatures.length; i++) {
            if (s.creatures[s.regions[regionId].creatures[i]].species == LibTypes.CreatureSpecies.HERO) {
                found = true;
                hero = s.creatures[s.regions[regionId].creatures[i]];
            }
        }
        require(found, "no hero was found on the fromRegion");
        require(hero.owner == player, "hero is not the player's hero");
        // charge player
        LibDungeon._chargePlayerForSettlement(player, 0);
        // create settlement
        LibDungeon._createSettlement(regionId, player);
    }

    function destroySettlement(uint256 regionId) external onlyInitialized notPaused {
        address player = __msgSender();
        LibTypes.Settlement storage settlement = s.settlements[regionId];
        require(settlement.lastEnergyUpdateTimestamp != 0, "there is no settlement there");
        // Check that the player controls the fromRegion
        (address fromRegionController, bool fromRegionContested) = LibDungeon._getRegionController(regionId);
        require(fromRegionController == player && !fromRegionContested, "player does not control the region");
        LibTypes.Creature storage hero;
        // Check that the player's hero is present in the region
        bool found;
        for (uint256 i = 0; i < s.regions[regionId].creatures.length; i++) {
            if (s.creatures[s.regions[regionId].creatures[i]].species == LibTypes.CreatureSpecies.HERO) {
                found = true;
                hero = s.creatures[s.regions[regionId].creatures[i]];
            }
        }
        require(found, "no hero was found on the fromRegion");
        require(hero.owner == player, "hero is not the player's hero");
        // claim the tiles to address(0) are in the settlement radius
        LibTypes.Coord memory regionCoord = LibUtils.idToCoord(regionId);
        for (int32 i = -1; i <= 1; i++) {
            for (int32 j = -1; j <= 1; j++) {
                uint256 checkRegionId = LibUtils.coordToId(
                    LibTypes.Coord({x: regionCoord.x + i, y: regionCoord.y + j})
                );
                if (settlement.level == 1 && LibUtils.manhattan(LibUtils.idToCoord(checkRegionId), regionCoord) > 1) {
                    continue;
                }
                if (settlement.level == 0 && LibUtils.coordToId(regionCoord) != checkRegionId) {
                    continue;
                }
                LibTypes.Region storage region = s.regions[checkRegionId];
                for (uint256 tileIndex = 0; tileIndex < region.tiles.length; tileIndex++) {
                    uint256 tileId = region.tiles[tileIndex];
                    if (s.tiles[tileId].isMined) {
                        LibDungeon._claimTile(tileId, address(0));
                    }
                }
            }
        }
        emit DungeonHeartClaimed(regionId, settlement.owner, address(0));
        _deleteSettlementFromPlayerToSettlements(settlement.owner, regionId);
        settlement.owner = address(0);
        emit SettlementUpdated(regionId, settlement);
    }

    function upgradeSettlement(uint256 regionId) external onlyInitialized notPaused {
        LibDungeon._upgradeSettlement(regionId);
    }

    function claimSettlement(uint256 regionId) external onlyInitialized notPaused {
        address player = __msgSender();
        LibTypes.Settlement storage settlement = s.settlements[regionId];
        {
            require(settlement.lastEnergyUpdateTimestamp != 0, "there is no settlement there");

            bool found;
            LibTypes.Creature storage hero;
            for (uint256 i = 0; i < s.regions[regionId].creatures.length; i++) {
                if (s.creatures[s.regions[regionId].creatures[i]].species == LibTypes.CreatureSpecies.HERO) {
                    found = true;
                    hero = s.creatures[s.regions[regionId].creatures[i]];
                }
            }
            require(found, "no hero was found on the fromRegion");
            require(hero.owner == player, "hero is not the player's hero");
            // 2) Check that player doesn't already control the settlement
            require(settlement.owner != player, "you already control this settlement");
            // 3) Check that player controls the region
            (address regionController, bool regionContested) = LibDungeon._getRegionController(regionId);
            require(regionController == player && !regionContested, "player does not control the region");
            uint256 numberOfSettlementsOwnedByPlayer = s.playerToSettlements[player].length;
            require(
                numberOfSettlementsOwnedByPlayer < s.gameConstants.SETTLEMENT_PRICE_PERCENT_INCREASE_PER_UNIT.length,
                "you have too many settlements already"
            );
        }
        // claim the tiles that are in the settlement radius
        LibTypes.Coord memory regionCoord = LibUtils.idToCoord(regionId);
        for (int32 i = -1; i <= 1; i++) {
            for (int32 j = -1; j <= 1; j++) {
                uint256 checkRegionId = LibUtils.coordToId(
                    LibTypes.Coord({x: regionCoord.x + i, y: regionCoord.y + j})
                );
                if (settlement.level == 1 && LibUtils.manhattan(LibUtils.idToCoord(checkRegionId), regionCoord) > 1) {
                    continue;
                }
                if (settlement.level == 0 && LibUtils.coordToId(regionCoord) != checkRegionId) {
                    continue;
                }
                LibTypes.Region storage region = s.regions[checkRegionId];
                for (uint256 tileIndex = 0; tileIndex < region.tiles.length; tileIndex++) {
                    uint256 tileId = region.tiles[tileIndex];
                    if (s.tiles[tileId].isMined) {
                        LibDungeon._claimTile(tileId, player);
                    }
                }
            }
        }
        emit DungeonHeartClaimed(regionId, settlement.owner, player);
        if (settlement.owner != address(0)) {
            _deleteSettlementFromPlayerToSettlements(settlement.owner, regionId);
        }
        settlement.owner = player;
        s.playerToSettlements[player].push(regionId);
        emit SettlementUpdated(regionId, settlement);
    }
}
