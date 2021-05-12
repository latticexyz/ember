// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import "./libraries/LibAppStorage.sol";
import "./libraries/LibTypes.sol";
import "./libraries/LibDungeon.sol";
import "./libraries/LibCreatures.sol";
import "./libraries/LibChecks.sol";

/// @title Creatures Facet
/// @notice EIP-2535 Facet for the Creatures in Ember.
contract CreaturesFacet {
    AppStorage internal s;

    /*///////////////////////////////////////////////////////////////
                                EVENTS
    //////////////////////////////////////////////////////////////*/

    /// @notice Emitted when a region is updated.
    /// @param region Region id of the region that was updated.
    /// @param data The new LibTypes.Region data of the region that was updated.
    event RegionUpdated(uint256 region, LibTypes.Region data);

    /// @notice Emitted when a creature is moved.
    /// @param creatureId Id of the creature that was moved.
    /// @param data The LibTypes.Creature data of the creature that was moved.
    /// @param fromRegionId Id of the region the creature was moved from.
    /// @param toRegionId Id of the region the creature was moved to.
    event CreatureMovedToRegion(uint256 creatureId, LibTypes.Creature data, uint256 fromRegionId, uint256 toRegionId);

    /// @notice Emitted when a creature dies.
    /// @param creatureId Id of the creature that died.
    /// @param regionId Id of the region where the creatures died.
    event CreatureDied(uint256 creatureId, uint256 regionId);

    /// @notice Emitted when a creature is updated. This can happen after a combat or when a LAIR is used to heal creatures
    /// @param creatureId Id of the creature that was updated.
    /// @param regionId Id of the region where the creature was updated.
    /// @param data The new LibTypes.Creature data of the creature that was updated.
    event CreatureUpdated(uint256 creatureId, uint256 regionId, LibTypes.Creature data);

    /// @notice Emitted when a player is updated.
    /// @param player Address of the player that is updated.
    /// @param data The new LibTypes.Player data of the player that was updated.
    event PlayerUpdated(address player, LibTypes.Player data);

    /// @notice Emitted when combat is started.
    /// @param squad1 LibTypes.Creatures[] array of the first squad of creatures in the combat.
    /// @param squad2 LibTypes.Creatures[] array of the second squad of creatures in the combat.
    /// @param trace A list of rounds, each with a LibTypes.RoundTrace struct. This tract is used to replay the combat off-chain.
    /// @param winner Winner of the combat, could be squad1, squad2, or a draw.
    /// @param soulsDropped The amount of souls that have been dropped on the ground at the env of the combat
    /// @param regionId Id of the region where the combat took place.
    event Combat(
        LibTypes.Creature[] squad1,
        LibTypes.Creature[] squad2,
        LibTypes.RoundTrace[] trace,
        LibTypes.CombatWinner winner,
        uint256 soulsDropped,
        uint256 regionId
    );

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
    /// @dev The game can be paused in an emergency (to upgrade the facets)
    modifier notPaused() {
        require(!s.isPaused, "Game is paused.");
        _;
    }

    /*///////////////////////////////////////////////////////////////
                            INTERNAL FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Checks if a given path is valid according to the context of the game and player.
    /// @param path The path to check.
    /// @param player The player to check the path for.
    function _checkPathTiles(uint256[] memory path, address player) internal view {
        LibTypes.Coord memory startRegionCoord = LibUtils.idToCoord(
            LibUtils.tileIdToRegionId(path[0], s.REGION_LENGTH)
        );

        for (uint256 i = 0; i < path.length; i++) {
            // 0) Check that path is connected
            if (i > 0) {
                require(
                    LibUtils.manhattan(LibUtils.idToCoord(path[i - 1]), LibUtils.idToCoord(path[i])) == 1,
                    "Tiles are not connected."
                );
            }

            // 1) Check that the tile is within the max bounds
            LibChecks.requireInBounds(LibUtils.idToCoord(path[i]));

            // 2) Check all tiles are mined
            require(s.tiles[path[i]].isMined, "One tile in the path is not mined.");

            // 3) Check no tiles are walled by another player
            require(
                !s.tiles[path[i]].isWalled || s.tiles[path[i]].owner == player,
                "One tile in the path is walled by another player."
            );

            // 4) Check all tiles are within CREATURES_MAX_REGION_DISTANCE_FOR_MOVE
            uint256 region = LibUtils.tileIdToRegionId(path[i], s.REGION_LENGTH);
            require(
                LibUtils.manhattan(LibUtils.idToCoord(region), startRegionCoord) <=
                    s.gameConstants.CREATURES_MAX_REGION_DISTANCE_FOR_MOVE,
                "Path includes region outside CREATURES_MAX_REGION_DISTANCE_FOR_MOVE."
            );
        }
    }

    /// @notice Used to process the death of the losing party in combat and update the influence after combat.
    /// @param creatureIds The ids of all creatures engaged in combat
    /// @param newSquad an array of LibTypes.Creature[] with the new state of those creatures after combat
    /// @param enemyPlayer the player that was attacked (owner of the creatures in the newSquad array)
    /// @param regionId Region id of the region where the combat took place.
    /// @return soulsDropped The number of souls dropped by the losing party.
    function _processDeathAndInfluenceChangeForEnemyAfterCombat(
        uint256[] memory creatureIds,
        LibTypes.Creature[] memory newSquad,
        address enemyPlayer,
        uint256 regionId
    ) internal returns (uint256 soulsDropped) {
        for (uint256 i = 0; i < newSquad.length; i++) {
            uint256 creatureId = creatureIds[i];
            s.creatures[creatureId] = newSquad[i];
            if (newSquad[i].life == 0) {
                int256 influenceLostInRegion = -int256(
                    s.gameConstants.CREATURES_INFLUENCE_PER_SPECIES_AND_LEVEL[uint256(newSquad[i].species)][
                        uint256(newSquad[i].level)
                    ]
                );
                LibDungeon._modifyInfluenceOfPlayerInRegion(regionId, enemyPlayer, influenceLostInRegion);
                // remove creature from region
                LibCreatures._removeCreatureFromRegion(regionId, creatureId);
                // increase soulsDropped
                soulsDropped += s.gameConstants.CREATURES_PRICE[uint256(newSquad[i].species)][
                    uint256(newSquad[i].creatureType)
                ][uint256(LibTypes.Resource.SOULS)];
                LibCreatures._killCreature(creatureId, newSquad[i], regionId, false);
            } else {
                emit CreatureUpdated(creatureId, regionId, s.creatures[creatureId]);
            }
        }
    }

    /// @notice Returns an array of creatures that are alive given an array of creature ids.
    /// @param creatureIds The ids of the creatures to check.
    /// @return aliveCreatures An array of creature ids of the creatures that are alive,
    /// aliveCreatureIds An array of the ids of the creatures that are alive.
    function _getAliveCreaturesFromIds(uint256[] memory creatureIds)
        internal
        view
        returns (LibTypes.Creature[] memory aliveCreatures, uint256[] memory aliveCreatureIds)
    {
        uint256[] memory tempAliveCreatureIds = new uint256[](creatureIds.length);
        uint256 alive;
        for (uint256 i = 0; i < creatureIds.length; i++) {
            if (s.creatures[creatureIds[i]].life > 0) {
                tempAliveCreatureIds[alive] = creatureIds[i];
                alive++;
            }
        }
        aliveCreatures = new LibTypes.Creature[](alive);
        aliveCreatureIds = new uint256[](alive);

        for (uint256 i = 0; i < alive; i++) {
            aliveCreatureIds[i] = tempAliveCreatureIds[i];
            aliveCreatures[i] = s.creatures[tempAliveCreatureIds[i]];
        }
    }

    /// @notice Returns creatures, creature ids, and address of the enemy player given the region id.
    /// @param regionId The region id to check.
    /// @return creatureIds An array of the enemy's creatures' ids,
    /// squad A LibTypes.Creature[] array of the enemy's creatures,
    /// enemyPlayer The address of the enemy player.
    function _getEnemySquadFromRegion(uint256 regionId)
        internal
        view
        returns (
            uint256[] memory creatureIds,
            LibTypes.Creature[] memory squad,
            address enemyPlayer
        )
    {
        enemyPlayer = s.creatures[s.regions[regionId].creatures[0]].owner;
        uint256[] memory enemyCreatureIds = new uint256[](s.regions[regionId].creatures.length);
        for (uint256 i = 0; i < s.regions[regionId].creatures.length; i++) {
            enemyCreatureIds[i] = s.regions[regionId].creatures[i];
        }
        LibTypes.Creature[] memory enemySquad = new LibTypes.Creature[](enemyCreatureIds.length);
        for (uint256 i = 0; i < enemyCreatureIds.length; i++) {
            enemySquad[i] = s.creatures[enemyCreatureIds[i]];
        }
        creatureIds = enemyCreatureIds;
        squad = enemySquad;
    }

    /// @notice When spawning a creature in a region that is occupied by the enemy creatures, we need to run a combat atomically
    /// @param player Address of the relevant player.
    /// @param creature the creature spawned
    /// @param regionId the id of the region where this combat happens
    /// @return shouldSpawn whether we should complete the spawn, creatureAfterCombat: the state of the creature after the combat
    /// creatureAfterCombat the state of the spawned creature after the combat
    function _runCombatInRegionOfSpawnForPlayer(
        address player,
        LibTypes.Creature memory creature,
        uint256 regionId
    ) internal returns (bool shouldSpawn, LibTypes.Creature memory creatureAfterCombat) {
        (
            uint256[] memory enemyCreatureIds,
            LibTypes.Creature[] memory enemySquad,
            address enemyPlayer
        ) = _getEnemySquadFromRegion(regionId);
        require(player != enemyPlayer, "Cannot fight against yourself.");
        LibTypes.Creature[] memory playerSquad = new LibTypes.Creature[](1);
        playerSquad[0] = creature;

        // trigger combat
        LibTypes.RoundTrace[] memory trace;
        LibTypes.CombatWinner winner;
        // we'll progressively increment this var as we find dead creatures
        uint256 soulsDropped = 0;
        {
            LibTypes.Creature[] memory newEnemySquad;
            LibTypes.Creature[] memory newPlayerSquad;

            (trace, winner, newEnemySquad, newPlayerSquad) = LibCreatures._runCombat(enemySquad, playerSquad);
            creatureAfterCombat = newPlayerSquad[0];

            if (winner == LibTypes.CombatWinner.SQUAD2) {
                shouldSpawn = true;
            } else {
                shouldSpawn = false;
            }

            // write the changes of enemySquad to storage
            // decrease influence of the defenser for all creatures that are dead are remove from region
            soulsDropped += _processDeathAndInfluenceChangeForEnemyAfterCombat(
                enemyCreatureIds,
                newEnemySquad,
                enemyPlayer,
                regionId
            );
        }
        // increase souls dropped if the only creature is dead
        if (winner == LibTypes.CombatWinner.SQUAD1) {
            soulsDropped += s.gameConstants.CREATURES_PRICE[uint256(creature.species)][uint256(creature.creatureType)][
                uint256(LibTypes.Resource.SOULS)
            ];
        }

        if (winner == LibTypes.CombatWinner.SQUAD1) {
            LibUpgrade._modifyResourceOfPlayer(enemyPlayer, int256(soulsDropped), regionId, LibTypes.Resource.SOULS);
        } else {
            LibUpgrade._modifyResourceOfPlayer(player, int256(soulsDropped), regionId, LibTypes.Resource.SOULS);
        }

        // The combat is run in reverse, that means we need to emit the winner in reverse
        trace = _swapTraceSquads(trace);
        if (winner == LibTypes.CombatWinner.SQUAD1) {
            emit Combat(playerSquad, enemySquad, trace, LibTypes.CombatWinner.SQUAD2, soulsDropped, regionId);
        } else if (winner == LibTypes.CombatWinner.SQUAD2) {
            emit Combat(playerSquad, enemySquad, trace, LibTypes.CombatWinner.SQUAD1, soulsDropped, regionId);
        } else {
            emit Combat(playerSquad, enemySquad, trace, LibTypes.CombatWinner.DRAW, soulsDropped, regionId);
        }
    }

    /// @notice This runs a complete combat in a region for a player (the attacker)
    /// @param player Address of the attacking playuer
    /// @param creatureIds The ids of the attacking creatures owned by the attacking player
    /// @param playerSquad An array of Creature corresponding to the ids in the creatureIds array
    /// @param uniquePathTiles The path sent from the client. It is meant to include all enemy creatures in that region.
    /// This function will check that each enemy creatures in the region is present on the path.
    /// @param regionId The id of the region where the combat happens
    /// @return winner a CombatWinner enum
    function _runCombatInRegionForPlayer(
        address player,
        uint256[] memory creatureIds,
        LibTypes.Creature[] memory playerSquad,
        uint256[] memory uniquePathTiles,
        uint256 regionId
    ) internal returns (LibTypes.CombatWinner winner) {
        (
            uint256[] memory enemyCreatureIds,
            LibTypes.Creature[] memory enemySquad,
            address enemyPlayer
        ) = _getEnemySquadFromRegion(regionId);
        for (uint256 i = 0; i < enemyCreatureIds.length; i++) {
            // check that all enemy creatures are on the path
            {
                bool found = false;
                for (uint256 j = 0; j < uniquePathTiles.length; j++) {
                    if (enemySquad[i].tileId == uniquePathTiles[j]) {
                        found = true;
                    }
                }
                require(found, "Enemy creature in regionId not found on path.");
            }
        }

        // trigger combat
        LibTypes.RoundTrace[] memory trace;
        LibTypes.Creature[] memory newPlayerSquad;
        LibTypes.Creature[] memory newEnemySquad;
        (trace, winner, newPlayerSquad, newEnemySquad) = LibCreatures._runCombat(playerSquad, enemySquad);

        uint256 soulsDropped = 0;

        // we'll progressively increment this var as we find dead creatures
        // write the changes of playerSquad to storage
        for (uint256 i = 0; i < newPlayerSquad.length; i++) {
            s.creatures[creatureIds[i]] = newPlayerSquad[i];
            // increase souls dropped if creature is dead
            if (newPlayerSquad[i].life == 0) {
                soulsDropped += s.gameConstants.CREATURES_PRICE[uint256(playerSquad[i].species)][
                    uint256(playerSquad[i].creatureType)
                ][uint256(LibTypes.Resource.SOULS)];
            }
        }

        // write the changes of enemySquad to storage
        // decrease influence of the defenser for all creatures that are dead are remove from region
        soulsDropped += _processDeathAndInfluenceChangeForEnemyAfterCombat(
            enemyCreatureIds,
            newEnemySquad,
            enemyPlayer,
            regionId
        );

        // If attacker wins, he gets souls, in case of draw or defender win defender gets them
        if (winner == LibTypes.CombatWinner.SQUAD1) {
            LibUpgrade._modifyResourceOfPlayer(player, int256(soulsDropped), regionId, LibTypes.Resource.SOULS);
        } else {
            LibUpgrade._modifyResourceOfPlayer(enemyPlayer, int256(soulsDropped), regionId, LibTypes.Resource.SOULS);
        }
        emit Combat(playerSquad, enemySquad, trace, winner, soulsDropped, regionId);
    }

    /// @notice This function runs at the end of a combat. It moves the attacking squad to a region and updates the attacking player's influence
    /// in the region where their creatures moved to
    /// @param creatureIds The ids of the attacking creatures owned by the attacking player
    /// @param playerSquad An array of Creature corresponding to the ids in the creatureIds array
    /// @param player The address of the attacking player
    /// @param fromRegion the region id of the region the creaturea were moving from
    /// @param toRegion the region if of the region the creatures are moving to
    /// @param path a path (list of tile ids) the creatures are taking
    /// @param playerWon whether the attacking player won the combat. This is needed when a draw happens and the attacking player needs to retreat
    function _updateCreaturesOfPlayerInRegion(
        uint256[] memory creatureIds,
        LibTypes.Creature[] memory playerSquad,
        address player,
        uint256 fromRegion,
        uint256 toRegion,
        uint256[] memory path,
        bool playerWon
    ) internal {
        // Figure out last region visited to retreat to.
        uint256 lastTileId = path[path.length - 1];
        if (!playerWon) {
            uint256 lastRegionId = LibUtils.tileIdToRegionId(lastTileId, s.REGION_LENGTH);
            for (uint256 i = path.length - 1; i >= 0; i--) {
                uint256 currentRegionId = LibUtils.tileIdToRegionId(path[i], s.REGION_LENGTH);
                if (currentRegionId != lastRegionId) {
                    lastTileId = path[i];
                    break;
                }
            }

            toRegion = LibUtils.tileIdToRegionId(lastTileId, s.REGION_LENGTH);
        }

        for (uint256 i = 0; i < creatureIds.length; i++) {
            if (s.creatures[creatureIds[i]].life > 0) {
                s.regions[toRegion].creatures.push(creatureIds[i]);
                s.creatures[creatureIds[i]].tileId = lastTileId;
                emit CreatureMovedToRegion(creatureIds[i], s.creatures[creatureIds[i]], fromRegion, toRegion);
                // we read the level from storage here because it might have been changed at the end of combat (level up)
                int256 influenceAddedInRegion = int256(
                    s.gameConstants.CREATURES_INFLUENCE_PER_SPECIES_AND_LEVEL[uint256(playerSquad[i].species)][
                        s.creatures[creatureIds[i]].level
                    ]
                );
                LibDungeon._modifyInfluenceOfPlayerInRegion(toRegion, player, influenceAddedInRegion);
            } else {
                LibCreatures._killCreature(creatureIds[i], s.creatures[creatureIds[i]], fromRegion, false);
            }
        }
    }

    /// @notice Swap the two squads in a combat trace
    /// @param trace the RoundTrace[] whose squads we are swapping
    /// @return newTrace a new RoundTrace[] with the squads swapped
    function _swapTraceSquads(LibTypes.RoundTrace[] memory trace)
        internal
        pure
        returns (LibTypes.RoundTrace[] memory newTrace)
    {
        LibTypes.CombatAtomicTrace[] memory tempTrace;
        for (uint256 i = 0; i < trace.length; i++) {
            tempTrace = trace[i].squad1Trace;
            trace[i].squad1Trace = trace[i].squad2Trace;
            trace[i].squad2Trace = tempTrace;
        }

        newTrace = trace;
    }

    /*///////////////////////////////////////////////////////////////
                        CREATURES FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Spawns a creature of a specified species and type.
    /// @param summonTileId Tile id where the creature will be spawned.
    /// @param species LibTypes.CreatureSpecies of the creature to spawn.
    /// @param creatureType LibTypes.CreatureType of the creature to spawn.
    function spawnCreature(
        uint256 summonTileId,
        LibTypes.CreatureSpecies species,
        LibTypes.CreatureType creatureType
    ) external onlyInitialized notPaused {
        address player = __msgSender();
        uint256 region = LibUtils.tileIdToRegionId(summonTileId, s.REGION_LENGTH);
        {
            LibTypes.Region storage regionData = s.regions[region];
            // 1) Check that the creature was spawned from a legal tile
            require(
                s.tiles[summonTileId].upgrade == LibTypes.TileUpgrade.DUNGEON_HEART,
                "Creature was not summoned from a valid tile."
            );
            // 2) Check that the summon tile is owned by the player
            require(s.tiles[summonTileId].owner == player, "Player does not own the summon tile.");
            // 3) Check that the summon region is controlled by the player
            (address summonRegionController, bool summonContested) = LibDungeon._getRegionController(region);
            require(summonRegionController == player, "Player is not the summon region controller.");
            require(!summonContested, "The summon region is contested.");
            // 4) Check the last spawn timestamp
            require(
                block.timestamp - regionData.lastSpawnTimestamp >=
                    s.gameConstants.CREATURES_MIN_SECOND_DELAY_BETWEEN_SPAWN,
                "Can't spawn yet. Need to wait CREATURES_MIN_SECOND_DELAY_BETWEEN_SPAWN between spawns."
            );
            regionData.lastSpawnTimestamp = uint32(block.timestamp);
            emit RegionUpdated(region, regionData);
        }
        // charge the player
        LibCreatures._chargePlayerForCreature(species, creatureType, player, false);
        LibTypes.Creature memory creature = LibCreatures._createCreature(summonTileId, species, creatureType, player);
        // run a combat if enemy creatures can be found there
        bool shouldSpawn = true;
        if (s.regions[region].creatures.length > 0 && s.creatures[s.regions[region].creatures[0]].owner != player) {
            (shouldSpawn, creature) = _runCombatInRegionOfSpawnForPlayer(player, creature, region);
        }
        LibTypes.Player storage playerData = s.players[player];
        // if won or no combat, spawn the creature
        if (shouldSpawn) {
            LibCreatures._spawnCreature(creature);
            // check that we don't end up with more than 8 creatures at the end of the spawn
            require(s.regions[region].creatures.length <= 8, "More than 8 creatures in the region after spawn/combat.");
        } else {
            playerData.population -= 1;
        }
        emit PlayerUpdated(player, playerData);
    }

    /// @notice Moves creatures to another location.
    /// @param packedPath A packed path that includes all creatures being moved, and all creatures being attacked (if the player is attacking another)
    /// @param creatureIds Ids of creatures to move.
    function moveCreatures(uint256[] calldata packedPath, uint256[] calldata creatureIds)
        external
        onlyInitialized
        notPaused
    {
        address player = __msgSender();

        uint256[] memory path = LibUtils.unpackCoordListToIds(packedPath);

        // 1) Check path length
        require(path.length <= 64, "Path is too long.");

        // 2) Check squad size
        require(creatureIds.length > 0 && creatureIds.length <= 8, "Invalid squad size.");

        // 3) Check that creature move is not within the same region
        uint256 fromRegion = LibUtils.tileIdToRegionId(path[0], s.REGION_LENGTH);
        uint256 toRegion = LibUtils.tileIdToRegionId(path[path.length - 1], s.REGION_LENGTH);
        require(fromRegion != toRegion, "Cannot move to same region.");

        // 4.1) Check the path is connected
        // 4.2) Check all times are within max bounds
        // 4.3) Check all tiles are mined
        // 4.4) Check no tiles are walled by another player
        // 4.5) Check all tiles are within CREATURES_MAX_REGION_DISTANCE_FOR_MOVE
        _checkPathTiles(path, player);

        // 5) Check that we are only moving creatures on the path and decrease influence
        LibTypes.Creature[] memory squad1 = new LibTypes.Creature[](creatureIds.length);
        for (uint256 i = 0; i < creatureIds.length; i++) {
            // Check for repetitions
            for (uint256 j = 0; j < i; j++) {
                require(creatureIds[i] != creatureIds[j], "No repetitions allowed in the creatureIds arg.");
            }
            squad1[i] = s.creatures[creatureIds[i]];
            // Check ownership
            require(squad1[i].owner == player, "Cannot move a creature you do not own.");
            // Check that the creature is located in the from region
            require(
                LibUtils.tileIdToRegionId(squad1[i].tileId, s.REGION_LENGTH) == fromRegion,
                "Cannot move creatures located outside the from region."
            );
            {
                // now check that creature is on the path
                bool found = false;
                for (uint256 j = 0; j < path.length; j++) {
                    if (path[j] == squad1[i].tileId) {
                        found = true;
                        break;
                    }
                }
                require(found, "Creature was not found on the path.");
            }
            {
                // decrease influence
                int256 influenceLostInFromRegion = -int256(
                    s.gameConstants.CREATURES_INFLUENCE_PER_SPECIES_AND_LEVEL[uint256(squad1[i].species)][
                        uint256(squad1[i].level)
                    ]
                );
                LibDungeon._modifyInfluenceOfPlayerInRegion(fromRegion, player, influenceLostInFromRegion);
            }
            // remove creature from region
            LibCreatures._removeCreatureFromRegion(fromRegion, creatureIds[i]);
            // TODO: stamina
        }

        // 3) Check if there are enemy creatures in the toRegion, if yes check that they are all in the path and trigger combat
        uint256[] memory uniquePathRegions;
        {
            uint256[] memory uniquePathTiles = LibUtils.getUniqueEntries(path);
            uint256[] memory pathRegions = new uint256[](uniquePathTiles.length);
            for (uint256 i = 0; i < uniquePathTiles.length; i++) {
                pathRegions[i] = LibUtils.tileIdToRegionId(uniquePathTiles[i], s.REGION_LENGTH);
            }

            uniquePathRegions = LibUtils.getUniqueEntries(pathRegions);
        }

        LibTypes.CombatWinner winner;
        for (uint256 i = 0; i < uniquePathRegions.length; i++) {
            uint256 region = uniquePathRegions[i];
            (LibTypes.Creature[] memory aliveCreatures, uint256[] memory aliveCreatureIds) = _getAliveCreaturesFromIds(
                creatureIds
            );
            if (
                aliveCreatures.length > 0 &&
                s.regions[region].creatures.length > 0 &&
                s.creatures[s.regions[region].creatures[0]].owner != player
            ) {
                address enemyPlayer = s.creatures[s.regions[region].creatures[0]].owner;
                winner = _runCombatInRegionForPlayer(player, aliveCreatureIds, aliveCreatures, path, region);
                LibTypes.Player storage enemyPlayerData = s.players[enemyPlayer];
                emit PlayerUpdated(enemyPlayer, enemyPlayerData);
            }
        }

        if (winner == LibTypes.CombatWinner.DRAW) {
            // 4a) Retreat creatures that are still alive and add influence back
            _updateCreaturesOfPlayerInRegion(creatureIds, squad1, player, fromRegion, toRegion, path, false);
        } else {
            // 4b) Move creatures that are still alive to the toRegion and increase influence
            _updateCreaturesOfPlayerInRegion(creatureIds, squad1, player, fromRegion, toRegion, path, true);
        }

        // require that no more than 8 creatures end up in the toRegion
        require(s.regions[toRegion].creatures.length <= 8, "More than 8 creatures in the toRegion after move/combat.");
        LibTypes.Player storage playerData = s.players[player];
        emit PlayerUpdated(player, playerData);
    }
}
