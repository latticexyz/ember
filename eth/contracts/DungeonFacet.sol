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

/// @title Dungeon Facet
/// @notice EIP-2535 Facet for the Dungeon.
contract DungeonFacet {
    AppStorage internal s;

    /*///////////////////////////////////////////////////////////////
                GENERAL PLAYER AND TILE ACTION EVENTS
    //////////////////////////////////////////////////////////////*/

    /// @notice Emitted when a player is initialized.
    /// @param player Address of the player that is initialized.
    /// @param data LibTypes.Player data of the player that is initialized.
    /// @param region Region id that the player will spawn at. TODO: Please check this.
    event PlayerInitialized(address indexed player, LibTypes.Player data, uint256 region);

    /// @notice Emirred when a player's LibTypes.Player data is updated.
    /// @param player Address of the player whose LibTypes.Player data is updated.
    /// @param data LibTypes.Player data of the player whose data is updated.
    event PlayerUpdated(address player, LibTypes.Player data);

    /// @notice Emitted when a tile is mined.
    /// @param tile Id of the tile that is mined.
    /// @param touchable TODO: What is this?
    /// @param miner Address of the player that mined the tile.
    event TileMined(uint256 tile, bool touchable, address miner);

    /// @notice Emitted when a region is mined, a region being a group of tiles. TODO: please specify the definition of a region here.
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

    /// TODO: How come this event is only called in LibDungeon but is in the Facet too?
    /// @notice Emitted when a player's influence in a region is updated.
    /// @param player Address of the player whose influence in a region is updated.
    /// @param region TODO: What is this?
    /// @param amount TODO: What is this?
    event PlayerInfluenceInRegionUpdated(address player, uint256 region, uint256 amount);

    /*///////////////////////////////////////////////////////////////
                            HARVESTING EVENTS
    //////////////////////////////////////////////////////////////*/

    /// @notice Emitted when a tile's last harvested timestamp is updated.
    /// @param tile Tile id of the tile whose timestamp is updated.
    /// @param timestamp The new timestamp of the tile.
    event TileLastHarvestTimestampUpdated(uint256 tile, uint32 timestamp);

    /// TODO: How come this event is never called? I can't quite tell what it is for as a result.
    event TileHarvestableGroundResourcesUpdated(uint256 tile, LibTypes.HarvestableGroundResources data);

    /*///////////////////////////////////////////////////////////////
                        DELAYED ACTION EVENTS
    //////////////////////////////////////////////////////////////*/

    /// @notice Emitted when a tile's delayed action is initiated.
    /// @param delayedAction The type of delayed action that is initiated.
    event TileDelayedActionInitiated(LibTypes.TileDelayedAction delayedAction);

    /// @notice Emitted when a tile's delayed action is completed.
    /// @param delayedAction The type of delayed action that is completed.
    event TileDelayedActionCompleted(LibTypes.TileDelayedAction delayedAction);

    /*///////////////////////////////////////////////////////////////
                        OTHER TILE ACTION EVENTS
    //////////////////////////////////////////////////////////////*/

    /// @notice Emitted when a tile is walled.
    /// @param tile Tile id of the tile that is walled.
    event TileWalled(uint256 tile);

    /// @notice Emitted when a tile is un-walled.
    /// @param tile Tile id of the tile that is un-walled.
    event TileUnwalled(uint256 tile);

    /// @notice Emitted when a player's Dungeon Heart is claimed by another player.
    /// @param region Region id of the Dungeon Heart that is claimed.
    /// @param previousOwner Address of the player that previously owned the Dungeon Heart.
    /// @param newOwner Address of the player that now owns the Dungeon Heart.
    /// @dev The region parameter actually refers to the regionId of the top left tile of the Dungeon Heart.
    event DungeonHeartClaimed(uint256 region, address previousOwner, address newOwner);

    /*///////////////////////////////////////////////////////////////
                       DEBUGGING EVENTS
    //////////////////////////////////////////////////////////////*/

    /// TODO: Do we want to remove this?
    event Time(uint256 time);

    /*///////////////////////////////////////////////////////////////
                        HELPER FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Get the address of the function caller by unwrapping the impersonator.
    /// @dev See ImpersonationFacet.sol for more information
    /// about how Impersonation works in Ember.
    function __msgSender() internal view returns (address) {
        address impersonating = s.impersonators[msg.sender];
        if (impersonating != address(0)) {
            return impersonating;
        } else {
            return msg.sender;
        }
    }

    /*///////////////////////////////////////////////////////////////
                            MODIFIERS
    //////////////////////////////////////////////////////////////*/

    /// @notice Checks that the player has been initialized,
    /// this typically happens in the initializePlayer function.
    modifier onlyInitialized() {
        require(s.players[__msgSender()].isInitialized, "Player is not initialized.");
        _;
    }

    /// @notice Checks that the game is not paused.
    /// @dev TODO: Explain when and why the game is ever paused.
    modifier notPaused() {
        require(!s.isPaused, "Game is paused.");
        emit Time(block.timestamp);
        _;
    }

    /*///////////////////////////////////////////////////////////////
                            INTERNAL FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Checks if a given path is valid according to the context of the game and player.
    /// @param path The path to check.
    /// @param player The player to check for.
    /// @param checkOwner Whether or not to check if the player owns all tiles on the path.
    /// @param checkLastTile Whether or not to check the last tile in the path.
    /// @param checkUpdates Whether or not to check if all the tile updates in the path are the same.
    /// @param checkConnected Whether or not to check if the path is connected.
    /// @param checkWalls Whether or not to check if if any tile in the path is walled by another player.
    /// @dev While various other functions perform additional checks on top of using this function,
    /// this function provides a common set of checks that are used by many functions in the DungeonFacet.
    function _checkPathTiles(
        uint256[] memory path,
        address player,
        bool checkOwner,
        bool checkLastTile,
        bool checkUpdates,
        bool checkConnected,
        bool checkWalls
    ) internal view {
        for (uint256 i = 0; i < (checkLastTile ? path.length : path.length - 1); i++) {
            if (checkConnected && i > 0) {
                // 1) Check path is connected
                require(
                    LibUtils.manhattan(LibUtils.idToCoord(path[i - 1]), LibUtils.idToCoord(path[i])) <= 1,
                    "Tiles are not connected to a path."
                );
            }

            // 2) Check that the tile is within the max bounds
            LibChecks.requireInBounds(LibUtils.idToCoord(path[i]));

            // 3) Check all tiles are mined
            require(s.tiles[path[i]].isMined, "One tile in the path is not mined.");

            if (checkWalls) {
                // 4) Check no tiles are walled by other players
                require(
                    !s.tiles[path[i]].isWalled || s.tiles[path[i]].owner == player,
                    "One tile in the path is walled by another player."
                );
            }

            if (checkOwner) {
                // 5) Check player owns all tiles on the path
                require(s.tiles[path[i]].owner == player, "One tile in the path is not owned by you.");
            }

            if (checkUpdates) {
                // 6) Check all upgrades are the same
                require(s.tiles[path[0]].upgrade == s.tiles[path[i]].upgrade, "Upgrades are not the same.");
            }
        }
    }

    /// @notice Checks whether a given array of tiles is connected and can form a path.
    /// @param _tiles The tiles to check.
    function _checkConnection(uint256[] memory _tiles) internal pure {
        uint256 tilesToVisit = _tiles.length;

        // Make a copy of the input array because it will be modified
        LibTypes.Coord[] memory tiles = new LibTypes.Coord[](_tiles.length);
        for (uint256 i = 0; i < _tiles.length; i++) {
            tiles[i] = LibUtils.idToCoord(_tiles[i]);
        }

        // The queue contains tiles whose neighbors havent been checked yet
        LibTypes.Coord[] memory queue = new LibTypes.Coord[](tiles.length);

        // Init the queue with the first tile and ignore this tile in future iterations
        queue[0] = tiles[0];
        uint256 queueLength = 1;
        tilesToVisit--;
        tiles[0] = tiles[tilesToVisit];

        while (queueLength > 0) {
            queueLength--;
            LibTypes.Coord memory current = queue[queueLength];

            uint256 addedToQueue = 0;
            for (uint256 i = 0; i < tilesToVisit - addedToQueue; i++) {
                // Add all tiles that are adjacent to this tile and have not been visited yet to the queue
                if (LibUtils.manhattan(current, tiles[i]) == 1) {
                    // Add tile to queue
                    queue[queueLength] = tiles[i];
                    queueLength++;
                    // Ignore this tile in future iterations
                    tiles[i] = tiles[tilesToVisit - addedToQueue - 1];
                    addedToQueue++;
                    // Check the index again that we've just moved a tile to
                    i--;
                }
            }
            // Reduce list size, tiles in the end have been moved to the front
            tilesToVisit -= addedToQueue;
        }

        require(tilesToVisit == 0, "Given tiles are not connected.");
    }

    /*///////////////////////////////////////////////////////////////
                    GENERAL TILE AND PLAYER FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Initializes the player and performs necessary state changes to reflect initialization.
    /// @param regionId The region to initialize the player in.
    function initializePlayer(uint256 regionId) external notPaused {
        require(s.gameConstants.CAN_SPAWN, "Can't spawn anymore.");
        address player = __msgSender();
        require(!s.players[player].isInitialized, "This player has already been initialized.");
        require(!s.regions[regionId].isMined, "This region has already been mined.");

        // 0) Check maxX and maxY match the config
        LibTypes.Coord memory regionCoord = LibUtils.idToCoord(regionId);
        LibTypes.Coord memory topLeftTileCoord = LibUtils.toTopLeftTileCoord(regionCoord, s.REGION_LENGTH);
        require(topLeftTileCoord.x + s.REGION_LENGTH - 1 <= s.MAX_X, "Outside max X bounds.");
        require(topLeftTileCoord.x >= -(s.MAX_X), "Outside min X bounds.");
        require(topLeftTileCoord.y + s.REGION_LENGTH - 1 <= s.MAX_Y, "Outside max Y bounds.");
        require(topLeftTileCoord.y >= -(s.MAX_Y), "Outside min Y bounds.");

        // 1) Create a region with the tiles
        LibDungeon._mineCompleteRegion(regionId, player);

        // 2) Initialize the player
        s.players[player] = LibTypes.Player({
            isInitialized: true,
            player: player,
            initTimestamp: block.timestamp,
            gold: s.gameConstants.INITIAL_GOLD,
            souls: s.gameConstants.INITIAL_SOULS,
            population: 0,
            mana: s.gameConstants.MAX_MANA,
            lastManaUpdateTimestamp: block.timestamp,
            maxGold: 0,
            maxSouls: 0,
            maxPopulation: 0
        });

        // 3) Mine all tiles
        for (int32 i = 1; i < int32(s.REGION_LENGTH - 1); i++) {
            for (int32 j = 1; j < int32(s.REGION_LENGTH - 1); j++) {
                uint256 tileId = LibUtils.coordToId(LibTypes.Coord(topLeftTileCoord.x + i, topLeftTileCoord.y + j));
                if (
                    (i == s.REGION_LENGTH / 2 || i == s.REGION_LENGTH / 2 - 1) &&
                    (j == s.REGION_LENGTH / 2 || j == s.REGION_LENGTH / 2 - 1)
                ) {
                    LibDungeon._mineTile(tileId, false, player);
                    LibDungeon._claimTile(tileId, player);
                    LibDungeon._upgradeTile(tileId, player, LibTypes.TileUpgrade.DUNGEON_HEART);
                } else {
                    LibDungeon._mineTile(tileId, true, player);
                    LibDungeon._claimTile(tileId, player);
                }
            }
        }
        s.playerIds.push(player);
        emit PlayerInitialized(player, s.players[player], regionId);
    }

    /// @notice Performs checks to ensure a path a player desires to mine is mineable by them,
    /// then calles LibDungeon._mineTile to actually mine the path if all checks pass.
    /// @param packedPath The path to mine.
    function mineTile(uint256[] calldata packedPath) public onlyInitialized notPaused {
        address player = __msgSender();

        uint256[] memory path = LibUtils.unpackCoordListToIds(packedPath);
        uint256 minedTile = path[path.length - 1];

        // 0) Check max path length
        require(path.length <= 20, "Path is longer than 20 tiles.");

        // 1) Check that mined tile is in range
        LibChecks.requireInBounds(LibUtils.idToCoord(minedTile));

        // 2) Check that the mined tile has not been mined yet
        require(!s.tiles[minedTile].isMined, "This tile has already been mined!");

        uint256 fromRegion = LibUtils.tileIdToRegionId(path[0], s.REGION_LENGTH);
        uint256 toRegion = LibUtils.tileIdToRegionId(minedTile, s.REGION_LENGTH);

        // 3) Check that the from and to regions are adjacent or the same
        require(
            LibUtils.chebyshev(LibUtils.idToCoord(fromRegion), LibUtils.idToCoord(toRegion)) <= 1,
            "Player does not control adjacent region."
        );

        // 4) Check that the minedTile is connected to the path
        require(
            LibUtils.manhattan(LibUtils.idToCoord(path[path.length - 2]), LibUtils.idToCoord(minedTile)) == 1,
            "Mined tile is not connected to path."
        );

        // 5.1) Check that all tiles are mined
        // 5.2) Check that the path is connected
        _checkPathTiles(path, player, false, false, false, true, true);

        // 6) Check that the player controls the fromRegion
        (address fromRegionController, bool fromRegionContested) = LibDungeon._getRegionController(fromRegion);
        require(fromRegionController == player && !fromRegionContested, "Player does not control the from region.");

        // 7) Check that no one (or the player) controls the toRegion
        (address toRegionController, bool toRegionContested) = LibDungeon._getRegionController(toRegion);
        require(
            toRegionController == address(0) || toRegionController == player,
            "Someone else controls the to region."
        );
        require(!toRegionContested, "The to region is contested.");

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

    /// @notice TODO
    /// @param resourceType The type of resource that will be mined.
    /// @param packedPath TODO What is packedPath? A path of tiles, in which there is some resource tile(s)?
    function mineResourceTile(LibTypes.Resource resourceType, uint256[] calldata packedPath)
        external
        onlyInitialized
        notPaused
    {
        address player = __msgSender();
        LibTypes.Coord[] memory path = LibUtils.unpackCoordList(packedPath);
        LibTypes.Coord memory minedTile = path[path.length - 1]; // TODO: why are we only taking the last tile in the path?

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

    /// @notice Performs checks to ensure a path a player desires to claim is claimable by them,
    /// then calles LibDungeon._claimTile to actually claim the path if all checks pass.
    /// @param packedPath The path to claim.
    function claimTile(uint256[] calldata packedPath) external onlyInitialized notPaused {
        address player = __msgSender();

        uint256[] memory path = LibUtils.unpackCoordListToIds(packedPath);

        // 0) Check max path length
        require(path.length <= 20, "Path is longer than 20 tiles.");

        uint256 claimedTile = path[path.length - 1];
        uint256 fromTile = path[0];
        uint256 fromRegionId = LibUtils.tileIdToRegionId(fromTile, s.REGION_LENGTH);
        uint256 toRegionId = LibUtils.tileIdToRegionId(claimedTile, s.REGION_LENGTH);

        // 1) Check that the from and to regions are adjacent or the same
        require(
            LibUtils.chebyshev(LibUtils.idToCoord(fromRegionId), LibUtils.idToCoord(toRegionId)) <= 1,
            "Player does not control adjacent region."
        );

        // 2) Check that the claimed tile has been mined and that it is touchable
        require(s.tiles[claimedTile].isMined, "This tile has not been mined.");
        require(s.tiles[claimedTile].touchable, "This tile is not touchable.");

        // 3) Check that the from tile is owned by the player
        // require(s.tiles[fromTile].owner == player, "The from tile is not owned by you!");

        // 4) Check that the claimedTile is connected to the path
        require(
            LibUtils.manhattan(LibUtils.idToCoord(path[path.length - 2]), LibUtils.idToCoord(claimedTile)) == 1,
            "Claimed tile is not connected to path."
        );

        // 5.1) Check that all tiles are mined
        // 5.2) Check that all tiles are owned by the player
        // 5.3) Check that the path is connected
        _checkPathTiles(path, player, false, false, false, true, true);

        // 6) Check that the player control the fromRegion
        (address fromRegionController, bool fromRegionContested) = LibDungeon._getRegionController(fromRegionId);
        require(fromRegionController == player && !fromRegionContested, "Player does not control the from region.");

        // 7) Check that no one (or the player) controls the toRegion
        (address toRegionController, bool toRegionContested) = LibDungeon._getRegionController(toRegionId);
        require(
            toRegionController == address(0) || toRegionController == player,
            "Someone else controls the to region."
        );
        require(!toRegionContested, "The to region is contested.");

        // 8) Charge mana
        LibMana.chargeManaForAction(LibTypes.ActionType.CLAIM);

        // Mutation: claim the tile!
        LibDungeon._claimTile(claimedTile, player);
    }

    /// @notice Claim another player's Dungeon Heart.
    /// @param packedDungeonHeart TODO: if this is a path of 4 tiles, why is it packed as a uint256 instead of a uint256[]?
    function claimDungeonHeart(uint256 packedDungeonHeart) external onlyInitialized notPaused {
        address player = __msgSender();

        uint256[4] memory dungeonHeartTiles = LibUtils.packedToIds(packedDungeonHeart);

        // 1.1) Check if all tiles are in same region
        // 1.2) Check if all tiles are dungeon heart tiles
        // 1.3) Check if no tiles are repeated
        uint256 regionId = LibUtils.tileIdToRegionId(dungeonHeartTiles[0], s.REGION_LENGTH);
        for (uint256 i = 0; i < dungeonHeartTiles.length; i++) {
            require(
                LibUtils.tileIdToRegionId(dungeonHeartTiles[i], s.REGION_LENGTH) == regionId,
                "Some of the dungeon heart tiles are not in the same region."
            );
            require(s.tiles[dungeonHeartTiles[i]].upgrade == LibTypes.TileUpgrade.DUNGEON_HEART);
            for (uint256 j = 0; j < i; j++) {
                require(dungeonHeartTiles[j] != dungeonHeartTiles[i], "No repetitions allowed.");
            }
        }

        // 2) Check that player doesn't already control the dungeon heart
        address currentOwner = s.tiles[dungeonHeartTiles[0]].owner;
        require(currentOwner != player, "You already control this dungeon heart.");

        // 3) Check that player controls the region
        (address regionController, bool regionContested) = LibDungeon._getRegionController(regionId);
        require(regionController == player && !regionContested, "Player does not control the region.");

        // 4) Claim the four tiles
        for (uint256 i = 0; i < dungeonHeartTiles.length; i++) {
            LibDungeon._claimTile(dungeonHeartTiles[i], player);
        }

        // 5) Transfer all resources
        LibTypes.Player storage currentOwnerData = s.players[currentOwner];
        LibUpgrade._modifyResourceOfPlayer(player, int256(currentOwnerData.souls), regionId, LibTypes.Resource.SOULS);
        LibUpgrade._modifyResourceOfPlayer(
            currentOwner,
            -int256(currentOwnerData.souls),
            regionId,
            LibTypes.Resource.SOULS
        );
        LibUpgrade._modifyResourceOfPlayer(player, int256(currentOwnerData.gold), regionId, LibTypes.Resource.GOLD);
        LibUpgrade._modifyResourceOfPlayer(
            currentOwner,
            -int256(currentOwnerData.gold),
            regionId,
            LibTypes.Resource.GOLD
        );

        emit DungeonHeartClaimed(regionId, currentOwner, player);
    }

    /// @notice Performs checks to ensure tiles a player desires to harvest is harvestable by them,
    /// then calles LibDungeon._harvestTiles to actually claim the path if all checks pass.
    /// @param packedTiles The path to harvest.
    function harvestTiles(uint256[] calldata packedTiles) external onlyInitialized notPaused {
        address player = __msgSender();
        uint256[] memory tiles = LibUtils.unpackCoordListToIds(packedTiles);

        uint256 region = LibUtils.tileIdToRegionId(tiles[0], s.REGION_LENGTH);

        // 1) Check that the player controls the region
        (address regionController, bool contested) = LibDungeon._getRegionController(region);
        require(regionController == player, "Player is not the region controller.");
        require(!contested, "The region is contested.");

        // 2.1) Check that all tiles are mined
        // 2.2) Check that all tiles are owned by the player
        // 2.3) Check that all upgrades are the same
        _checkPathTiles(tiles, player, true, true, true, false, false);

        // 3) Check that all tiles are connected in a cluster
        _checkConnection(tiles);

        // 4) Harvest the tiles
        uint256[] memory uniqueTiles = LibUtils.getUniqueEntries(tiles);
        LibUpgrade._harvestTiles(uniqueTiles, s.tiles[tiles[0]].upgrade);
    }

    /// @notice Performs checks to ensure tiles a player desires to upgrade is upgradeable by them,
    /// then calles LibDungeon.upgradeTile to actually upgrade the tile if all checks pass.
    /// @param tileId Id of the tile to upgrade.
    /// @param upgrade Type of upgrade.
    function upgradeTile(uint256 tileId, LibTypes.TileUpgrade upgrade) external onlyInitialized notPaused {
        address player = __msgSender();

        // 0) Check that the tile is mined
        require(s.tiles[tileId].isMined, "Tile is not mined yet.");
        // 1) Check that the tile is owned by the player
        require(s.tiles[tileId].owner == player, "Player does not own the tile.");
        // 2) Check that the region is controlled by the player
        (address regionController, bool contested) = LibDungeon._getRegionController(
            LibUtils.tileIdToRegionId(tileId, s.REGION_LENGTH)
        );
        require(regionController == player, "Player is not the region controller.");
        require(!contested, "The region is contested.");
        // 3) Check that the tile is not upgraded yet
        require(s.tiles[tileId].upgrade == LibTypes.TileUpgrade.NONE, "Tile is already upgraded.");
        // 4) Charge the player
        LibUpgrade._chargePlayerForUpgradeAndInitHarvestTimestamp(tileId, upgrade);
        LibMana.chargeManaForAction(LibTypes.ActionType.UPGRADE);
        // 5) Upgrade tile
        LibDungeon._upgradeTile(tileId, player, upgrade);
    }

    /// @notice Claim the resources found in a region owned by the player.
    /// @param regionId Id of the region to claim.
    function claimResourcesOnRegion(uint256 regionId) external onlyInitialized notPaused {
        address player = __msgSender();
        // 0) Check that the region is controlled by the player
        (address regionController, bool contested) = LibDungeon._getRegionController(regionId);
        require(regionController == player, "Player is not the region controller.");
        require(!contested, "The region is contested.");
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

    /*///////////////////////////////////////////////////////////////
                            DELAYED ACTIONS
    //////////////////////////////////////////////////////////////*/

    /*///////////////////////////////////////////////////////////////
                            TILE WALLING ACTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Initiates the walling of a tile.
    /// @param tileId Id of the tile to wall.
    /// @dev This function performs checks first, then calls LibDungeon._initiateWallTile
    /// to actually initiate the walling.
    function initiateWallTile(uint256 tileId) external onlyInitialized notPaused {
        address player = __msgSender();
        // 0) Check that the tile is mined
        require(s.tiles[tileId].isMined, "Tile is not mined yet.");
        // 1) Check that the tile is owned by the player
        require(s.tiles[tileId].owner == player, "Player does not own the tile.");
        // 2) Check that the region is controlled by the player
        (address regionController, bool contested) = LibDungeon._getRegionController(
            LibUtils.tileIdToRegionId(tileId, s.REGION_LENGTH)
        );
        require(regionController == player, "Player is not the region controller.");
        require(!contested, "The region is contested.");
        // 3) Check that the tile is not walled yet
        require(!s.tiles[tileId].isWalled, "Tile is already walled.");
        // 4) check that the tile has no upgrade
        require(s.tiles[tileId].upgrade == LibTypes.TileUpgrade.NONE, "Tile is already upgraded.");
        // 5) Check that the player has enough gold and charge them
        LibTypes.Player storage playerData = s.players[player];
        require(playerData.gold >= s.gameConstants.WALL_PRICE, "Not enough funds.");
        playerData.gold -= s.gameConstants.WALL_PRICE;
        // 5) Initiate
        LibDungeon._initiateWallTile(tileId);
        emit PlayerUpdated(player, s.players[player]);
    }

    /// @notice Completes the walling of a tile.
    /// @param tileId Id of the tile to wall.
    /// @dev This function performs checks first, then calls LibDungeon._completeWallTile
    /// to actually complete the walling.
    function completeWallTile(uint256 tileId) external onlyInitialized notPaused {
        address player = __msgSender();
        // 0) Check that the tile is mined
        require(s.tiles[tileId].isMined, "Tile is not mined yet.");
        // 1) Check that the tile is owned by the player
        require(s.tiles[tileId].owner == player, "Player does not own the tile.");
        // 2) Check that the region is controlled by the player
        (address regionController, bool contested) = LibDungeon._getRegionController(
            LibUtils.tileIdToRegionId(tileId, s.REGION_LENGTH)
        );
        require(regionController == player, "Player is not the region controller.");
        require(!contested, "The region is contested.");
        // 4) check that the tile has no upgrade
        require(s.tiles[tileId].upgrade == LibTypes.TileUpgrade.NONE, "Tile is already upgraded.");
        // 5) Complete
        LibDungeon._completeWallTile(tileId, true);
    }

    /*///////////////////////////////////////////////////////////////
                            TILE UNWALL ACTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Initiates the unwalling of a tile.
    /// @param packedPath Array of tile id's to unwall. TODO: why is this an array and the TILE WALL actions have a single tileId?
    /// @dev This function performs checks first, then calls LibDungeon._initiateUnwallTile
    /// if the checks passed to actually initiate unwalling the tile(s).
    function initiateUnwallTile(uint256[] calldata packedPath) external onlyInitialized notPaused {
        address player = __msgSender();

        uint256[] memory path = LibUtils.unpackCoordListToIds(packedPath);
        uint256 minedTile = path[path.length - 1];

        // 0) Check max path length
        require(path.length <= 20, "Path is longer than 20 tiles.");

        // 1) Check that the tile is a wall
        require(s.tiles[minedTile].isWalled, "This tile is not a wall.");

        // 2.1) Check that all tiles are mined
        // 2.2) Check that path is connected
        _checkPathTiles(path, player, false, false, false, true, true);

        // 5) Check that the player controls the fromRegion
        uint256 fromRegion = LibUtils.tileIdToRegionId(path[0], s.REGION_LENGTH);
        (address regionController, bool contested) = LibDungeon._getRegionController(fromRegion);
        require(regionController == player, "Player is not the region controller.");
        require(!contested, "The region is contested.");

        // 6) Check that the from and to regions are adjacent or the same
        uint256 toRegion = LibUtils.tileIdToRegionId(minedTile, s.REGION_LENGTH);
        require(
            LibUtils.chebyshev(LibUtils.idToCoord(fromRegion), LibUtils.idToCoord(toRegion)) <= 1,
            "Player does not control adjacent region."
        );

        LibDungeon._initiateUnwallTile(minedTile);
    }

    /// @notice Completes the unwalling of a tile.
    /// @param packedPath Array of tile id's to unwall.
    /// @dev This function performs checks first, then calls LibDungeon._completeUnwallTile
    /// if the checks passed to actually complete unwalling the tile(s).
    function completeUnwallTile(uint256[] calldata packedPath) external onlyInitialized notPaused {
        address player = __msgSender();

        uint256[] memory path = LibUtils.unpackCoordListToIds(packedPath);
        uint256 minedTile = path[path.length - 1];

        // 0) Check max path length
        require(path.length <= 20, "Path is longer than 20 tiles.");

        // 1) Check that the tile is a wall
        require(s.tiles[minedTile].isWalled, "This tile is not a wall.");

        // 2.1) Check that all tiles are mined
        // 2.2) Check that path is connected
        _checkPathTiles(path, player, false, false, false, true, true);

        // 3) Check that the player control the fromRegion
        uint256 fromRegion = LibUtils.tileIdToRegionId(path[0], s.REGION_LENGTH);
        (address fromRegionController, bool fromRegionContested) = LibDungeon._getRegionController(fromRegion);
        require(fromRegionController == player, "Player is not the region controller.");
        require(!fromRegionContested, "The region is contested.");

        // 6) Check that the from and to regions are adjacent or the same
        uint256 toRegion = LibUtils.tileIdToRegionId(minedTile, s.REGION_LENGTH);
        require(
            LibUtils.chebyshev(LibUtils.idToCoord(fromRegion), LibUtils.idToCoord(toRegion)) <= 1,
            "Player does not control adjacent region."
        );

        (address toRegionController, bool toRegionContested) = LibDungeon._getRegionController(toRegion);
        LibDungeon._completeUnwallTile(minedTile, player == toRegionController && !toRegionContested);
    }

    /*///////////////////////////////////////////////////////////////
                        FORCE MINE TILE ACTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Initiates the force mining of a tile.
    /// @param packedPath Array of tile id's to force mine.
    /// @dev This function performs the required checks for the initiate force mine tile action then calls
    /// LibDungeon._initiateForceMineTile to actually initiate the force mine tile action.
    function initiateForceMineTile(uint256[] calldata packedPath) external onlyInitialized notPaused {
        address player = __msgSender();

        uint256[] memory path = LibUtils.unpackCoordListToIds(packedPath);
        uint256 minedTile = path[path.length - 1];

        // 0) Check max path length
        require(path.length <= 20, "Path is longer than 20 tiles.");

        // 1) Check that mined tile is in range
        LibChecks.requireInBounds(LibUtils.idToCoord(minedTile));

        // 2) Check that the mined tile has not been mined yet
        require(!s.tiles[minedTile].isMined, "This tile has already been mined!");

        // 3.1) Check that all tiles are mined
        // 3.2) Check that the path is connected
        _checkPathTiles(path, player, false, false, false, true, true);

        // 4) Check that the player control the fromRegion
        uint256 fromRegion = LibUtils.tileIdToRegionId(path[0], s.REGION_LENGTH);
        (address regionController, bool contested) = LibDungeon._getRegionController(fromRegion);
        require(regionController == player, "Player is not the region controller.");
        require(!contested, "The region is contested.");

        // 6) Check that the from and to regions are adjacent or the same
        uint256 toRegion = LibUtils.tileIdToRegionId(minedTile, s.REGION_LENGTH);
        require(
            LibUtils.chebyshev(LibUtils.idToCoord(fromRegion), LibUtils.idToCoord(toRegion)) <= 1,
            "Player does not control adjacent region."
        );

        LibDungeon._initiateForceMineTile(minedTile);
    }

    /// @notice Completes the force mining of a tile.
    /// @param packedPath Array of tile id's to force mine.
    /// @dev This function performs the required checks for the complete force mine tile action then calls
    /// LibDungeon._completeForceMineTile to actually complete the force mine tile action.
    function completeForceMineTile(uint256[] calldata packedPath) external onlyInitialized notPaused {
        address player = __msgSender();

        uint256[] memory path = LibUtils.unpackCoordListToIds(packedPath);
        uint256 minedTile = path[path.length - 1];

        // 2) Check max path length
        require(path.length <= 20, "Path is longer than 20 tiles.");

        // 2) Check that mined tile is in range
        LibChecks.requireInBounds(LibUtils.idToCoord(minedTile));

        // 3) Check that the mined tile has not been mined yet
        require(!s.tiles[minedTile].isMined, "This tile has already been mined.");

        // 3.1) Check that all tiles are mined
        // 3.2) Check that the path is connected
        _checkPathTiles(path, player, false, false, false, true, true);

        // 5) Check that the player control the fromRegion
        uint256 toRegion = LibUtils.tileIdToRegionId(minedTile, s.REGION_LENGTH);
        uint256 fromRegion = LibUtils.tileIdToRegionId(path[0], s.REGION_LENGTH);

        // 6) Check that the from and to regions are adjacent or the same
        require(
            LibUtils.chebyshev(LibUtils.idToCoord(fromRegion), LibUtils.idToCoord(toRegion)) <= 1,
            "Player does not control adjacent region."
        );

        {
            (address fromRegionController, bool fromRegionContested) = LibDungeon._getRegionController(fromRegion);
            require(fromRegionController == player, "Player is not the region controller.");
            require(!fromRegionContested, "The region is contested.");

            (address toRegionController, bool toRegionContested) = LibDungeon._getRegionController(toRegion);
            LibDungeon._completeForceMineTile(minedTile, toRegionController == player && !toRegionContested);
        }
    }

    /// @dev Packed struct of variables useful for force mining resource tiles.
    /// @param key TODO: please describe
    /// @param scale TODO: please describe
    /// @param perlinValue TODO: please describe
    /// @param minedTileId Id of the tile that is being mined.
    /// @param toRegion Region id of the tile that is being mined.
    /// @param fromRegion Region id that the player is mining from.
    struct ForceMineResourceTileVars {
        uint32 key;
        uint32 scale;
        uint256 perlinValue;
        uint256 minedTileId;
        uint256 toRegion;
        uint256 fromRegion;
    }

    /// @notice Completes the force mining of a resource tile.
    /// @param resourceType Type of resource being mined.
    /// @param packedPath Array of tile id's to force mine.
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
        require(path.length <= 20, "Path is longer than 20 tiles.");

        // 2) Check that mined tile is in range
        LibChecks.requireInBounds(minedTile);

        // 3) Check that the mined tile has not been mined yet
        vars.minedTileId = LibUtils.coordToId(minedTile);
        require(!s.tiles[vars.minedTileId].isMined, "This tile has already been mined.");

        // 3.1) Check that all tiles are mined
        // 3.2) Check that the path is connected
        uint256[] memory pathOfIds = LibUtils.unpackCoordListToIds(packedPath);
        _checkPathTiles(pathOfIds, player, false, false, false, true, true);

        // 5) Check that the player control the fromRegion
        vars.toRegion = LibUtils.tileIdToRegionId(vars.minedTileId, s.REGION_LENGTH);
        vars.fromRegion = LibUtils.tileIdToRegionId(pathOfIds[0], s.REGION_LENGTH);

        // 6) Check that the from and to regions are adjacent or the same
        require(
            LibUtils.chebyshev(LibUtils.idToCoord(vars.fromRegion), LibUtils.idToCoord(vars.toRegion)) <= 1,
            "Player does not control adjacent region."
        );

        {
            (address fromRegionController, bool fromRegionContested) = LibDungeon._getRegionController(vars.fromRegion);
            require(fromRegionController == player, "Player is not the region controller.");
            require(!fromRegionContested, "The region is contested.");

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
