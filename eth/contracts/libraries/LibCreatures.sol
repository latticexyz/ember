// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;
import "hardhat/console.sol";
import "./LibTypes.sol";
import "./LibMath.sol";
import "./LibAppStorage.sol";
import "./LibDungeon.sol";

library LibCreatures {
    event CreatureMovedToRegion(uint256 creatureId, LibTypes.Creature data, uint256 fromRegionId, uint256 toRegionId);
    event CreatureDied(uint256 creatureId, uint256 regionId);
    event PlayerUpdated(address player, LibTypes.Player data);

    function getAppStorage() internal pure returns (AppStorage storage ret) {
        ret = LibAppStorage.diamondStorage();
    }

    function _killCreature(
        uint256 creatureId,
        LibTypes.Creature memory creature,
        uint256 region,
        bool emitPlayerUpdatedEvent
    ) internal {
        AppStorage storage s = getAppStorage();
        LibTypes.Player storage player = s.players[creature.owner];
        require(player.population >= 0, "population would be negative. this should not happen");
        player.population -= 1;
        s.playersToNumberOfCreaturesWithSpecies[creature.owner][creature.species]--;
        if (emitPlayerUpdatedEvent) {
            emit PlayerUpdated(player.player, player);
        }
        emit CreatureDied(creatureId, region);
    }

    function _chargePlayerForCreature(
        LibTypes.CreatureSpecies _creatureSpecies,
        LibTypes.CreatureType _type,
        address _owner,
        bool emitPlayerUpdatedEvent
    ) public {
        AppStorage storage s = getAppStorage();
        LibTypes.Player storage player = s.players[_owner];
        uint256 goldCost = s.gameConstants.CREATURES_PRICE[uint256(_creatureSpecies)][uint256(_type)][
            uint256(LibTypes.Resource.GOLD)
        ];
        uint256 soulsCost = s.gameConstants.CREATURES_PRICE[uint256(_creatureSpecies)][uint256(_type)][
            uint256(LibTypes.Resource.SOULS)
        ];
        require(player.gold >= goldCost, "not enough gold funds");
        require(player.souls >= soulsCost, "not enough souls funds");
        require(player.population + 1 <= player.maxPopulation, "not enough population capacity");
        player.gold -= goldCost;
        player.souls -= soulsCost;
        player.population += 1;
        if (emitPlayerUpdatedEvent) {
            emit PlayerUpdated(player.player, player);
        }
    }

    function _createCreature(
        uint256 _tileId,
        LibTypes.CreatureSpecies _creatureSpecies,
        LibTypes.CreatureType _type,
        address _owner
    ) public view returns (LibTypes.Creature memory creature) {
        AppStorage storage s = getAppStorage();
        uint256 lifeMultiplier = 1;
        if (_type == LibTypes.CreatureType.UNIQUE) {
            lifeMultiplier = s.gameConstants.CREATURES_UNIQUE_STAT_MULTIPLIER;
        }
        creature = LibTypes.Creature({
            species: _creatureSpecies,
            creatureType: _type,
            level: 0,
            owner: _owner,
            life: s.gameConstants.CREATURES_BASE_STAT_PER_SPECIES[uint256(_creatureSpecies)][
                uint256(LibTypes.CreatureStat.LIFE)
            ][0] * lifeMultiplier,
            tileId: _tileId
        });
    }

    function _spawnCreature(LibTypes.Creature memory creature) public returns (uint256 creatureId) {
        AppStorage storage s = getAppStorage();
        creatureId = s.currentCreatureId;
        s.creatures[creatureId] = creature;
        uint256 regionId = LibUtils.tileIdToRegionId(creature.tileId, s.REGION_LENGTH);
        s.regions[regionId].creatures.push(creatureId);
        s.currentCreatureId++;
        s.playersToNumberOfCreaturesWithSpecies[creature.owner][creature.species]++;
        int256 influenceAdded = int256(
            s.gameConstants.CREATURES_INFLUENCE_PER_SPECIES_AND_LEVEL[uint256(creature.species)][creature.level]
        );
        LibDungeon._modifyInfluenceOfPlayerInRegion(regionId, creature.owner, influenceAdded);
        emit CreatureMovedToRegion(creatureId, creature, uint256(0), regionId);
    }

    function _removeCreatureFromRegion(uint256 regionId, uint256 id) internal {
        AppStorage storage s = getAppStorage();
        uint256[] storage array = s.regions[regionId].creatures;
        bool found;
        uint256 index = 0;
        for (uint256 i = 0; i < array.length; i++) {
            if (array[i] == id) {
                index = i;
                found = true;
            }
        }
        require(found, "this id was not found in the region.creatures array");
        for (uint256 i = index; i < array.length - 1; i++) {
            array[i] = array[i + 1];
        }
        array.pop();
    }

    function __findWeakCreature(LibTypes.CreatureType creatureType, LibTypes.Creature[] memory squad)
        internal
        view
        returns (uint256 index)
    {
        AppStorage storage s = getAppStorage();
        // we need to set the index to the first non dead unit in the enemy squad, which is why we need to have a found bool otherwise it is possible that no multiplier is over 0
        bool aliveCreatureFound = false;
        uint256 maxMultiplier = 0;
        index = 0;
        for (uint256 i = 0; i < squad.length; i++) {
            if (squad[i].life == 0) {
                continue;
            }
            uint256 multiplier = uint256(
                s.gameConstants.CREATURES_TYPE_STRENGTH_AGAINST_TYPE[uint256(creatureType)][
                    uint256(squad[i].creatureType)
                ]
            );
            if ((multiplier > maxMultiplier) || (!aliveCreatureFound)) {
                maxMultiplier = multiplier;
                index = i;
                aliveCreatureFound = true;
            }
        }
    }

    function __getDamage(
        LibTypes.CreatureType attackerType,
        LibTypes.CreatureSpecies attackerSpecies,
        uint256 attackerLevel,
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
        // find corresponding strength multiplier
        {
            uint256 groupMultiplierIndex = 0;
            uint256 numberOfAttackersOfSameType = attackersPerType[uint256(attackerType)];
            //console.log("numberOfAttackersOfSameType: %s", numberOfAttackersOfSameType);
            if (numberOfAttackersOfSameType == 8) {
                groupMultiplierIndex = 4;
            } else if (numberOfAttackersOfSameType >= 6) {
                groupMultiplierIndex = 3;
            } else if (numberOfAttackersOfSameType >= 4) {
                groupMultiplierIndex = 2;
            } else if (numberOfAttackersOfSameType >= 2) {
                groupMultiplierIndex = 1;
            }
            groupMultiplier = s.gameConstants.CREATURES_GROUP_MULTIPLIERS[groupMultiplierIndex];
            if (attackerType == LibTypes.CreatureType.UNIQUE && attackersPerType[uint256(attackerType)] > 1) {
                groupMultiplier = s.gameConstants.CREATURES_UNIQUE_GROUP_NEG_BOOST;
            }
        }
        strengthMultiplier = uint256(
            s.gameConstants.CREATURES_TYPE_STRENGTH_AGAINST_TYPE[uint256(attackerType)][uint256(defenderType)]
        );
        {
            uint256 atk = s.gameConstants.CREATURES_BASE_STAT_PER_SPECIES[uint256(attackerSpecies)][
                uint256(LibTypes.CreatureStat.ATK)
            ][attackerLevel] *
                (attackerType == LibTypes.CreatureType.UNIQUE ? s.gameConstants.CREATURES_UNIQUE_STAT_MULTIPLIER : 1);
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

    struct RunHalfRoundVars {
        int16 damage;
        uint256 target;
        uint256 currentAtomicTraceIndex;
        int256 groupMultiplier;
        uint256 strengthMultiplier;
    }

    // here the attackers are the ones dealing the damages and the defenders are the ones receiving it
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
        RunHalfRoundVars memory vars;
        // compute the number of attacker per type
        uint256[] memory attackersPerType = new uint256[](uint256(LibTypes.CreatureType.UNIQUE) + 1);
        for (uint256 i = 0; i < attackers.length; i++) {
            attackersPerType[uint256(attackers[i].creatureType)] += 1;
        }
        {
            uint256 attackersAlive = 0;
            for (uint256 i = 0; i < attackers.length; i++) {
                if (attackers[i].life > 0) {
                    attackersAlive++;
                }
            }
            combatAtomicTraces = new LibTypes.CombatAtomicTrace[](attackersAlive);
        }
        vars.currentAtomicTraceIndex = 0;
        for (uint256 i = 0; i < attackers.length; i++) {
            if (attackers[i].life == 0) {
                continue;
            }
            // target selection with strength multiplier
            vars.target = __findWeakCreature(attackers[i].creatureType, defenders);
            // sanity check
            require(defenders[vars.target].life > 0, "target is already dead");
            {
                (int256 groupMultiplier, uint256 strengthMultiplier, int16 damage) = __getDamage(
                    attackers[i].creatureType,
                    attackers[i].species,
                    attackers[i].level,
                    attackersPerType,
                    defenders[vars.target].creatureType
                );
                vars.groupMultiplier = groupMultiplier;
                vars.strengthMultiplier = strengthMultiplier;
                vars.damage = damage;
            }
            if (uint256(vars.damage) > defenders[vars.target].life) {
                vars.damage = int16(defenders[vars.target].life);
            }
            if (vars.damage > 0) {
                defenders[vars.target].life -= uint256(vars.damage);
            } else {
                defenders[vars.target].life += uint256(-vars.damage);
            }
            combatAtomicTraces[vars.currentAtomicTraceIndex] = LibTypes.CombatAtomicTrace({
                initiator: uint8(i),
                target: uint8(vars.target),
                damage: vars.damage,
                strengthMultiplier: uint16(vars.strengthMultiplier),
                groupMultiplier: int16(vars.groupMultiplier)
            });
            vars.currentAtomicTraceIndex++;

            if (defenders[vars.target].life == 0) {
                //console.log("%s killed %s", i, target);
                defendersAlive -= 1;
            }
            if (defendersAlive == 0) {
                break;
            }
        }
        return (combatAtomicTraces, defenders, defendersAlive);
    }

    function _runCombat(LibTypes.Creature[] memory squad1, LibTypes.Creature[] memory squad2)
        public
        view
        returns (
            LibTypes.RoundTrace[] memory trace,
            LibTypes.CombatWinner winner,
            LibTypes.Creature[] memory newSquad1,
            LibTypes.Creature[] memory newSquad2
        )
    {
        AppStorage storage s = getAppStorage();
        uint256 rounds = 0;
        uint256 squad1Alive = squad1.length;
        uint256 squad2Alive = squad2.length;
        // TODO: find a convention for those arrays we need to init at max size because we don't know yet what their size will be (happens in multiple places)
        LibTypes.RoundTrace[] memory _trace = new LibTypes.RoundTrace[](
            s.gameConstants.CREATURES_MAX_NUMBER_OF_ROUNDS_PER_COMBAT
        );

        // Rounds < not <= because rounds is 0-indexed while max is given as 1-indexed
        while (
            squad1Alive > 0 && squad2Alive > 0 && rounds < s.gameConstants.CREATURES_MAX_NUMBER_OF_ROUNDS_PER_COMBAT
        ) {
            LibTypes.CombatAtomicTrace[] memory squad1Trace;
            LibTypes.CombatAtomicTrace[] memory squad2Trace;
            // defenders attack first
            (squad2Trace, squad1, squad1Alive) = __runHalfRound(squad2, squad1, squad1Alive);
            (squad1Trace, squad2, squad2Alive) = __runHalfRound(squad1, squad2, squad2Alive);
            _trace[rounds] = LibTypes.RoundTrace({squad1Trace: squad1Trace, squad2Trace: squad2Trace});
            rounds++;
        }

        if (squad1Alive > 0 && squad2Alive > 0) {
            winner = LibTypes.CombatWinner.DRAW;
        } else if (squad1Alive == 0) {
            winner = LibTypes.CombatWinner.SQUAD2;
        } else {
            winner = LibTypes.CombatWinner.SQUAD1;
        }

        newSquad1 = squad1;
        newSquad2 = squad2;
        trace = new LibTypes.RoundTrace[](rounds);
        for (uint256 i = 0; i < rounds; i++) {
            trace[i] = _trace[i];
        }
    }
}
