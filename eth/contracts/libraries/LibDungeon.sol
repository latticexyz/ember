// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import "./LibTypes.sol";
import "./LibAppStorage.sol";
import "./LibUpgrade.sol";

/// @title Ember Dungeon Library
/// @notice Contains helper functions for DungeonFacet.sol.
library LibDungeon {
    /// @notice Returns the AppStorage object for read and
    /// write usage in the rest of the library.
    /// @return ret The AppStorage object.
    function getAppStorage() internal pure returns (AppStorage storage ret) {
        ret = LibAppStorage.diamondStorage();
    }

    /*///////////////////////////////////////////////////////////////
                                EVENTS
    //////////////////////////////////////////////////////////////*/

    // IMPORTANT: These need the same name/signatures as the events in DungeonFacet

    /// @notice Emitted when a tile is mined.
    /// @param tile Id of the tile that is mined.
    /// @param touchable Whether the tile can be interacted with
    /// @param miner Address of the player that mined the tile.
    event TileMined(uint256 tile, bool touchable, address miner);

    /// @notice Emitted when a region is mined, a region being a REGION_LENGTH x REGION_LENGTH square group of tiles.
    /// @param region Region id that is mined.
    /// @param miner Address of the player that mined the region.
    event RegionMined(uint256 region, address miner);

    /// @notice Emitted when a regions's LibTypes.Region data is updated.
    /// @param region Region id that is updated.
    /// @param data The new LibTypes.Region data of the region that is updated.
    event RegionUpdated(uint256 region, LibTypes.Region data);

    /// @notice Emitted when  tile is claimed.
    /// @param tile Tile id that is claimed.
    /// @param player Address of the player that claimed the tile.
    event TileClaimed(uint256 tile, address player);

    /// @notice Emitted when a tile is upgraded.
    /// @param tile Tile id that is upgraded.
    /// @param upgrade The type of upgrade that was applied to the tile.
    event TileUpgraded(uint256 tile, LibTypes.TileUpgrade upgrade);

    /// @notice Emitted when a player's influence in a region is updated.
    /// @param player Address of the player whose influence in a region is updated.
    /// @param region Region id where the influence was updated
    /// @param amount The new influence amount for that player in that region
    event PlayerInfluenceInRegionUpdated(address player, uint256 region, uint256 amount);

    /// @notice Emitted when a tile's harvestable ground resource is updated.
    /// @param tile Tile id of the tile whose harvestable ground resource is updated.
    /// @param data The updated harvestable ground resource of the tile.
    event TileHarvestableGroundResourcesUpdated(uint256 tile, LibTypes.HarvestableGroundResources data);

    /// @notice Emitted when a tile's delayed action is initiated.
    /// @param delayedAction The type of delayed action that is initiated.
    event TileDelayedActionInitiated(LibTypes.TileDelayedAction delayedAction);

    /// @notice Emitted when a tile's delayed action is completed.
    /// @param delayedAction The type of delayed action that is completed.
    event TileDelayedActionCompleted(LibTypes.TileDelayedAction delayedAction);

    /// @notice Emitted when a tile is walled.
    /// @param tile Tile id of the tile that is walled.
    event TileWalled(uint256 tile);

    /// @notice Emitted when a tile is un-walled.
    /// @param tile Tile id of the tile that is un-walled.
    event TileUnwalled(uint256 tile);

    /// @notice Emirred when a player's LibTypes.Player data is updated.
    /// @param player Address of the player whose LibTypes.Player data is updated.
    /// @param data LibTypes.Player data of the player whose data is updated.
    event PlayerUpdated(address player, LibTypes.Player data);

    /*///////////////////////////////////////////////////////////////
                            UTILS FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Get the address of the function caller by unwrapping the impersonator.
    /// @dev See ImpersonationFacet.sol for more information
    /// about how Impersonation works in Ember.
    function __msgSender() internal view returns (address) {
        AppStorage storage s = getAppStorage();
        address impersonating = s.impersonators[msg.sender];
        if (impersonating != address(0)) {
            return impersonating;
        } else {
            return msg.sender;
        }
    }

    /// @notice Helper function that returns the address of the controller of a given region
    /// and a bool representing whether or not that region is disputed.
    /// @param regionId Region id of the region to check for.
    /// @return controller Address of the controller of the regionId, disputed A bool representing
    /// whether or not the region represented by regionId is disputed.
    /// @dev Returns address(0) and false if no one has enough influence in the region for control.
    function _getRegionController(uint256 regionId) public view returns (address controller, bool disputed) {
        AppStorage storage s = getAppStorage();
        uint256 maxInfluence = 0;
        uint256 totalInfluence = 0;
        address playerWithMaxInfluence = address(0);
        LibTypes.InfluenceData storage influenceData = s.influenceDataInRegion[regionId];
        // Loop through influenceData for the given regionId and determine maxInfluence,
        // playerWithMaxInfluence, and totalInfluence.
        for (uint256 i = 0; i < influenceData.players.length; i++) {
            if (influenceData.influences[i] > maxInfluence) {
                maxInfluence = influenceData.influences[i];
                playerWithMaxInfluence = influenceData.players[i];
            }
            totalInfluence += influenceData.influences[i];
        }
        // Determine the controller of the region and whether or not it is disputed.
        if (maxInfluence < s.gameConstants.MIN_INFLUENCE_FOR_CONTROL) {
            controller = address(0);
            disputed = false;
            // IMPORTANT: smaller or eq because we don't want ties.
            // If two players have 50% of the influence each they need to bring more troops
            // The region will be disputed
        } else if (maxInfluence * 2 <= totalInfluence) {
            controller = playerWithMaxInfluence;
            disputed = true;
        } else {
            controller = playerWithMaxInfluence;
            disputed = false;
        }
    }

    /*///////////////////////////////////////////////////////////////
                                INFLUENCE
    //////////////////////////////////////////////////////////////*/

    /// @notice Helper function that modifies the influence of a player in a specific region.
    /// @param regionId Region id of the region to modify influence in.
    /// @param player Address of the player for whom to modify influence.
    /// @param amount Amount of change to influence.
    function _modifyInfluenceOfPlayerInRegion(
        uint256 regionId,
        address player,
        int256 amount
    ) internal {
        AppStorage storage s = getAppStorage();
        LibTypes.InfluenceData storage influenceData = s.influenceDataInRegion[regionId];

        // If the player already has influence in the region, modify it, else create a new tuple
        // representing the amount as player's influence in regionId.
        if (s.playerHasInfluenceInRegion[player][regionId]) {
            // We find the corresponding value and modify it
            for (uint256 i = 0; i < influenceData.players.length; i++) {
                if (influenceData.players[i] == player) {
                    if (amount < 0) {
                        require(influenceData.influences[i] >= uint256(-amount), "Influence underflows.");
                        influenceData.influences[i] -= uint256(-amount);
                    } else {
                        influenceData.influences[i] += uint256(amount);
                    }
                    emit PlayerInfluenceInRegionUpdated(player, regionId, influenceData.influences[i]);
                    break;
                }
            }
        } else {
            // We init a new tuple for this player
            require(amount > 0, "Cannot init the influence of a player with a non-positive number.");
            influenceData.players.push(player);
            influenceData.influences.push(uint256(amount));
            s.playerHasInfluenceInRegion[player][regionId] = true;
            emit PlayerInfluenceInRegionUpdated(player, regionId, uint256(amount));
        }
    }

    /*///////////////////////////////////////////////////////////////
                            DUNGEON MUTATIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Create the harvestable ground resource on that tile. This requires a perlin value. If it is over the SOUL_GROUND_RESOURCE_PERLIN_THRESHOLD
    /// we create tileHarvestableGroundResources for that tile
    /// @param tileId Tile id of the tile to be made harvestable.
    /// @param resource Type of resource tile.
    /// @param perlinValue the computed perlin value
    /// @dev The gold and soul tiles on the map are generated via a perlin noise function. Additionally, when the perlin value is high enough
    /// in the case of souls, we add souls "in the ground" of the tile that can be harvested via a SOUL_GENERATOR
    /// this creates strategical opportunity for long term map control
    function _initHarvestableGroundResources(
        uint256 tileId,
        LibTypes.Resource resource,
        uint256 perlinValue
    ) public {
        AppStorage storage s = getAppStorage();
        if (
            resource == LibTypes.Resource.SOULS && perlinValue >= s.gameConstants.SOUL_GROUND_RESOURCE_PERLIN_THRESHOLD
        ) {
            s.tileHarvestableGroundResources[tileId].souls = s.gameConstants.MAX_SOULS_HARVESTED_PER_SOUL_TILE;
            s.tilesWithHarvestableGroundResources.push(tileId);
            emit TileHarvestableGroundResourcesUpdated(tileId, s.tileHarvestableGroundResources[tileId]);
        }
    }

    /// @notice Initialize a region when the first tile inside a region is mined
    /// @param id Region id of the region to be mined.
    /// @param tile The first tile mined in the region
    /// @param firstMiner Address of the player that will be known to have first mined this region.
    function _mineRegion(
        uint256 id,
        uint256 tile,
        address firstMiner
    ) public {
        AppStorage storage s = getAppStorage();
        require(!s.regions[id].isMined, "This region has already been mined.");
        s.regionIds.push(id);
        LibTypes.Region storage _region = s.regions[id];
        _region.isMined = true;
        _region.firstMiner = firstMiner;
        _region.tiles.push(tile);
        _region.lastSpawnTimestamp = 0;
        emit RegionMined(id, firstMiner);
    }

    /// @notice Helper function that mines all the tiles in the region specified by id.
    /// @param regionId The region id of the region to be mined.
    /// @param firstMiner The address of the player to set as the first miner of this region.
    function _mineCompleteRegion(uint256 regionId, address firstMiner) public {
        AppStorage storage s = getAppStorage();
        require(!s.regions[regionId].isMined, "This region has already been mined.");
        // Add region to list of regionIds that are mined.
        s.regionIds.push(regionId);

        // Set the region as mined and set it's first miner.
        LibTypes.Region storage _region = s.regions[regionId];
        _region.isMined = true;
        _region.firstMiner = firstMiner;

        // Add all of the tiles in this region to the tiles property of _region.
        LibTypes.Coord memory regionCoord = LibUtils.idToCoord(regionId);
        LibTypes.Coord memory topLeftTileCoord = LibUtils.toTopLeftTileCoord(regionCoord, s.REGION_LENGTH);
        for (int32 i = 0; i < int32(s.REGION_LENGTH); i++) {
            for (int32 j = 0; j < int32(s.REGION_LENGTH); j++) {
                _region.tiles.push(LibUtils.coordToId(LibTypes.Coord(topLeftTileCoord.x + i, topLeftTileCoord.y + j)));
            }
        }
        emit RegionMined(regionId, firstMiner);
    }

    /// @notice Helper function that adds a tile id to a region id in AppStorage.
    /// @param id Tile id of the tile to be added to the region.
    /// @param region Region id of the region to which the tile will be added.
    /// @dev Region must be mined in order for tiles to be added to it.
    function _addTileToRegion(uint256 id, uint256 region) public {
        AppStorage storage s = getAppStorage();
        require(s.regions[region].isMined, "This region has not been mined.");
        s.regions[region].tiles.push(id);
        emit RegionUpdated(region, s.regions[region]);
    }

    /// @notice Helper function that mines a specified tile.
    /// @param id Tile id of the tile to be mined.
    /// @param touchable Whether the tile can be interacted with
    /// @param miner Address of the player that will be set as the owner of the tile.
    function _mineTile(
        uint256 id,
        bool touchable,
        address miner
    ) public {
        AppStorage storage s = getAppStorage();
        require(!s.tiles[id].isMined, "This tile has already been mined.");
        // Add tile to list of tiles that are mined.
        s.tileIds.push(id);
        LibTypes.Tile storage _tile = s.tiles[id];
        _tile.isMined = true;
        _tile.owner = address(0);
        _tile.touchable = touchable;
        emit TileMined(id, touchable, miner);
    }

    /// @notice Helper function that claims a specified tile to the given player
    /// @param id Tile id of the region to be claimed
    /// @param owner Address of the player having claimed the tile
    function _claimTile(uint256 id, address owner) public {
        AppStorage storage s = getAppStorage();
        require(s.tiles[id].isMined, "This tile has not been mined.");
        LibTypes.Tile storage _tile = s.tiles[id];
        address previousOwner = _tile.owner;
        LibTypes.Player storage previousOwnerPlayer = s.players[_tile.owner];

        int256 influence = int256(s.gameConstants.INFLUENCE_PER_TILE_UPGRADE[0]);
        if (_tile.upgrade != LibTypes.TileUpgrade.NONE) {
            influence += int256(s.gameConstants.INFLUENCE_PER_TILE_UPGRADE[uint256(_tile.upgrade)]);
        }
        // Transfer influence if someone used to own this tile
        if (_tile.owner != address(0)) {
            _modifyInfluenceOfPlayerInRegion(LibUtils.tileIdToRegionId(id, s.REGION_LENGTH), previousOwner, -influence);
            // Increase storage capacity of new owner
            if (_tile.upgrade != LibTypes.TileUpgrade.NONE) {
                LibUpgrade._modifyResourceStorageOfPlayer(owner, _tile.upgrade, false);
            }
            if (
                _tile.upgrade == LibTypes.TileUpgrade.GOLD_STORAGE ||
                _tile.upgrade == LibTypes.TileUpgrade.SOUL_STORAGE ||
                _tile.upgrade == LibTypes.TileUpgrade.DUNGEON_HEART
            ) {
                uint256 index = 0;
                if (_tile.upgrade == LibTypes.TileUpgrade.GOLD_STORAGE) {
                    index = 1;
                } else if (_tile.upgrade == LibTypes.TileUpgrade.SOUL_STORAGE) {
                    index = 2;
                }
                {
                    // 1.1) Compute gold capacity utilization
                    // in percentage
                    int128 goldCapacityUtilization = LibMath.divu(
                        previousOwnerPlayer.gold,
                        previousOwnerPlayer.maxGold
                    );
                    // 1.2) Compute amount stored per unit
                    int256 goldPerStorageTile = LibMath.muli(
                        goldCapacityUtilization,
                        int256(s.gameConstants.TILE_UPGRADE_GOLD_STORAGE[index])
                    );
                    if (goldPerStorageTile > 0) {
                        // 1.3) Decrease previous owners gold amount
                        LibUpgrade._modifyResourceOfPlayer(
                            previousOwner,
                            -goldPerStorageTile,
                            LibUtils.tileIdToRegionId(id, s.REGION_LENGTH),
                            LibTypes.Resource.GOLD
                        );
                        // 1.4) Increase new owners gold amount
                        LibUpgrade._modifyResourceOfPlayer(
                            owner,
                            goldPerStorageTile,
                            LibUtils.tileIdToRegionId(id, s.REGION_LENGTH),
                            LibTypes.Resource.GOLD
                        );
                    }
                }
                {
                    // 2.1) Compute soul capacity utilization
                    int128 soulsCapacityUtilization = LibMath.divu(
                        previousOwnerPlayer.souls,
                        previousOwnerPlayer.maxSouls
                    );
                    // 2.2) Compute amount stored per unit
                    int256 soulsPerStorageTile = LibMath.muli(
                        soulsCapacityUtilization,
                        int256(s.gameConstants.TILE_UPGRADE_SOUL_STORAGE[index])
                    );
                    if (soulsPerStorageTile > 0) {
                        // 2.3) Decrease previous owners soul amount
                        LibUpgrade._modifyResourceOfPlayer(
                            previousOwner,
                            -soulsPerStorageTile,
                            LibUtils.tileIdToRegionId(id, s.REGION_LENGTH),
                            LibTypes.Resource.SOULS
                        );
                        // 2.4) Increase new owners soul amount
                        LibUpgrade._modifyResourceOfPlayer(
                            owner,
                            soulsPerStorageTile,
                            LibUtils.tileIdToRegionId(id, s.REGION_LENGTH),
                            LibTypes.Resource.SOULS
                        );
                    }
                }
            }
            // Decrease storage capacity of old owner
            if (_tile.upgrade != LibTypes.TileUpgrade.NONE) {
                LibUpgrade._modifyResourceStorageOfPlayer(previousOwner, _tile.upgrade, true);
            }
        }
        _tile.owner = owner;
        _modifyInfluenceOfPlayerInRegion(LibUtils.tileIdToRegionId(id, s.REGION_LENGTH), owner, influence);
        emit TileClaimed(id, owner);
    }

    /// @notice Helper function that upgrades a specified tile to the specified TileUpgrade
    /// @param id Tile id of the region to be upgraded
    /// @param owner Address of the player having ugpraded the tile (which must also be the owner of the tile)
    /// @param upgrade upgrade being installed on the tile
    function _upgradeTile(
        uint256 id,
        address owner,
        LibTypes.TileUpgrade upgrade
    ) public {
        AppStorage storage s = getAppStorage();
        LibTypes.Tile storage _tile = s.tiles[id];
        _tile.upgrade = upgrade;
        _modifyInfluenceOfPlayerInRegion(
            LibUtils.tileIdToRegionId(id, s.REGION_LENGTH),
            owner,
            int256(s.gameConstants.INFLUENCE_PER_TILE_UPGRADE[uint256(upgrade)])
        );
        LibUpgrade._modifyResourceStorageOfPlayer(owner, upgrade, false);
        emit TileUpgraded(id, upgrade);
    }

    /*///////////////////////////////////////////////////////////////
                            DELAYED ACTIONS
    //////////////////////////////////////////////////////////////*/

    function __deleteDelayedAction(uint256 id, uint256 index) internal {
        AppStorage storage s = getAppStorage();
        LibTypes.TileDelayedAction[] storage array = s.tileToTileDelayedActions[id];
        require(index < array.length);
        for (uint256 i = index; i < array.length - 1; i++) {
            array[i] = array[i + 1];
        }
        array.pop();
    }

    function __deleteTileWithDelayedActions(uint256 id) internal {
        AppStorage storage s = getAppStorage();
        uint256[] storage array = s.tilesWithDelayedActions;
        uint256 index = array.length;
        for (uint256 i = 0; i < s.tilesWithDelayedActions.length; i++) {
            if (s.tilesWithDelayedActions[i] == id) {
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

    // TODO: clean stale delayedActions when initiating/completing a delayedAction
    function __enforceMinDelay(
        uint256 submittedTimestamp,
        LibTypes.TileDelayedActionType actionType,
        bool playerControlsRegion
    ) internal view {
        AppStorage storage s = getAppStorage();
        uint256 minTimestamp = uint256(
            s.gameConstants.DELAYED_ACTIONS_MIN_SECOND_DELAY[uint16(actionType)][playerControlsRegion ? 0 : 1]
        );
        uint256 delay = block.timestamp - submittedTimestamp;
        require(delay >= minTimestamp, "You cannot complete this delayed action yet.");
        require(delay < s.gameConstants.SECONDS_UNTIL_EXPIRED_DELAYED_ACTION, "This delayed action has expired.");
    }

    function __initiateDelayedAction(uint256 id, LibTypes.TileDelayedActionType actionType)
        internal
        returns (LibTypes.TileDelayedAction memory ret)
    {
        AppStorage storage s = getAppStorage();
        for (uint256 i = 0; i < s.tileToTileDelayedActions[id].length; i++) {
            LibTypes.TileDelayedAction storage p = s.tileToTileDelayedActions[id][i];
            uint256 delay = block.timestamp - p.submittedTimestamp;
            if (p.delayedActionType == actionType && delay < s.gameConstants.SECONDS_UNTIL_EXPIRED_DELAYED_ACTION) {
                require(p.initiator != __msgSender(), "You already have a delayed wall action on this tile.");
            }
        }
        LibTypes.TileDelayedAction memory delayedAction = LibTypes.TileDelayedAction({
            tileId: id,
            initiator: __msgSender(),
            delayedActionType: actionType,
            submittedTimestamp: uint32(block.timestamp)
        });
        if (s.tileToTileDelayedActions[id].length == 0) {
            // add to the list of tiles with delayed actions
            s.tilesWithDelayedActions.push(id);
        }
        s.tileToTileDelayedActions[id].push(delayedAction);
        ret = delayedAction;
    }

    function __completeDelayedAction(
        uint256 id,
        LibTypes.TileDelayedActionType actionType,
        bool playerControlsRegion
    ) internal returns (LibTypes.TileDelayedAction memory ret) {
        AppStorage storage s = getAppStorage();
        uint256 index = s.tileToTileDelayedActions[id].length;
        for (uint256 i = 0; i < s.tileToTileDelayedActions[id].length; i++) {
            uint256 delay = block.timestamp - s.tileToTileDelayedActions[id][i].submittedTimestamp;
            if (
                s.tileToTileDelayedActions[id][i].delayedActionType == actionType &&
                s.tileToTileDelayedActions[id][i].initiator == __msgSender() &&
                delay < s.gameConstants.SECONDS_UNTIL_EXPIRED_DELAYED_ACTION
            ) {
                index = i;
                break;
            }
        }
        require(
            index != s.tileToTileDelayedActions[id].length,
            "No action on this tile initiated by you could be found."
        );
        LibTypes.TileDelayedAction storage delayedAction = s.tileToTileDelayedActions[id][index];
        ret = delayedAction;
        __enforceMinDelay(delayedAction.submittedTimestamp, actionType, playerControlsRegion);
        __deleteDelayedAction(id, index);
        if (s.tileToTileDelayedActions[id].length == 0) {
            // remove from the list of tiles with delayed actions
            __deleteTileWithDelayedActions(id);
        }
    }

    function _initiateWallTile(uint256 id) public {
        LibTypes.TileDelayedAction memory delayedAction = __initiateDelayedAction(
            id,
            LibTypes.TileDelayedActionType.WALL
        );
        emit TileDelayedActionInitiated(delayedAction);
    }

    function _completeWallTile(uint256 id, bool playerControlsRegion) public {
        AppStorage storage s = getAppStorage();
        LibTypes.TileDelayedAction memory delayedAction = __completeDelayedAction(
            id,
            LibTypes.TileDelayedActionType.WALL,
            playerControlsRegion
        );
        s.tiles[id].isWalled = true;
        emit TileWalled(id);
        emit TileDelayedActionCompleted(delayedAction);
    }

    function _initiateUnwallTile(uint256 id) public {
        LibTypes.TileDelayedAction memory delayedAction = __initiateDelayedAction(
            id,
            LibTypes.TileDelayedActionType.UNWALL
        );
        emit TileDelayedActionInitiated(delayedAction);
    }

    function _completeUnwallTile(uint256 id, bool playerControlsRegion) public {
        AppStorage storage s = getAppStorage();
        LibTypes.TileDelayedAction memory delayedAction = __completeDelayedAction(
            id,
            LibTypes.TileDelayedActionType.UNWALL,
            playerControlsRegion
        );
        s.tiles[id].isWalled = false;
        emit TileUnwalled(id);
        emit TileDelayedActionCompleted(delayedAction);
    }

    function _initiateForceMineTile(uint256 id) public {
        LibTypes.TileDelayedAction memory delayedAction = __initiateDelayedAction(
            id,
            LibTypes.TileDelayedActionType.FORCE_MINE
        );
        emit TileDelayedActionInitiated(delayedAction);
    }

    function _completeForceMineTile(uint256 id, bool playerControlsRegion) public {
        AppStorage storage s = getAppStorage();
        uint256 toRegion = LibUtils.tileIdToRegionId(id, s.REGION_LENGTH);
        address player = __msgSender();
        LibTypes.TileDelayedAction memory delayedAction = __completeDelayedAction(
            id,
            LibTypes.TileDelayedActionType.FORCE_MINE,
            playerControlsRegion
        );
        _mineTile(id, true, player);
        if (!s.regions[toRegion].isMined) {
            _mineRegion(toRegion, id, player);
        } else {
            _addTileToRegion(id, toRegion);
        }
        emit TileDelayedActionCompleted(delayedAction);
    }
}
