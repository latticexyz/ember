// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import "./LibTypes.sol";
import "./LibMath.sol";
import "./LibAppStorage.sol";
import "./LibDungeon.sol";

/// @title Ember Creatures Library
/// @notice Contains helper functions for CreaturesFacet.sol.
library LibCreatures {
    /*///////////////////////////////////////////////////////////////
                    COMBAT STATE MACHINE DIAGRAM
    //////////////////////////////////////////////////////////////*/

    /**
                   ┌──────────────────────────────────────────────────────Increment Round Counter──────────────────────────────────────────────────────────────────────────┐
                   │                                                                                                                                                       │
                   │                                                                                                                                                       │
                   │                                                                                                                                                       │
                   │                                            ┌───────────────────────────────────┐                    ┌───────────────────────────────────┐             │
                   │                                            │        Defender Move Phase        │                    │        Attacker Move Phase        │             │
                   │                                            ├───────────────────────────────────┤                    ├───────────────────────────────────┤             │
                   │                                            │                                   │                    │                                   │             │
                   │                                            │ Note: [Defender] (creatures who   │                    │ Note: [Attacker] (creatures who   │             │
                   ▼                                            │ first occupies the region) moves  │                    │ moves into the region) moves      │             │
 ┌───────────────────────────────────┐                          │ first.                            │                    │ second.                           │             │
 │          Prepare Combat           │                          │                                   │                    │                                   │             │
 ├───────────────────────────────────┤                          │ Do: For every alive [Defender]'s  │                    │ Do: For every alive [Attacker]'s  │             │
 │                                   │                          │ creature, attack the [Attacker]'s │                    │ creature, attack the [Defender]'s │             │
 │ Check: [Attacker] & [Defender]    │                          │ creature that it is most          │                    │ creature that it is most          │             │
 │ both have at least one alive      │                          │ effective against.                │                    │ effective against.                │             │
 │ creature                          │─────If checks passes────▶│                                   │───────────────────▶│                                   │─────────────┘
 │                                   │                          │ Return:                           │                    │ Return:                           │
 │ Check: # of rounds below max      │                          │                                   │                    │                                   │
 │                                   │                          │ - combatAtomicTraces: Data of     │                    │ - combatAtomicTraces: Data of     │
 └───────────────────────────────────┘                          │ each creature attack move         │                    │ each creature attack move         │
                   │                                            │ - newDefenders: Post-combat       │                    │ - newDefenders: Post-combat       │
                   │                                            │ [Attacker]'s creature objects     │                    │ [Defender]'s creature objects     │
                   │                                            │ - defendersAlive: Post-combat     │                    │ - defendersAlive: Post-combat     │
                   │                                            │                                   │                    │                                   │
                   │                                            └───────────────────────────────────┘                    └───────────────────────────────────┘
                   │
                   │
            If checks fails                                     ┌───────────────────────────────────┐
                   │                                            │           Settle Combat           │
                   │                                            ├───────────────────────────────────┤
                   │                                            │                                   │
                   │                                            │ Do: Determine winner based on who │
                   │                                            │ still have creatures alive. If    │
                   └───────────────────────────────────────────▶│ both still has creatures alive,   │
                                                                │ then the combat is a draw.        │
                                                                │                                   │
                                                                │                                   │
                                                                └───────────────────────────────────┘
    */

    /*///////////////////////////////////////////////////////////////
                                EVENTS
    //////////////////////////////////////////////////////////////*/

    /// @notice Emitted when a creature is moved.
    /// @param creatureId Id of the creature that moved.
    /// @param data LibTypes.Creature data of the creature that moved.
    /// @param fromRegionId Id of the region the creature moved from.
    /// @param toRegionId Id of the region the creature moved to.
    event CreatureMovedToRegion(uint256 creatureId, LibTypes.Creature data, uint256 fromRegionId, uint256 toRegionId);

    /// @notice Emitted when a creature dies.
    /// @param creatureId Id of the creature that died.
    /// @param regionId Id of the region in which the creature died.
    event CreatureDied(uint256 creatureId, uint256 regionId);

    /// @notice Emitted when a player's LibTypes.Player data is updated.
    /// @param player Address of the player whose data was updated.
    /// @param data The new LibTypes.Player data of the player that was updated.
    event PlayerUpdated(address player, LibTypes.Player data);

    /// @notice Returns the AppStorage object for read and
    /// write usage in the rest of the library.
    /// @return ret The AppStorage object.
    function getAppStorage() internal pure returns (AppStorage storage ret) {
        ret = LibAppStorage.diamondStorage();
    }

    /*///////////////////////////////////////////////////////////////
                    CREATURESFACET HELPER FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Performs the "killing" of a creature.
    /// @param creatureId Id of the creature to kill.
    /// @param creature LibTypes.Creature object of the creature to kill.
    /// @param region Region id of the region in which the creature died.
    /// @param emitPlayerUpdatedEvent Whether or not to emit an event with the updated player data.
    /// @dev We decrements the population of the player because a creature has been killed
    function _killCreature(
        uint256 creatureId,
        LibTypes.Creature memory creature,
        uint256 region,
        bool emitPlayerUpdatedEvent
    ) internal {
        AppStorage storage s = getAppStorage();
        LibTypes.Player storage player = s.players[creature.owner];
        require(player.population >= 1, "Population minus soulsCost would be negative. This should not happen.");
        player.population -= 1;
        if (emitPlayerUpdatedEvent) {
            emit PlayerUpdated(player.player, player);
        }
        emit CreatureDied(creatureId, region);
    }

    /// @notice Helper function that charges the player for a creature they spawned.
    /// @param creatureSpecies LibTypes.CreatureSpecies species of the creature to charge for.
    /// @param creatureType LibTypes.CreatureType type of creature to charge for.
    /// @param owner Address of the player that will own the creature.
    /// @param emitPlayerUpdatedEvent Whether or not to emit an event with the updated LibTypes.Player data.
    /// @dev Calculates the goldCost and soulsCost for the creature, checks that the player has enough gold,
    /// souls, and population capacity, then decrements player.gold, player.souls, and increments player.population.
    function _chargePlayerForCreature(
        LibTypes.CreatureSpecies creatureSpecies,
        LibTypes.CreatureType creatureType,
        address owner,
        bool emitPlayerUpdatedEvent
    ) public {
        AppStorage storage s = getAppStorage();
        LibTypes.Player storage player = s.players[owner];
        uint256 goldCost = s.gameConstants.CREATURES_PRICE[uint256(creatureSpecies)][uint256(creatureType)][
            uint256(LibTypes.Resource.GOLD)
        ];
        uint256 soulsCost = s.gameConstants.CREATURES_PRICE[uint256(creatureSpecies)][uint256(creatureType)][
            uint256(LibTypes.Resource.SOULS)
        ];
        require(player.gold >= goldCost, "Not enough gold funds.");
        require(player.souls >= soulsCost, "Not enough souls funds.");
        require(player.population + 1 <= player.maxPopulation, "Not enough population capacity.");
        player.gold -= goldCost;
        player.souls -= soulsCost;
        player.population += 1;
        if (emitPlayerUpdatedEvent) {
            emit PlayerUpdated(player.player, player);
        }
    }

    /// @notice Helper function that creates and returns a LibTypes.Creature object and initializes
    /// it with a given species and type.
    /// @param tileId Tile id of the tile where the creature will be located.
    /// @param creatureSpecies LibTypes.CreatureSpecies species of the creature.
    /// @param creatureType LibTypes.CreatureType type of the creature.
    /// @param owner Address of the owner of the creature.
    /// @return creature The LibTypes.Creature object that was created.
    function _createCreature(
        uint256 tileId,
        LibTypes.CreatureSpecies creatureSpecies,
        LibTypes.CreatureType creatureType,
        address owner
    ) public view returns (LibTypes.Creature memory creature) {
        AppStorage storage s = getAppStorage();
        uint256 lifeMultiplier = 1;
        if (creatureType == LibTypes.CreatureType.UNIQUE) {
            lifeMultiplier = s.gameConstants.CREATURES_UNIQUE_STAT_MULTIPLIER;
        }
        creature = LibTypes.Creature({
            species: creatureSpecies,
            creatureType: creatureType,
            level: 0,
            owner: owner,
            life: s.gameConstants.CREATURES_BASE_STAT_PER_SPECIES[uint256(creatureSpecies)][
                uint256(LibTypes.CreatureStat.LIFE)
            ] * lifeMultiplier,
            tileId: tileId
        });
    }

    /// @notice Helper function that handles the details behind spawning a given creature.
    /// @param creature The LibTypes.Creature object that will be spawned.
    /// @return creatureId The creatureId of the creature object
    /// @dev Adds the LibTypes.Creature object to AppStorage.creatures, and AppStorage.regions.creatures,
    /// then calculates how much influence the given creature adds, and increases the creature's owner's
    /// influence accordingly.
    function _spawnCreature(LibTypes.Creature memory creature) public returns (uint256 creatureId) {
        AppStorage storage s = getAppStorage();
        creatureId = s.currentCreatureId;
        s.creatures[creatureId] = creature;
        uint256 regionId = LibUtils.tileIdToRegionId(creature.tileId, s.REGION_LENGTH);
        s.regions[regionId].creatures.push(creatureId);
        s.currentCreatureId++;
        int256 influenceAdded = int256(
            s.gameConstants.CREATURES_INFLUENCE_PER_SPECIES_AND_LEVEL[uint256(creature.species)][creature.level]
        );
        LibDungeon._modifyInfluenceOfPlayerInRegion(regionId, creature.owner, influenceAdded);
        emit CreatureMovedToRegion(creatureId, creature, uint256(0), regionId);
    }

    /// @notice Helper function that removes a creature from it's specified region.
    /// @param regionId Region id of the region the creature is in.
    /// @param creatureId The id of the creature being removed.
    /// @dev Loops through AppStorage.regions[regionId].creatures to find if the creatureId
    /// exists in that array, if the creature is found, [TODO: what is happening in second for loop?],
    /// and pops the creature from the array of creatures. TODO: why isn't s.regions[regionId].creatures updated to reflect the removal of this creature?
    function _removeCreatureFromRegion(uint256 regionId, uint256 creatureId) internal {
        AppStorage storage s = getAppStorage();
        uint256[] storage creaturesArray = s.regions[regionId].creatures;
        bool found;
        uint256 index = 0;
        for (uint256 i = 0; i < creaturesArray.length; i++) {
            if (creaturesArray[i] == creatureId) {
                index = i;
                found = true;
            }
        }
        require(found, "This id was not found in the region.creatures array.");
        for (uint256 i = index; i < creaturesArray.length - 1; i++) {
            creaturesArray[i] = creaturesArray[i + 1];
        }
        creaturesArray.pop();
    }

    /*///////////////////////////////////////////////////////////////
                        INTERNAL HELPER FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Returns the index of the creature in defendersSquad that is optimal for creatureType to attack.
    /// @param creatureType The LibTypes.CreatureType of to search for.
    /// @param defendersSquad The LibTypes.Creature[] squad to search through.
    /// @return index The index of the creature in defendersSquad that is optimal for creatureType to attack.
    function __findWeakCreature(LibTypes.CreatureType creatureType, LibTypes.Creature[] memory defendersSquad)
        internal
        view
        returns (uint256 index)
    {
        AppStorage storage s = getAppStorage();
        bool aliveCreatureFound = false;
        uint256 maxMultiplier = 0;
        index = 0;

        // Loop through defenders squad and save the index of the defending creature that gives the attacking
        // creature the highest damage multiplier.
        for (uint256 i = 0; i < defendersSquad.length; i++) {
            // Check for and ignore dead creatures.
            if (defendersSquad[i].life == 0) {
                continue;
            }

            // Calculate the strength multiplier that the attacker (creatureType variable) gets
            // against all creatures in defendersSquad.
            uint256 multiplier = uint256(
                s.gameConstants.CREATURES_TYPE_STRENGTH_AGAINST_TYPE[uint256(creatureType)][
                    uint256(defendersSquad[i].creatureType)
                ]
            );

            // We need to set the index to the first non-dead unit in the enemy squad,
            // which is why we need to have an aliveCreatureFound bool otherwise it is possible that no multiplier is over 0.
            if ((multiplier > maxMultiplier) || (!aliveCreatureFound)) {
                maxMultiplier = multiplier;
                index = i;
                aliveCreatureFound = true;
            }
        }
    }

    /// @notice Calculates and returns the groupMultipler, strengthMultiplier, and damage.
    /// @param attackerType The LibTypes.CreatureType of the attacking creature.
    /// @param attackerSpecies The LibTypes.CreatureSpecies of the attacking creature.
    /// @param attackersPerType Number of attackers of attackerType in the squad.
    /// @param defenderType The LibTypes.CreatureType of the defending creature.
    /// @return groupMultiplier The damage multiplier awarded to this creature for having other creatures
    /// of the same type in the squad, strengthMultiplier The damage multiplier awarded to this creature
    /// based on the rock-paper-scissors mechanic (e.g. Fire is weak to Ice), damage The damage the attacking
    /// creature will do to the defending creature.
    function __getDamage(
        LibTypes.CreatureType attackerType,
        LibTypes.CreatureSpecies attackerSpecies,
        uint256[] memory attackersPerType,
        LibTypes.CreatureType defenderType
    )
        internal
        view
        returns (
            int256 groupMultiplier,
            uint256 strengthMultiplier,
            int16 damage
        )
    {
        AppStorage storage s = getAppStorage();

        // Calculate the groupMultiplier (damage multiplier awarded to this creature for having other creatures
        // of the same type in the squad) given to the squad based on number of attacking creatures of the same type.
        {
            uint256 groupMultiplierIndex = 0;
            uint256 numberOfAttackersOfSameType = attackersPerType[uint256(attackerType)];

            if (numberOfAttackersOfSameType == 8) {
                groupMultiplierIndex = 4;
            } else if (numberOfAttackersOfSameType >= 6) {
                groupMultiplierIndex = 3;
            } else if (numberOfAttackersOfSameType >= 4) {
                groupMultiplierIndex = 2;
            } else if (numberOfAttackersOfSameType >= 2) {
                groupMultiplierIndex = 1;
            }

            // Set groupMultiplier based on number of attackers of the same type.
            groupMultiplier = s.gameConstants.CREATURES_GROUP_MULTIPLIERS[groupMultiplierIndex];

            // If there is more than one CreatureType.UNIQUE attacker, set the groupMultiplayer to
            // gameConstants.CREATURES_UNIQUE_GROUP_NEG_BOOST.
            if (attackerType == LibTypes.CreatureType.UNIQUE && attackersPerType[uint256(attackerType)] > 1) {
                groupMultiplier = s.gameConstants.CREATURES_UNIQUE_GROUP_NEG_BOOST;
            }
        }

        // Calculate strengthMultiplier (damage multiplier awarded to this creature based on the rock-paper-scissors
        // mechanic (e.g. Fire is weak to Ice)) based on power dynamic between attackerType and defenderType.
        strengthMultiplier = uint256(
            s.gameConstants.CREATURES_TYPE_STRENGTH_AGAINST_TYPE[uint256(attackerType)][uint256(defenderType)]
        );

        // Calculate damage (that the attacking creature will do to the defending creature).
        {
            // Calculate attack stat.
            uint256 atk = // Get the ATK stat for the attackerSpecies from gameConstants.
            s.gameConstants.CREATURES_BASE_STAT_PER_SPECIES[uint256(attackerSpecies)][
                uint256(LibTypes.CreatureStat.ATK)
            ] *
                // Multiply the ATK stat by CREATURES_UNIQUE_STAT_MULTIPLIER if attackerType = UNIQUE, else multiply by 1.
                (attackerType == LibTypes.CreatureType.UNIQUE ? s.gameConstants.CREATURES_UNIQUE_STAT_MULTIPLIER : 1);

            // Calculate damage based on atk, strengthMultiplier, and groupMultipler, and handle groupMultiplier
            // being negative in the case where attackerType was UNIQUE.
            if (groupMultiplier > 0) {
                damage = int16(
                    LibMath.toInt(LibMath.divu(atk * (100 + strengthMultiplier + uint256(groupMultiplier)), 100))
                );
            } else {
                damage = int16(
                    LibMath.toInt(LibMath.divu(atk * (100 - uint256(-groupMultiplier) + strengthMultiplier), 100))
                );
            }
        }
    }

    /// @notice Helper function that for each attacking creature, finds the optimal target creature, calculates the damage
    /// that will be done to it, applies the damage, and stores attack information.
    /// @param attackers The LibTypes.Creature[] array of attacking creatures (creatures dealing damage).
    /// @param defenders The LibTypes.Creature[] array of defending creatures (creatures being dealt damage to).
    /// @param defendersAlive Number of creatures in the defending squad that are alive.
    /// @return combatAtomicTaces The LibTypes.CombatAtomicTrace[] array of objects containing information about each
    /// attack made by each attacking creature.
    /// newDefenders The new LibTypes.Creature[] array of the defending squad
    /// after damage has been dealt.
    ////newDefendersAlive The updated number of creatures in the defending squad that
    /// are alive after damage has been dealt.
    function __runHalfRound(
        LibTypes.Creature[] memory attackers,
        LibTypes.Creature[] memory defenders,
        uint256 defendersAlive
    )
        internal
        view
        returns (
            LibTypes.CombatAtomicTrace[] memory combatAtomicTraces,
            LibTypes.Creature[] memory newDefenders,
            uint256 newDefendersAlive
        )
    {
        // Compute the number of attackers per creature type to pass as param in __getDamage() call.
        uint256[] memory attackersPerType = new uint256[](uint256(LibTypes.CreatureType.UNIQUE) + 1);
        for (uint256 i = 0; i < attackers.length; i++) {
            attackersPerType[uint256(attackers[i].creatureType)] += 1;
        }
        {
            // Compute the number of attacking creatures alive.
            uint256 attackersAlive = 0;
            for (uint256 i = 0; i < attackers.length; i++) {
                if (attackers[i].life > 0) {
                    attackersAlive++;
                }
            }
            // Each attacking creature gets an attack and therefore a CombatAtomicTrace.
            combatAtomicTraces = new LibTypes.CombatAtomicTrace[](attackersAlive);
        }
        uint256 currentAtomicTraceIndex = 0;
        // For each attacking creature, find the optimal target creature, calculate the damage
        // that will be done to it, apply the damage, and store attack information.
        for (uint256 i = 0; i < attackers.length; i++) {
            // Check for and ignore dead creatures.
            if (attackers[i].life == 0) {
                continue;
            }
            // Target the creature on enemy's squad that gives the current creature the highest strengthMultiplyer.
            uint256 target = __findWeakCreature(attackers[i].creatureType, defenders);
            require(defenders[target].life > 0, "Target is already dead."); // Sanity check.
            // Calculate the amount of damage the attacking creature would do to the target.
            (int256 groupMultiplier, uint256 strengthMultiplier, int16 damage) = __getDamage(
                attackers[i].creatureType,
                attackers[i].species,
                attackersPerType,
                defenders[target].creatureType
            );
            // Make sure damage is not greater than the life the target has left.
            if (uint256(damage) > defenders[target].life) {
                damage = int16(defenders[target].life);
            }
            // Apply damage to target's life.
            if (damage > 0) {
                defenders[target].life -= uint256(damage);
            } else {
                defenders[target].life += uint256(-damage);
            }
            // Store the information about this attack.
            combatAtomicTraces[currentAtomicTraceIndex] = LibTypes.CombatAtomicTrace({
                initiator: uint8(i),
                target: uint8(target),
                damage: damage,
                strengthMultiplier: uint16(strengthMultiplier),
                groupMultiplier: int16(groupMultiplier)
            });
            currentAtomicTraceIndex++;

            if (defenders[target].life == 0) {
                defendersAlive -= 1;
            }
            if (defendersAlive == 0) {
                break;
            }
        }
        return (combatAtomicTraces, defenders, defendersAlive);
    }

    /// @notice Helper function that performs combat between two squads of creatures and
    /// returns results and combat information.
    /// @param instigatorSquad Creatures of the instigating player (player that moved into another's
    /// region with their creatures).
    /// @param defenderSquad Creatures of the defending player.
    /// @return trace Array storing information about each squad's attacking round, winner The winner
    /// of the combat, newInstigatorSquad The updated creatures squad for the instigator after combat is over,
    /// newDefenderSquad The updated creatures squad for the defender after combat is over.
    function _runCombat(LibTypes.Creature[] memory instigatorSquad, LibTypes.Creature[] memory defenderSquad)
        public
        view
        returns (
            LibTypes.RoundTrace[] memory trace,
            LibTypes.CombatWinner winner,
            LibTypes.Creature[] memory newInstigatorSquad,
            LibTypes.Creature[] memory newDefenderSquad
        )
    {
        AppStorage storage s = getAppStorage();
        uint256 rounds = 0;
        uint256 instigatorSquadAlive = instigatorSquad.length;
        uint256 defenderSquadAlive = defenderSquad.length;
        // TODO: find a convention for those arrays we need to init at max size because we don't know yet what their size will be (happens in multiple places)
        LibTypes.RoundTrace[] memory _trace = new LibTypes.RoundTrace[](
            s.gameConstants.CREATURES_MAX_NUMBER_OF_ROUNDS_PER_COMBAT
        );

        // While there neither squad is completely dead, and the max number of rounds
        // has not been reached, run an attacking round for the defenderSquad,
        // then run an attacking round for the instigatorSquad, and store each round results.
        while (
            instigatorSquadAlive > 0 &&
            defenderSquadAlive > 0 &&
            // Rounds < not <= because rounds is 0-indexed while max is given as 1-indexed.
            rounds < s.gameConstants.CREATURES_MAX_NUMBER_OF_ROUNDS_PER_COMBAT
        ) {
            LibTypes.CombatAtomicTrace[] memory instigatorSquadTrace;
            LibTypes.CombatAtomicTrace[] memory defenderSquadTrace;
            // Defender squad will be the first to have an attacking round.
            (defenderSquadTrace, instigatorSquad, instigatorSquadAlive) = __runHalfRound(
                defenderSquad,
                instigatorSquad,
                instigatorSquadAlive
            );
            (instigatorSquadTrace, defenderSquad, defenderSquadAlive) = __runHalfRound(
                instigatorSquad,
                defenderSquad,
                defenderSquadAlive
            );
            trace[rounds] = LibTypes.RoundTrace({squad1Trace: instigatorSquadTrace, squad2Trace: defenderSquadTrace});
            rounds++;
        }

        // Store combat winner or set as draw.
        if (instigatorSquadAlive > 0 && defenderSquadAlive > 0) {
            winner = LibTypes.CombatWinner.DRAW;
        } else if (instigatorSquadAlive == 0) {
            winner = LibTypes.CombatWinner.SQUAD2;
        } else {
            winner = LibTypes.CombatWinner.SQUAD1;
        }

        // Initialize variables that will be returned.
        newInstigatorSquad = instigatorSquad;
        newDefenderSquad = defenderSquad;
        trace = new LibTypes.RoundTrace[](rounds);
        for (uint256 i = 0; i < rounds; i++) {
            trace[i] = _trace[i];
        }
    }
}
