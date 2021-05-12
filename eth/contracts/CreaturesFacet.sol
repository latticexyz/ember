// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import "hardhat/console.sol";

import "./libraries/LibAppStorage.sol";
import "./libraries/LibTypes.sol";
import "./libraries/LibDungeon.sol";
import "./libraries/LibCreatures.sol";
import "./libraries/LibChecks.sol";

contract CreaturesFacet {
    AppStorage internal s;

    event RegionUpdated(uint256 region, LibTypes.Region data);
    event CreatureMovedToRegion(uint256 creatureId, LibTypes.Creature data, uint256 fromRegionId, uint256 toRegionId);
    event CreatureDied(uint256 creatureId, uint256 regionId);
    event CreatureUpdated(uint256 creatureId, uint256 regionId, LibTypes.Creature data);
    event PlayerUpdated(address player, LibTypes.Player data);
    // combat
    event Combat(
        LibTypes.Creature[] squad1,
        LibTypes.Creature[] squad2,
        LibTypes.RoundTrace[] trace,
        LibTypes.CombatWinner winner,
        uint256 soulsDropped,
        uint256 regionId
    );

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
        _;
    }

    //////////////////////
    /// INTERNAL FUNCTIONS
    //////////////////////

    function _checkPathTiles(uint256[] memory path, address player) internal view {
        LibTypes.Coord memory startRegionCoord = LibUtils.idToCoord(
            LibUtils.tileIdToRegionId(path[0], s.REGION_LENGTH)
        );

        for (uint256 i = 0; i < path.length; i++) {
            // 0) Check that path is connected
            if (i > 0) {
                require(
                    LibUtils.manhattan(LibUtils.idToCoord(path[i - 1]), LibUtils.idToCoord(path[i])) == 1,
                    "tiles are not connected"
                );
            }

            // 1) Check that the tile is within the max bounds
            LibChecks.requireInBounds(LibUtils.idToCoord(path[i]));

            // 2) Check all tiles are mined
            require(s.tiles[path[i]].isMined, "one tile in the path is not mined");

            // 3) Check no tiles are walled by another player
            require(
                !s.tiles[path[i]].isWalled || s.tiles[path[i]].owner == player,
                "one tile in the path is walled by another player"
            );

            // 4) Check all tiles are within CREATURES_MAX_REGION_DISTANCE_FOR_MOVE
            uint256 region = LibUtils.tileIdToRegionId(path[i], s.REGION_LENGTH);
            require(
                LibUtils.manhattan(LibUtils.idToCoord(region), startRegionCoord) <=
                    s.gameConstants.CREATURES_MAX_REGION_DISTANCE_FOR_MOVE,
                "path includes region outside CREATURES_MAX_REGION_DISTANCE_FOR_MOVE"
            );
        }
    }

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
        require(player != enemyPlayer, "cannot fight against yourself");
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
                require(found, "ennemy creature in regionId not found on path");
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

    function _updateCreaturesOfPlayerInRegion(
        uint256[] memory _creatureIds,
        LibTypes.Creature[] memory _playerSquad,
        address _player,
        uint256 _fromRegion,
        uint256 _toRegion,
        uint256[] memory _path,
        bool _playerWon
    ) internal {
        // Figure out last region visited to retreat to.
        uint256 lastTileId = _path[_path.length - 1];
        if (!_playerWon) {
            uint256 lastRegionId = LibUtils.tileIdToRegionId(lastTileId, s.REGION_LENGTH);
            for (uint256 i = _path.length - 1; i >= 0; i--) {
                uint256 currentRegionId = LibUtils.tileIdToRegionId(_path[i], s.REGION_LENGTH);
                if (currentRegionId != lastRegionId) {
                    console.log(lastTileId);
                    lastTileId = _path[i];
                    break;
                }
            }

            _toRegion = LibUtils.tileIdToRegionId(lastTileId, s.REGION_LENGTH);
        }

        for (uint256 i = 0; i < _creatureIds.length; i++) {
            if (s.creatures[_creatureIds[i]].life > 0) {
                s.regions[_toRegion].creatures.push(_creatureIds[i]);
                s.creatures[_creatureIds[i]].tileId = lastTileId;
                emit CreatureMovedToRegion(_creatureIds[i], s.creatures[_creatureIds[i]], _fromRegion, _toRegion);
                // we read the level from storage here because it might have been changed at the end of combat (level up)
                int256 influenceAddedInRegion = int256(
                    s.gameConstants.CREATURES_INFLUENCE_PER_SPECIES_AND_LEVEL[uint256(_playerSquad[i].species)][
                        s.creatures[_creatureIds[i]].level
                    ]
                );
                LibDungeon._modifyInfluenceOfPlayerInRegion(_toRegion, _player, influenceAddedInRegion);
            } else {
                LibCreatures._killCreature(_creatureIds[i], s.creatures[_creatureIds[i]], _fromRegion, false);
            }
        }
    }

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

    ///////////////
    //// Creatures
    //////////////

    function spawnCreature(
        uint256 _summonTileId,
        LibTypes.CreatureSpecies _species,
        LibTypes.CreatureType _type
    ) external onlyInitialized notPaused {
        address player = __msgSender();
        uint256 region = LibUtils.tileIdToRegionId(_summonTileId, s.REGION_LENGTH);
        {
            // 1) Check that the creature was spawned from a legal tile
            require(
                s.tiles[_summonTileId].upgrade == LibTypes.TileUpgrade.DUNGEON_HEART,
                "creature was not summoned from a valid tile"
            );
            // 2) Check that the summon tile is owned by the player
            require(s.tiles[_summonTileId].owner == player, "player does not own the summon tile");
            // 3) Check that the summon region is controlled by the player
            (address summonRegionController, bool summonContested) = LibDungeon._getRegionController(region);
            require(summonRegionController == player, "player is not the summon region controller");
            require(!summonContested, "the summon region is contested");
        }
        require(
            s.playersToNumberOfCreaturesWithSpecies[player][_species] <
                uint256(s.gameConstants.MAX_CREATURES_PER_SPECIES_AND_TYPES[uint256(_species)][uint256(_type)]),
            "too many creatures of that type"
        );
        // charge the player
        LibCreatures._chargePlayerForCreature(_species, _type, player, false);
        // charge the energy on the settlement
        // TODO: change this depending on the unit
        LibDungeon._chargePlayerForUpgrade(_summonTileId);
        // create the creature
        LibTypes.Creature memory creature = LibCreatures._createCreature(_summonTileId, _species, _type, player);
        // run a combat if ennemy creatures can be found there
        bool shouldSpawn = true;
        if (s.regions[region].creatures.length > 0 && s.creatures[s.regions[region].creatures[0]].owner != player) {
            (shouldSpawn, creature) = _runCombatInRegionOfSpawnForPlayer(player, creature, region);
        }
        LibTypes.Player storage playerData = s.players[player];
        // if won or no combat, spawn the creature
        if (shouldSpawn) {
            LibCreatures._spawnCreature(creature);
            // check that we don't end up with more than 8 creatures at the end of the spawn
            require(s.regions[region].creatures.length <= 8, "more than 8 creatures in the region after spawn/combat");
        } else {
            playerData.population -= 1;
        }
        emit PlayerUpdated(player, playerData);
    }

    function moveCreatures(uint256[] calldata packedPath, uint256[] calldata creatureIds)
        external
        onlyInitialized
        notPaused
    {
        address player = __msgSender();

        uint256[] memory path = LibUtils.unpackCoordListToIds(packedPath);

        // 1) Check path length
        require(path.length <= 64, "path is too long");

        // 2) Check squad size
        require(creatureIds.length > 0 && creatureIds.length <= 8, "invalid squad size");

        // 3) Check that creature move is not within the same region
        uint256 fromRegion = LibUtils.tileIdToRegionId(path[0], s.REGION_LENGTH);
        uint256 toRegion = LibUtils.tileIdToRegionId(path[path.length - 1], s.REGION_LENGTH);
        require(fromRegion != toRegion, "cannot move to same region");

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
                require(creatureIds[i] != creatureIds[j], "no repetitions allowed in the creatureIds arg");
            }
            squad1[i] = s.creatures[creatureIds[i]];
            // Check ownership
            require(squad1[i].owner == player, "cannot move a creature you do not own");
            // Check that the creature is located in the from region
            require(
                LibUtils.tileIdToRegionId(squad1[i].tileId, s.REGION_LENGTH) == fromRegion,
                "cannot move creatures located outside the from region"
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
                require(found, "creature was not found on the path");
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
        require(s.regions[toRegion].creatures.length <= 8, "more than 8 creatures in the toRegion after move/combat");
        LibTypes.Player storage playerData = s.players[player];
        emit PlayerUpdated(player, playerData);
    }
}
