// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;
import "./LibTypes.sol";
import "./LibMath.sol";
import "./LibAppStorage.sol";
import "./LibUpgrade.sol";

library LibDungeon {
    function getAppStorage() internal pure returns (AppStorage storage ret) {
        ret = LibAppStorage.diamondStorage();
    }

    // IMPORTANT: those need the same name/signatures as the events in DungeonFacet
    event TileMined(uint256 tile, bool touchable, address miner);
    event RegionMined(uint256 region, address miner);
    event RegionUpdated(uint256 region, LibTypes.Region data);
    event TileClaimed(uint256 tile, address player);
    event TileUpgraded(uint256 tile, LibTypes.TileUpgrade upgrade);
    event PlayerInfluenceInRegionUpdated(address player, uint256 region, uint256 amount);
    event SettlementUpdated(uint256 region, LibTypes.Settlement data);
    // harvest
    event TileHarvestableGroundResourcesUpdated(uint256 tile, LibTypes.HarvestableGroundResources data);
    // delayed actions
    event TileDelayedActionInitiated(LibTypes.TileDelayedAction delayedAction);
    event TileDelayedActionCompleted(LibTypes.TileDelayedAction delayedAction);
    event TileWalled(uint256 tile);
    event TileUnwalled(uint256 tile);
    // player
    event PlayerUpdated(address player, LibTypes.Player data);

    ///////////////////////////////////
    /// UTILS FUNCTIONS ///
    ///////////////////////////////////

    function __msgSender() internal view returns (address) {
        AppStorage storage s = getAppStorage();
        address impersonating = s.impersonators[msg.sender];
        if (impersonating != address(0)) {
            return impersonating;
        } else {
            return msg.sender;
        }
    }

    function _getRegionController(uint256 id) public view returns (address controller, bool disputed) {
        AppStorage storage s = getAppStorage();
        uint256 maxInfluence = 0;
        uint256 totalInfluence = 0;
        address playerWithMaxInfluence = address(0);
        LibTypes.InfluenceData storage influenceData = s.influenceDataInRegion[id];
        for (uint256 i = 0; i < influenceData.players.length; i++) {
            if (influenceData.influences[i] > maxInfluence) {
                maxInfluence = influenceData.influences[i];
                playerWithMaxInfluence = influenceData.players[i];
            }
            totalInfluence += influenceData.influences[i];
        }
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

    ///////////////////////////////////
    /// INFLUENCE
    //////////////////////////////////
    function _modifyInfluenceOfPlayerInRegion(
        uint256 id,
        address player,
        int256 amount
    ) internal {
        AppStorage storage s = getAppStorage();
        LibTypes.InfluenceData storage influenceData = s.influenceDataInRegion[id];
        if (s.playerHasInfluenceInRegion[player][id]) {
            // We find the corresponding value and modify it
            for (uint256 i = 0; i < influenceData.players.length; i++) {
                if (influenceData.players[i] == player) {
                    if (amount < 0) {
                        require(influenceData.influences[i] >= uint256(-amount), "influence underflows");
                        influenceData.influences[i] -= uint256(-amount);
                    } else {
                        influenceData.influences[i] += uint256(amount);
                    }
                    emit PlayerInfluenceInRegionUpdated(player, id, influenceData.influences[i]);
                    break;
                }
            }
        } else {
            // We init a new tuple for this player
            require(amount > 0, "cannot init the influence of a player with a non positive number");
            influenceData.players.push(player);
            influenceData.influences.push(uint256(amount));
            s.playerHasInfluenceInRegion[player][id] = true;
            emit PlayerInfluenceInRegionUpdated(player, id, uint256(amount));
        }
    }

    ///////////////////////////////////
    /// DUNGEON MUTATIONS
    ///////////////////////////////////

    function _initHarvestableGroundResources(
        uint256 id,
        LibTypes.Resource resource,
        uint256 perlinValue
    ) public {
        AppStorage storage s = getAppStorage();
        if (
            resource == LibTypes.Resource.SOULS && perlinValue >= s.gameConstants.SOUL_GROUND_RESOURCE_PERLIN_THRESHOLD
        ) {
            s.tileHarvestableGroundResources[id].souls = s.gameConstants.MAX_SOULS_HARVESTED_PER_SOUL_TILE;
            s.tilesWithHarvestableGroundResources.push(id);
            emit TileHarvestableGroundResourcesUpdated(id, s.tileHarvestableGroundResources[id]);
        }
    }

    function _mineRegion(
        uint256 id,
        uint256 tile,
        address firstMiner
    ) public {
        AppStorage storage s = getAppStorage();
        require(!s.regions[id].isMined, "this region has already been mined");
        //console.log("> Mining region %s with first miner %s", id, firstMiner);
        s.regionIds.push(id);
        LibTypes.Region storage _region = s.regions[id];
        _region.isMined = true;
        _region.firstMiner = firstMiner;
        _region.tiles.push(tile);
        _region.lastSpawnTimestamp = 0;
        emit RegionMined(id, firstMiner);
    }

    function _mineCompleteRegion(uint256 id, address firstMiner) public {
        AppStorage storage s = getAppStorage();
        require(!s.regions[id].isMined, "this region has already been mined");
        //console.log("> Mining region %s with first miner %s", id, firstMiner);
        s.regionIds.push(id);
        LibTypes.Region storage _region = s.regions[id];
        _region.isMined = true;
        _region.firstMiner = firstMiner;
        LibTypes.Coord memory regionCoord = LibUtils.idToCoord(id);
        LibTypes.Coord memory topLeftTileCoord = LibUtils.toTopLeftTileCoord(regionCoord, s.REGION_LENGTH);
        for (int32 i = 0; i < int32(s.REGION_LENGTH); i++) {
            for (int32 j = 0; j < int32(s.REGION_LENGTH); j++) {
                _region.tiles.push(LibUtils.coordToId(LibTypes.Coord(topLeftTileCoord.x + i, topLeftTileCoord.y + j)));
            }
        }
        emit RegionMined(id, firstMiner);
    }

    function _addTileToRegion(uint256 id, uint256 region) public {
        AppStorage storage s = getAppStorage();
        require(s.regions[region].isMined, "this region has not been mined");
        s.regions[region].tiles.push(id);
        emit RegionUpdated(region, s.regions[region]);
    }

    function _mineTile(
        uint256 id,
        bool touchable,
        address miner
    ) public {
        AppStorage storage s = getAppStorage();
        require(!s.tiles[id].isMined, "this tile has already been mined");
        //console.log("> Mining tile %s", id);
        s.tileIds.push(id);
        LibTypes.Tile storage _tile = s.tiles[id];
        _tile.isMined = true;
        _tile.owner = address(0);
        _tile.touchable = touchable;
        emit TileMined(id, touchable, miner);
        // auto claim if close enough to a settlement
        (LibTypes.Settlement storage settlement, ) = _getSettlementFromRegion(
            LibUtils.tileIdToRegionId(id, s.REGION_LENGTH)
        );
        if (settlement.lastEnergyUpdateTimestamp != 0) {
            _claimTile(id, settlement.owner);
        }
    }

    function _getSettlementFromRegion(uint256 regionId)
        public
        view
        returns (LibTypes.Settlement storage settlement, uint256 checkRegionId)
    {
        AppStorage storage s = getAppStorage();
        LibTypes.Coord memory regionCoord = LibUtils.idToCoord(regionId);
        for (int32 i = -1; i <= 1; i++) {
            for (int32 j = -1; j <= 1; j++) {
                checkRegionId = LibUtils.coordToId(LibTypes.Coord({x: regionCoord.x + i, y: regionCoord.y + j}));
                if (s.settlements[checkRegionId].lastEnergyUpdateTimestamp != 0) {
                    if (s.settlements[checkRegionId].level == 2) {
                        return (s.settlements[checkRegionId], checkRegionId);
                    }
                    if (s.settlements[checkRegionId].level == 1) {
                        if (LibUtils.manhattan(LibUtils.idToCoord(checkRegionId), regionCoord) <= 1) {
                            return (s.settlements[checkRegionId], checkRegionId);
                        }
                    }
                    if (s.settlements[checkRegionId].level == 0) {
                        if (LibUtils.coordToId(regionCoord) == checkRegionId) {
                            return (s.settlements[checkRegionId], checkRegionId);
                        }
                    }
                }
            }
        }
        return (s.settlements[LibUtils.PAD_ID], LibUtils.PAD_ID);
    }

    function _claimTile(uint256 id, address owner) public {
        AppStorage storage s = getAppStorage();
        require(s.tiles[id].isMined, "this tile has not been mined");
        //console.log("> Claiming tile %s for player %s", id, owner);
        LibTypes.Tile storage _tile = s.tiles[id];
        address previousOwner = _tile.owner;
        LibTypes.Player storage previousOwnerPlayer = s.players[_tile.owner];

        int256 influence = int256(s.gameConstants.INFLUENCE_PER_TILE_UPGRADE[0]);
        if (_tile.upgrade != LibTypes.TileUpgrade.NONE) {
            influence += int256(s.gameConstants.INFLUENCE_PER_TILE_UPGRADE[uint256(_tile.upgrade)]);
        }
        if (_tile.owner != address(0) || _tile.upgrade != LibTypes.TileUpgrade.NONE) {
            // don't remove influence of address(0)
            if (_tile.owner != address(0)) {
                _modifyInfluenceOfPlayerInRegion(
                    LibUtils.tileIdToRegionId(id, s.REGION_LENGTH),
                    previousOwner,
                    -influence
                );
            }
            // Increase storage capacity of new owner
            if (_tile.upgrade != LibTypes.TileUpgrade.NONE) {
                LibUpgrade._modifyResourceStorageOfPlayer(owner, _tile.upgrade, false);
            }
            // don't steal from address(0)
            if (
                (_tile.upgrade == LibTypes.TileUpgrade.GOLD_STORAGE ||
                    _tile.upgrade == LibTypes.TileUpgrade.SOUL_STORAGE ||
                    _tile.upgrade == LibTypes.TileUpgrade.DUNGEON_HEART) && _tile.owner != address(0)
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
                    // don't transfer to address(0)
                    if (goldPerStorageTile > 0 && owner != address(0)) {
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
                    // don't transfer to address(0)
                    if (soulsPerStorageTile > 0 && owner != address(0)) {
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
            // Don't do it for address(0)
            if (_tile.upgrade != LibTypes.TileUpgrade.NONE && _tile.owner != address(0)) {
                LibUpgrade._modifyResourceStorageOfPlayer(previousOwner, _tile.upgrade, true);
            }
            // Drop excess of resources on floor (when new owner is address(0))
            if (owner == address(0)) {
                LibUpgrade._dropExcessResourceOnRegion(previousOwner, LibUtils.tileIdToRegionId(id, s.REGION_LENGTH));
            }
        }
        _tile.owner = owner;
        if (owner != address(0)) {
            _modifyInfluenceOfPlayerInRegion(LibUtils.tileIdToRegionId(id, s.REGION_LENGTH), owner, influence);
        }
        emit TileClaimed(id, owner);
    }

    function __computeEnergyInSettlement(uint256 regionId) internal view returns (uint256 updatedEnergy) {
        AppStorage storage s = getAppStorage();
        // get new mana
        LibTypes.Settlement storage settlement = s.settlements[regionId];
        require(settlement.lastEnergyUpdateTimestamp != 0, "this settlement does not exist");
        updatedEnergy =
            settlement.energy +
            LibMath.toUInt(
                LibMath.divu(
                    (block.timestamp - settlement.lastEnergyUpdateTimestamp),
                    s.gameConstants.NUMBER_OF_SECONDS_FOR_ONE_ENERGY_REGEN
                )
            );

        // cap energy
        if (updatedEnergy > s.gameConstants.MAX_ENERGY_PER_LEVEL[uint256(settlement.level)]) {
            updatedEnergy = s.gameConstants.MAX_ENERGY_PER_LEVEL[uint256(settlement.level)];
        }
    }

    function __chargeEnergy(uint256 regionId, uint256 amount) internal {
        AppStorage storage s = getAppStorage();
        uint256 updatedEnergy = __computeEnergyInSettlement(regionId);
        // pay energy or fail if not enough
        require(updatedEnergy >= amount, "Not enough energy");
        LibTypes.Settlement storage settlement = s.settlements[regionId];
        settlement.energy = updatedEnergy - amount;
        settlement.lastEnergyUpdateTimestamp = block.timestamp;
        emit SettlementUpdated(regionId, settlement);
    }

    function _chargePlayerForUpgrade(uint256 tileId) public {
        AppStorage storage s = getAppStorage();
        (, uint256 regionId) = _getSettlementFromRegion(LibUtils.tileIdToRegionId(tileId, s.REGION_LENGTH));
        __chargeEnergy(regionId, 1);
    }

    function _upgradeTile(
        uint256 id,
        address owner,
        LibTypes.TileUpgrade upgrade,
        uint256 settlementId
    ) public {
        AppStorage storage s = getAppStorage();
        //console.log("> Upgrading tile %s to %s", id, uint256(upgrade));
        LibTypes.Tile storage _tile = s.tiles[id];
        _tile.upgrade = upgrade;
        _modifyInfluenceOfPlayerInRegion(
            LibUtils.tileIdToRegionId(id, s.REGION_LENGTH),
            owner,
            int256(s.gameConstants.INFLUENCE_PER_TILE_UPGRADE[uint256(upgrade)])
        );
        LibUpgrade._modifyResourceStorageOfPlayer(owner, upgrade, false);
        s.settlementToNumberOfTileUpgrades[settlementId][upgrade]++;
        emit TileUpgraded(id, upgrade);
    }

    ///////////////////////
    //// Settlements
    //////////////////////

    function _createSettlement(uint256 id, address owner) public {
        AppStorage storage s = getAppStorage();
        require(s.settlements[id].owner == address(0), "there is already a settlement there");
        // check if another settlement is too close
        LibTypes.Coord memory regionCoord = LibUtils.idToCoord(id);
        for (int32 i = -2; i <= 2; i++) {
            for (int32 j = -2; j <= 2; j++) {
                uint256 checkRegionId = LibUtils.coordToId(
                    LibTypes.Coord({x: regionCoord.x + i, y: regionCoord.y + j})
                );
                require(s.settlements[checkRegionId].owner == address(0), "settlement too close");
            }
        }
        uint256 numberOfSettlementsOwnedByPlayer = s.playerToSettlements[owner].length;
        require(
            numberOfSettlementsOwnedByPlayer < s.gameConstants.SETTLEMENT_PRICE_PERCENT_INCREASE_PER_UNIT.length,
            "you have too many settlements already"
        );
        s.settlementIds.push(id);
        LibTypes.Settlement storage _settlement = s.settlements[id];
        _settlement.owner = owner;
        _settlement.level = 0;
        _settlement.energy = s.gameConstants.MAX_ENERGY_PER_LEVEL[_settlement.level];
        _settlement.lastEnergyUpdateTimestamp = block.timestamp;
        s.playerToSettlements[owner].push(id);
        console.log(owner);
        console.log(s.playerToSettlements[owner].length);
        emit SettlementUpdated(id, _settlement);
    }

    function _chargePlayerForSettlement(address owner, uint256 level) internal {
        AppStorage storage s = getAppStorage();
        // the first entry in SETTLEMENT_PRICE_PER_LEVEL is when creating a new settlement of level 0. entry with index i is to upgrade to level i.
        LibTypes.Player storage player = s.players[owner];
        uint256 goldCost = s.gameConstants.SETTLEMENT_PRICE_PER_LEVEL[level][uint256(LibTypes.Resource.GOLD)];
        uint256 soulsCost = s.gameConstants.SETTLEMENT_PRICE_PER_LEVEL[level][uint256(LibTypes.Resource.SOULS)];
        uint256 numberOfSettlementsOwnedByPlayer = s.playerToSettlements[owner].length;
        goldCost = LibMath.mulu(
            LibMath.divu(
                s.gameConstants.SETTLEMENT_PRICE_PERCENT_INCREASE_PER_UNIT[numberOfSettlementsOwnedByPlayer - 1],
                100
            ),
            goldCost
        );
        soulsCost = LibMath.mulu(
            LibMath.divu(
                s.gameConstants.SETTLEMENT_PRICE_PERCENT_INCREASE_PER_UNIT[numberOfSettlementsOwnedByPlayer - 1],
                100
            ),
            soulsCost
        );
        require(player.gold >= goldCost, "not enough gold funds");
        require(player.souls >= soulsCost, "not enough souls funds");
        player.gold -= goldCost;
        player.souls -= soulsCost;
        emit PlayerUpdated(owner, player);
    }

    function _upgradeSettlement(uint256 id) public {
        AppStorage storage s = getAppStorage();
        address playerAddress = __msgSender();
        LibTypes.Settlement storage settlement = s.settlements[id];
        require(settlement.lastEnergyUpdateTimestamp != 0, "there is no a settlement there");
        require(settlement.owner == playerAddress, "can only upgrade your own settlement");
        require(settlement.level != 2, "can't upgrade settlement further");
        // charge player
        _chargePlayerForSettlement(playerAddress, settlement.level + 1);
        // get energy before levelling up
        uint256 updatedEnergy = __computeEnergyInSettlement(id);
        // level up
        settlement.level++;
        // set energy
        settlement.energy = updatedEnergy;
        // claim the tiles that are now in the settlement radius
        LibTypes.Coord memory regionCoord = LibUtils.idToCoord(id);
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
                        _claimTile(tileId, settlement.owner);
                    }
                }
            }
        }
        emit SettlementUpdated(id, settlement);
    }

    ///////////////////////
    //// DELAYED ACTIONS
    //////////////////////

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
        require(delay >= minTimestamp, "you cannot complete this delayed action yet");
        require(delay < s.gameConstants.SECONDS_UNTIL_EXPIRED_DELAYED_ACTION, "this delayed action has expired");
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
                require(p.initiator != __msgSender(), "you already have a delayed wall action on this tile");
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
            "no action on this tile initiated by you could be found"
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

    function _wallTile(uint256 id) public {
        AppStorage storage s = getAppStorage();
        s.tiles[id].isWalled = true;
        emit TileWalled(id);
    }

    function _removeUpgrade(
        uint256 id,
        address owner,
        uint256 settlementId
    ) public {
        AppStorage storage s = getAppStorage();
        LibTypes.Tile storage _tile = s.tiles[id];
        LibTypes.TileUpgrade previousUpgrade = s.tiles[id].upgrade;
        _tile.upgrade = LibTypes.TileUpgrade.NONE;
        _modifyInfluenceOfPlayerInRegion(
            LibUtils.tileIdToRegionId(id, s.REGION_LENGTH),
            owner,
            -int256(s.gameConstants.INFLUENCE_PER_TILE_UPGRADE[uint256(previousUpgrade)])
        );
        LibUpgrade._modifyResourceStorageOfPlayer(owner, previousUpgrade, true);
        LibTypes.Player storage player = s.players[owner];
        LibUpgrade._dropExcessResourceOnRegion(owner, LibUtils.tileIdToRegionId(id, s.REGION_LENGTH));
        require(player.gold <= player.maxGold, "overflow of resources");
        require(player.souls <= player.maxSouls, "overflow of resources");
        s.settlementToNumberOfTileUpgrades[settlementId][previousUpgrade]--;
        emit TileUpgraded(id, LibTypes.TileUpgrade.NONE);
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
        // require(toRegion != 0, "tiles to region was not set");
        _mineTile(id, true, player);
        if (!s.regions[toRegion].isMined) {
            _mineRegion(toRegion, id, player);
        } else {
            _addTileToRegion(id, toRegion);
        }
        emit TileDelayedActionCompleted(delayedAction);
    }
}
