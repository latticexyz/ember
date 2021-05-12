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

contract DungeonFacet {
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

    //////////////////////
    /// INTERNAL FUNCTIONS
    //////////////////////

    function initializePlayer(uint256 regionId) external notPaused {
        require(s.gameConstants.CAN_SPAWN, "can't spawn anymore");
        address player = __msgSender();
        require(!s.players[player].isInitialized, "this player has already been initialized");
        require(!s.regions[regionId].isMined, "this region has already been mined");

        // 0) Check maxX and maxY match the config
        LibTypes.Coord memory regionCoord = LibUtils.idToCoord(regionId);
        LibTypes.Coord memory topLeftTileCoord = LibUtils.toTopLeftTileCoord(regionCoord, s.REGION_LENGTH);
        require(topLeftTileCoord.x + s.REGION_LENGTH - 1 <= s.MAX_X, "outside max X bounds");
        require(topLeftTileCoord.x >= -(s.MAX_X), "outside min X bounds");
        require(topLeftTileCoord.y + s.REGION_LENGTH - 1 <= s.MAX_Y, "outside max Y bounds");
        require(topLeftTileCoord.y >= -(s.MAX_Y), "outside min Y bounds");

        // 1) Create a region with the tiles
        LibDungeon._mineCompleteRegion(regionId, player);

        // 2) Initialize the player
        s.players[player] = LibTypes.Player({
            isInitialized: true,
            player: player,
            initTimestamp: block.timestamp,
            gold: s.gameConstants.INITIAL_GOLD,
            souls: s.gameConstants.INITIAL_SOULS,
            population: 1, // the hero we are going to spawn
            mana: s.gameConstants.MAX_MANA,
            lastManaUpdateTimestamp: block.timestamp,
            maxGold: 0,
            maxSouls: 0,
            maxPopulation: 0
        });
        // create settlement
        LibDungeon._createSettlement(regionId, player);
        // 3) Mine all tiles
        uint256 tileId;
        for (int32 i = 1; i < int32(s.REGION_LENGTH - 1); i++) {
            for (int32 j = 1; j < int32(s.REGION_LENGTH - 1); j++) {
                tileId = LibUtils.coordToId(LibTypes.Coord(topLeftTileCoord.x + i, topLeftTileCoord.y + j));
                if (
                    (i == s.REGION_LENGTH / 2 || i == s.REGION_LENGTH / 2 - 1) &&
                    (j == s.REGION_LENGTH / 2 || j == s.REGION_LENGTH / 2 - 1)
                ) {
                    LibDungeon._mineTile(tileId, false, player);
                    LibDungeon._claimTile(tileId, player);
                    LibDungeon._upgradeTile(tileId, player, LibTypes.TileUpgrade.DUNGEON_HEART, regionId);
                } else {
                    LibDungeon._mineTile(tileId, true, player);
                    LibDungeon._claimTile(tileId, player);
                }
            }
        }
        // spawn hero
        LibTypes.Creature memory creature = LibCreatures._createCreature(
            tileId,
            LibTypes.CreatureSpecies.HERO,
            LibTypes.CreatureType.UNIQUE,
            player
        );
        LibCreatures._spawnCreature(creature);
        s.playerIds.push(player);
        emit PlayerInitialized(player, s.players[player], regionId);
    }

    function mineTile(uint256[] calldata packedPath) public onlyInitialized notPaused {
        address player = __msgSender();

        uint256[] memory path = LibUtils.unpackCoordListToIds(packedPath);
        uint256 minedTile = path[path.length - 1];

        // 0) Check max path length
        require(path.length <= 20, "path is longer than 20 tiles");

        // 1) Check that mined tile is in range
        LibChecks.requireInBounds(LibUtils.idToCoord(minedTile));

        // 2) Check that the mined tile has not been mined yet
        require(!s.tiles[minedTile].isMined, "this tile has already been mined!");

        uint256 fromRegion = LibUtils.tileIdToRegionId(path[0], s.REGION_LENGTH);
        uint256 toRegion = LibUtils.tileIdToRegionId(minedTile, s.REGION_LENGTH);

        // 3) Check that the from and to regions are adjacent or the same
        require(
            LibUtils.chebyshev(LibUtils.idToCoord(fromRegion), LibUtils.idToCoord(toRegion)) <= 1,
            "player does not control adjacent region"
        );

        // 4) Check that the minedTile is connected to the path
        // TODO: is this necessary?
        require(
            LibUtils.manhattan(LibUtils.idToCoord(path[path.length - 2]), LibUtils.idToCoord(minedTile)) == 1,
            "mined tile is not connected to path"
        );

        // 5.1) Check that all tiles are mined
        // 5.2) Check that the path is connected
        LibChecks._checkPathTiles(path, player, false, false, false, true, true);

        // 6) Check that the player controls the fromRegion
        (address fromRegionController, bool fromRegionContested) = LibDungeon._getRegionController(fromRegion);
        require(fromRegionController == player && !fromRegionContested, "player does not control the from region");

        // 7) Check that no one (or the player) controls the toRegion
        (address toRegionController, bool toRegionContested) = LibDungeon._getRegionController(toRegion);
        require(
            toRegionController == address(0) || toRegionController == player,
            "someone else controls the to region"
        );
        require(!toRegionContested, "the to region is contested");

        // Check that the first tile is where a hero is
        bool found;
        LibTypes.Creature storage hero;
        for (uint256 i = 0; i < s.regions[fromRegion].creatures.length; i++) {
            if (s.creatures[s.regions[fromRegion].creatures[i]].species == LibTypes.CreatureSpecies.HERO) {
                found = true;
                hero = s.creatures[s.regions[fromRegion].creatures[i]];
            }
        }
        require(found, "no hero was found on the fromRegion");
        require(hero.tileId == path[0], "hero is not on the first tile");
        require(hero.owner == player, "hero is no the player's hero");

        // 8) Charge mana
        LibMana.chargeManaForAction(LibTypes.ActionType.MINE);

        // Mutation: mine the tile!
        LibDungeon._mineTile(minedTile, true, player);
        if (!s.regions[toRegion].isMined) {
            LibDungeon._mineRegion(toRegion, minedTile, player);
        } else {
            LibDungeon._addTileToRegion(minedTile, toRegion);
        }
    }

    function mineResourceTile(LibTypes.Resource resourceType, uint256[] calldata packedPath)
        external
        onlyInitialized
        notPaused
    {
        address player = __msgSender();
        LibTypes.Coord[] memory path = LibUtils.unpackCoordList(packedPath);
        LibTypes.Coord memory minedTile = path[path.length - 1];

        uint32 scale = resourceType == LibTypes.Resource.GOLD
            ? uint32(s.gameConstants.PERLIN_1_SCALE)
            : resourceType == LibTypes.Resource.SOULS
            ? uint32(s.gameConstants.PERLIN_2_SCALE)
            : 0;
        uint32 key = resourceType == LibTypes.Resource.GOLD
            ? uint32(s.gameConstants.PERLIN_1_KEY)
            : resourceType == LibTypes.Resource.SOULS
            ? uint32(s.gameConstants.PERLIN_2_KEY)
            : 0;

        uint256 perlinValue = LibPerlin.computePerlin(minedTile.x, minedTile.y, key, scale);

        uint256 toRegion = LibUtils.coordToId(LibUtils.toRegionCoord(minedTile, s.REGION_LENGTH));
        mineTile(packedPath);
        if (resourceType == LibTypes.Resource.SOULS && perlinValue >= s.gameConstants.SOUL_PERLIN_THRESHOLD) {
            LibUpgrade._modifyResourceOfPlayer(
                player,
                int256(s.gameConstants.SOULS_PER_SOUL_BLOCK),
                toRegion,
                LibTypes.Resource.SOULS
            );
            LibDungeon._initHarvestableGroundResources(
                LibUtils.coordToId(minedTile),
                LibTypes.Resource.SOULS,
                perlinValue
            );
        } else if (resourceType == LibTypes.Resource.GOLD && perlinValue >= s.gameConstants.GOLD_PERLIN_THRESHOLD) {
            LibUpgrade._modifyResourceOfPlayer(
                player,
                int256(s.gameConstants.GOLD_PER_GOLD_BLOCK),
                toRegion,
                LibTypes.Resource.GOLD
            );
        }
    }

    function harvestTiles(uint256[] calldata packedTiles) external onlyInitialized notPaused {
        address player = __msgSender();
        uint256[] memory tiles = LibUtils.unpackCoordListToIds(packedTiles);

        uint256 region = LibUtils.tileIdToRegionId(tiles[0], s.REGION_LENGTH);

        // 1) Check that the player controlls the region
        (address regionController, bool contested) = LibDungeon._getRegionController(region);
        require(regionController == player, "player is not the region controller");
        require(!contested, "the region is contested");

        // 2.1) Check that all tiles are mined
        // 2.2) Check that all tiles are owned by the player
        // 2.3) Check that all upgrades are the same
        LibChecks._checkPathTiles(tiles, player, true, true, true, false, false);

        // 3) Check that all tiles are connected in a cluster
        LibChecks._checkConnection(tiles);

        // 4) Harvest the tiles
        uint256[] memory uniqueTiles = LibUtils.getUniqueEntries(tiles);
        LibUpgrade._harvestTiles(uniqueTiles, s.tiles[tiles[0]].upgrade);
    }

    function upgradeTile(uint256 tileId, LibTypes.TileUpgrade upgrade) external onlyInitialized notPaused {
        address player = __msgSender();

        // 0) Check that the tile is mined
        require(s.tiles[tileId].isMined, "tile is not mined yet");
        // 1) Check that the tile is owned by the player
        require(s.tiles[tileId].owner == player, "player does not own the tile");
        // 2) Check that the region is controlled by the player
        (address regionController, bool contested) = LibDungeon._getRegionController(
            LibUtils.tileIdToRegionId(tileId, s.REGION_LENGTH)
        );
        require(regionController == player, "player is not the region controller");
        require(!contested, "the region is contested");
        // 3) Check that the tile is not upgraded yet
        require(s.tiles[tileId].upgrade == LibTypes.TileUpgrade.NONE, "tile is already upgraded");
        (, uint256 settlementId) = LibDungeon._getSettlementFromRegion(
            LibUtils.tileIdToRegionId(tileId, s.REGION_LENGTH)
        );
        uint256 pricePercentIncrease = uint256(
            s.gameConstants.TILE_UPGRADE_PRICE_PERCENT_INCREASE_PER_UNIT[uint256(upgrade)]
        );
        uint256 numberOfUpgradesOfType = s.settlementToNumberOfTileUpgrades[settlementId][upgrade];
        // 4) Charge the player
        LibUpgrade._chargePlayerForUpgradeAndInitHarvestTimestamp(
            tileId,
            upgrade,
            pricePercentIncrease,
            numberOfUpgradesOfType
        );
        LibMana.chargeManaForAction(LibTypes.ActionType.UPGRADE);
        // 5) Upgrade tile
        LibDungeon._upgradeTile(tileId, player, upgrade, settlementId);
    }

    function removeUpgrade(uint256 tileId) external onlyInitialized notPaused {
        address player = __msgSender();
        require(s.tiles[tileId].owner == player, "player is not owner");
        // 2) Check that the region is controlled by the player
        (address regionController, bool contested) = LibDungeon._getRegionController(
            LibUtils.tileIdToRegionId(tileId, s.REGION_LENGTH)
        );
        require(regionController == player, "player is not the region controller");
        require(!contested, "the region is contested");
        // 3) Check that the tile has an upgrade
        require(s.tiles[tileId].upgrade != LibTypes.TileUpgrade.NONE, "tile has not been upgraded");
        (, uint256 settlementId) = LibDungeon._getSettlementFromRegion(
            LibUtils.tileIdToRegionId(tileId, s.REGION_LENGTH)
        );
        LibDungeon._removeUpgrade(tileId, player, settlementId);
    }

    function removeWall(uint256 tileId) external onlyInitialized notPaused {
        address player = __msgSender();
        require(s.tiles[tileId].owner == player, "player is not owner");
        // 2) Check that the region is controlled by the player
        (address regionController, bool contested) = LibDungeon._getRegionController(
            LibUtils.tileIdToRegionId(tileId, s.REGION_LENGTH)
        );
        require(regionController == player, "player is not the region controller");
        require(!contested, "the region is contested");
        // 3) Check that the tile has an upgrade
        require(s.tiles[tileId].isWalled, "tile has not been walled");
        s.tiles[tileId].isWalled = false;
        emit TileUnwalled(tileId);
    }

    function claimResourcesOnRegion(uint256 regionId) external onlyInitialized notPaused {
        address player = __msgSender();
        // 0) Check that the region is controlled by the player
        (address regionController, bool contested) = LibDungeon._getRegionController(regionId);
        require(regionController == player, "player is not the region controller");
        require(!contested, "the region is contested");
        // 1) Empty the region's resources
        LibTypes.Region storage region = s.regions[regionId];
        // drop it before increasing the resource of the player as it might overflow the player's storage and flow back to the region
        int256 soulsInRegion = int256(region.souls);
        region.souls = 0;
        LibUpgrade._modifyResourceOfPlayer(player, soulsInRegion, regionId, LibTypes.Resource.SOULS);
        int256 goldInRegion = int256(region.gold);
        region.gold = 0;
        LibUpgrade._modifyResourceOfPlayer(player, goldInRegion, regionId, LibTypes.Resource.GOLD);
        emit RegionUpdated(regionId, region);
    }

    function wallTile(uint256 tileId) external onlyInitialized notPaused {
        address player = __msgSender();
        // 0) Check that the tile is mined
        require(s.tiles[tileId].isMined, "tile is not mined yet");
        // 1) Check that the tile is owned by the player
        require(s.tiles[tileId].owner == player, "player does not own the tile");
        // 2) Check that the region is controlled by the player
        (address regionController, bool contested) = LibDungeon._getRegionController(
            LibUtils.tileIdToRegionId(tileId, s.REGION_LENGTH)
        );
        require(regionController == player, "player is not the region controller");
        require(!contested, "the region is contested");
        // 3) Check that the tile is not walled yet
        require(!s.tiles[tileId].isWalled, "tile is already walled");
        // 4) check that the tile has no upgrade
        require(s.tiles[tileId].upgrade == LibTypes.TileUpgrade.NONE, "tile is already upgraded");
        // 5) Check that the player has enough gold and charge them
        LibTypes.Player storage playerData = s.players[player];
        require(playerData.gold >= s.gameConstants.WALL_PRICE, "not enough funds");
        playerData.gold -= s.gameConstants.WALL_PRICE;
        // charge the energy on the settlement
        LibDungeon._chargePlayerForUpgrade(tileId);
        // 6) Complete
        LibDungeon._wallTile(tileId);
        emit PlayerUpdated(player, s.players[player]);
    }

    //////////////////
    //// Delayed Actions
    /////////////////

    ///////////////
    //// Unwall Tile
    //////////////

    function initiateUnwallTile(uint256[] calldata packedPath) external onlyInitialized notPaused {
        address player = __msgSender();

        uint256[] memory path = LibUtils.unpackCoordListToIds(packedPath);
        uint256 minedTile = path[path.length - 1];

        // 0) Check max path length
        require(path.length <= 20, "path is longer than 20 tiles");

        // 1) Check that the tile is a wall
        require(s.tiles[minedTile].isWalled, "this tile is not a wall");

        // 2.1) Check that all tiles are mined
        // 2.2) Check that path is connected
        LibChecks._checkPathTiles(path, player, false, false, false, true, true);

        // 5) Check that the player controls the fromRegion
        uint256 fromRegion = LibUtils.tileIdToRegionId(path[0], s.REGION_LENGTH);
        (address regionController, bool contested) = LibDungeon._getRegionController(fromRegion);
        require(regionController == player, "player is not the region controller");
        require(!contested, "the region is contested");

        // 6) Check that the from and to regions are adjacent or the same
        uint256 toRegion = LibUtils.tileIdToRegionId(minedTile, s.REGION_LENGTH);
        require(
            LibUtils.chebyshev(LibUtils.idToCoord(fromRegion), LibUtils.idToCoord(toRegion)) <= 1,
            "player does not control adjacent region"
        );

        LibChecks.checkHeroOnFirstTileOfPath(path, player);

        LibDungeon._initiateUnwallTile(minedTile);
    }

    function completeUnwallTile(uint256[] calldata packedPath) external onlyInitialized notPaused {
        address player = __msgSender();

        uint256[] memory path = LibUtils.unpackCoordListToIds(packedPath);
        uint256 minedTile = path[path.length - 1];

        // 0) Check max path length
        require(path.length <= 20, "path is longer than 20 tiles");

        // 1) Check that the tile is a wall
        require(s.tiles[minedTile].isWalled, "this tile is not a wall");

        // 2.1) Check that all tiles are mined
        // 2.2) Check that path is connected
        LibChecks._checkPathTiles(path, player, false, false, false, true, true);

        // 3) Check that the player control the fromRegion
        uint256 fromRegion = LibUtils.tileIdToRegionId(path[0], s.REGION_LENGTH);
        (address fromRegionController, bool fromRegionContested) = LibDungeon._getRegionController(fromRegion);
        require(fromRegionController == player, "player is not the region controller");
        require(!fromRegionContested, "the region is contested");

        // 6) Check that the from and to regions are adjacent or the same
        uint256 toRegion = LibUtils.tileIdToRegionId(minedTile, s.REGION_LENGTH);
        require(
            LibUtils.chebyshev(LibUtils.idToCoord(fromRegion), LibUtils.idToCoord(toRegion)) <= 1,
            "player does not control adjacent region"
        );

        LibChecks.checkHeroOnFirstTileOfPath(path, player);
        LibMana.chargeManaForAction(LibTypes.ActionType.MINE);

        (address toRegionController, bool toRegionContested) = LibDungeon._getRegionController(toRegion);
        LibDungeon._completeUnwallTile(minedTile, player == toRegionController && !toRegionContested);
    }

    ///////////////
    //// Force Mine Tile
    //////////////

    function initiateForceMineTile(uint256[] calldata packedPath) external onlyInitialized notPaused {
        address player = __msgSender();

        uint256[] memory path = LibUtils.unpackCoordListToIds(packedPath);
        uint256 minedTile = path[path.length - 1];

        // 0) Check max path length
        require(path.length <= 20, "path is longer than 20 tiles");

        // 1) Check that mined tile is in range
        LibChecks.requireInBounds(LibUtils.idToCoord(minedTile));

        // 2) Check that the mined tile has not been mined yet
        require(!s.tiles[minedTile].isMined, "this tile has already been mined!");

        // 3.1) Check that all tiles are mined
        // 3.2) Check that the path is connected
        LibChecks._checkPathTiles(path, player, false, false, false, true, true);

        // 4) Check that the player control the fromRegion
        uint256 fromRegion = LibUtils.tileIdToRegionId(path[0], s.REGION_LENGTH);
        (address regionController, bool contested) = LibDungeon._getRegionController(fromRegion);
        require(regionController == player, "player is not the region controller");
        require(!contested, "the region is contested");

        // 6) Check that the from and to regions are adjacent or the same
        uint256 toRegion = LibUtils.tileIdToRegionId(minedTile, s.REGION_LENGTH);
        require(
            LibUtils.chebyshev(LibUtils.idToCoord(fromRegion), LibUtils.idToCoord(toRegion)) <= 1,
            "player does not control adjacent region"
        );

        // Check that the first tile is where a hero is
        LibChecks.checkHeroOnFirstTileOfPath(path, player);
        LibDungeon._initiateForceMineTile(minedTile);
    }

    function completeForceMineTile(uint256[] calldata packedPath) external onlyInitialized notPaused {
        address player = __msgSender();

        uint256[] memory path = LibUtils.unpackCoordListToIds(packedPath);
        uint256 minedTile = path[path.length - 1];

        // 2) Check max path length
        require(path.length <= 20, "path is longer than 20 tiles");

        // 2) Check that mined tile is in range
        LibChecks.requireInBounds(LibUtils.idToCoord(minedTile));

        // 3) Check that the mined tile has not been mined yet
        require(!s.tiles[minedTile].isMined, "this tile has already been mined");

        // 3.1) Check that all tiles are mined
        // 3.2) Check that the path is connected
        LibChecks._checkPathTiles(path, player, false, false, false, true, true);

        // 5) Check that the player control the fromRegion
        uint256 toRegion = LibUtils.tileIdToRegionId(minedTile, s.REGION_LENGTH);
        uint256 fromRegion = LibUtils.tileIdToRegionId(path[0], s.REGION_LENGTH);

        // 6) Check that the from and to regions are adjacent or the same
        require(
            LibUtils.chebyshev(LibUtils.idToCoord(fromRegion), LibUtils.idToCoord(toRegion)) <= 1,
            "player does not control adjacent region"
        );

        {
            (address fromRegionController, bool fromRegionContested) = LibDungeon._getRegionController(fromRegion);
            require(fromRegionController == player, "player is not the region controller");
            require(!fromRegionContested, "the region is contested");
            // Check that the first tile is where a hero is
            LibChecks.checkHeroOnFirstTileOfPath(path, player);
            LibMana.chargeManaForAction(LibTypes.ActionType.MINE);

            (address toRegionController, bool toRegionContested) = LibDungeon._getRegionController(toRegion);
            LibDungeon._completeForceMineTile(minedTile, toRegionController == player && !toRegionContested);
        }
    }

    struct ForceMineResourceTileVars {
        uint32 key;
        uint32 scale;
        uint256 perlinValue;
        uint256 minedTileId;
        uint256 toRegion;
        uint256 fromRegion;
    }

    function completeForceMineResourceTile(LibTypes.Resource resourceType, uint256[] calldata packedPath)
        external
        onlyInitialized
        notPaused
    {
        address player = __msgSender();

        LibTypes.Coord[] memory path = LibUtils.unpackCoordList(packedPath);
        LibTypes.Coord memory minedTile = path[path.length - 1];

        ForceMineResourceTileVars memory vars;

        // 1) Check max path length
        require(path.length <= 20, "path is longer than 20 tiles");

        // 2) Check that mined tile is in range
        LibChecks.requireInBounds(minedTile);

        // 3) Check that the mined tile has not been mined yet
        vars.minedTileId = LibUtils.coordToId(minedTile);
        require(!s.tiles[vars.minedTileId].isMined, "this tile has already been mined");

        // 3.1) Check that all tiles are mined
        // 3.2) Check that the path is connected
        uint256[] memory pathOfIds = LibUtils.unpackCoordListToIds(packedPath);
        LibChecks._checkPathTiles(pathOfIds, player, false, false, false, true, true);

        // 5) Check that the player control the fromRegion
        vars.toRegion = LibUtils.tileIdToRegionId(vars.minedTileId, s.REGION_LENGTH);
        vars.fromRegion = LibUtils.tileIdToRegionId(pathOfIds[0], s.REGION_LENGTH);

        // 6) Check that the from and to regions are adjacent or the same
        require(
            LibUtils.chebyshev(LibUtils.idToCoord(vars.fromRegion), LibUtils.idToCoord(vars.toRegion)) <= 1,
            "player does not control adjacent region"
        );

        {
            (address fromRegionController, bool fromRegionContested) = LibDungeon._getRegionController(vars.fromRegion);
            require(fromRegionController == player, "player is not the region controller");
            require(!fromRegionContested, "the region is contested");

            LibMana.chargeManaForAction(LibTypes.ActionType.MINE);
            LibChecks.checkHeroOnFirstTileOfPath(pathOfIds, player);

            (address toRegionController, bool toRegionContested) = LibDungeon._getRegionController(vars.toRegion);
            LibDungeon._completeForceMineTile(vars.minedTileId, toRegionController == player && !toRegionContested);
        }

        vars.scale = resourceType == LibTypes.Resource.GOLD
            ? uint32(s.gameConstants.PERLIN_1_SCALE)
            : resourceType == LibTypes.Resource.SOULS
            ? uint32(s.gameConstants.PERLIN_2_SCALE)
            : 0;

        vars.key = resourceType == LibTypes.Resource.GOLD
            ? uint32(s.gameConstants.PERLIN_1_KEY)
            : resourceType == LibTypes.Resource.SOULS
            ? uint32(s.gameConstants.PERLIN_2_KEY)
            : 0;

        vars.perlinValue = LibPerlin.computePerlin(minedTile.x, minedTile.y, vars.key, vars.scale);

        if (resourceType == LibTypes.Resource.SOULS && vars.perlinValue >= s.gameConstants.SOUL_PERLIN_THRESHOLD) {
            LibUpgrade._modifyResourceOfPlayer(
                player,
                int256(s.gameConstants.SOULS_PER_SOUL_BLOCK),
                vars.toRegion,
                LibTypes.Resource.SOULS
            );
            LibDungeon._initHarvestableGroundResources(vars.toRegion, LibTypes.Resource.SOULS, vars.perlinValue);
        } else if (
            resourceType == LibTypes.Resource.GOLD && vars.perlinValue >= s.gameConstants.GOLD_PERLIN_THRESHOLD
        ) {
            LibUpgrade._modifyResourceOfPlayer(
                player,
                int256(s.gameConstants.GOLD_PER_GOLD_BLOCK),
                vars.toRegion,
                LibTypes.Resource.GOLD
            );
        }
    }
}
