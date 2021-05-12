// SPDX-License-Identifier: GPL-3.0 
pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

/// @title Ember Types Library
/// @notice This is a collection of types that are used in various places 
/// across the Ember smart contracts.
library LibTypes {

    struct GameConstants {
        bool CAN_SPAWN;
        
        /*///////////////////////////////////////////////////////////////
                            PLAYER INIT CONSTANTS
        //////////////////////////////////////////////////////////////*/

        uint256 INITIAL_GOLD;
        uint256 INITIAL_SOULS;
        
        
        /*///////////////////////////////////////////////////////////////
                                MANA CONSTANTS
        //////////////////////////////////////////////////////////////*/
        
        uint256 MAX_MANA;
        uint256 NUMBER_OF_SECONDS_FOR_ONE_MANA_REGEN;
        uint16[3] MANA_PER_ACTION_TYPE;
        
        /*///////////////////////////////////////////////////////////////
                                MINING CONSTANTS
        //////////////////////////////////////////////////////////////*/

        uint256 GOLD_PER_GOLD_BLOCK;
        uint256 SOULS_PER_SOUL_BLOCK;
        uint256 GOLD_PERLIN_THRESHOLD;
        uint256 SOUL_PERLIN_THRESHOLD;
        uint256 SOUL_GROUND_RESOURCE_PERLIN_THRESHOLD;
        
        /*///////////////////////////////////////////////////////////////
                                BANK CONSTANTS
        //////////////////////////////////////////////////////////////*/

        uint256 DRIP_AMOUNT;
        uint256 TIME_BETWEEN_DRIPS;
        
        /*///////////////////////////////////////////////////////////////
                                UPGRADES CONSTANTS
        //////////////////////////////////////////////////////////////*/

        uint256 WALL_PRICE;
        uint16[7] TILE_UPGRADE_PRICES;
        uint16[7] INFLUENCE_PER_TILE_UPGRADE;

        /*///////////////////////////////////////////////////////////////
                DUNGEON HEART, GOLD, and SOUL STORAGE CONSTANTS
        //////////////////////////////////////////////////////////////*/

        uint16[3] TILE_UPGRADE_GOLD_STORAGE;
        uint16[3] TILE_UPGRADE_SOUL_STORAGE;

        ////////////////////////////////////////////////////////////////

        uint256 POPULATION_PER_LAIR;  // Population increase per Lair

        /*///////////////////////////////////////////////////////////////
                            HARVEST CONSTANTS
        //////////////////////////////////////////////////////////////*/

        uint16[4] HARVEST_BOOST_TRANCHES;
        uint16[7] TILE_UPGRADE_NUMBER_OF_SECONDS_FOR_ONE_HARVEST;
        uint16[7] TILE_UPGRADE_MAX_HARVEST;
        uint256 MAX_SOULS_HARVESTED_PER_SOUL_TILE;

        /*///////////////////////////////////////////////////////////////
                        DELAYED ACTIONS CONSTANTS
        //////////////////////////////////////////////////////////////*/
       
        uint16[2][3] DELAYED_ACTIONS_MIN_SECOND_DELAY;  // TileDelayedActionType -> bool -> uint256
        uint256 SECONDS_UNTIL_EXPIRED_DELAYED_ACTION;
        
        /*///////////////////////////////////////////////////////////////
                            INFLUENCE CONSTANTS
        //////////////////////////////////////////////////////////////*/

        uint256 MIN_INFLUENCE_FOR_CONTROL;
        
        /*///////////////////////////////////////////////////////////////
                            CREATURES CONSTANTS
        //////////////////////////////////////////////////////////////*/

        uint256 CREATURES_MIN_SECOND_DELAY_BETWEEN_SPAWN;
        int256 CREATURES_UNIQUE_GROUP_NEG_BOOST;
        uint256 CREATURES_UNIQUE_STAT_MULTIPLIER;
        uint16[2][5][1] CREATURES_PRICE; // CreatureSpecies -> CreatureType -> (gold, souls)
        uint16[2][1] CREATURES_BASE_STAT_PER_SPECIES; // CreatureSpecies -> ATK/LIFE -> value
        uint16[5][5] CREATURES_TYPE_STRENGTH_AGAINST_TYPE; // CreaturesType -> CreaturesType -> value;
        uint16[4][1] CREATURES_INFLUENCE_PER_SPECIES_AND_LEVEL; // CreatureSpecies -> 0-3 -> value
        uint16[5] CREATURES_GROUP_MULTIPLIERS;
        uint256 CREATURES_MAX_NUMBER_OF_ROUNDS_PER_COMBAT;
        uint256 CREATURES_MAX_REGION_DISTANCE_FOR_MOVE;
        uint256 PERLIN_1_KEY;
        uint256 PERLIN_2_KEY;
        uint256 PERLIN_1_SCALE;
        uint256 PERLIN_2_SCALE;
    }

    struct Coord {
        int32 x;
        int32 y;
    }

    struct InitArgs {
        GameConstants gameConstants;
        uint256 numberOfRegionsPerSide;
    }

    struct Player {
        bool isInitialized;
        address player;
        uint256 initTimestamp;
        uint256 gold;
        uint256 souls;
        uint256 population;
        uint256 mana;
        uint256 lastManaUpdateTimestamp;
        uint256 maxGold;
        uint256 maxSouls;
        uint256 maxPopulation;
    }

    struct Tile {
        address owner;
        uint32 lastHarvestTimestamp;
        TileUpgrade upgrade;
        bool touchable;
        bool isWalled;
        bool isMined;
    }

    struct HarvestableGroundResources {
        uint256 souls;
    }

    struct TileDelayedAction {
        uint256 tileId;
        address initiator;
        uint32 submittedTimestamp;
        TileDelayedActionType delayedActionType;
    }

    struct Region {
        uint256[] tiles;
        uint32 lastSpawnTimestamp;
        bool isMined;
        address firstMiner;
        uint256 gold;
        uint256 souls;
        uint256[] creatures;
    }

    struct Creature {
        CreatureSpecies species;
        CreatureType creatureType;
        uint256 level;
        uint256 life;
        address owner;
        uint256 tileId;
    }

    // one action for one creature
    struct CombatAtomicTrace {
        uint8 initiator;
        uint8 target;
        int16 damage;
        uint16 strengthMultiplier;
        int16 groupMultiplier;
    }

    struct RoundTrace {
        CombatAtomicTrace[] squad1Trace;
        CombatAtomicTrace[] squad2Trace;
    }

    // parallel arrays
    struct InfluenceData {
        address[] players;
        uint256[] influences;
    }

    enum Resource {
        GOLD,
        SOULS
    }

    enum TileDelayedActionType {
        WALL,
        UNWALL,
        FORCE_MINE
    }

    enum TileUpgrade {
        NONE,
        DUNGEON_HEART,
        GOLD_GENERATOR,
        GOLD_STORAGE,
        SOUL_GENERATOR,
        SOUL_STORAGE,
        LAIR
    }

    enum ActionType {
        MINE,
        CLAIM,
        UPGRADE
    }

    enum CreatureSpecies {
        BALANCED
    }

    enum CreatureType {
        NORMAL,
        RED,
        BLUE,
        BLACK,
        UNIQUE
    }

    enum CreatureStat {
        ATK,
        LIFE
    }

    enum CombatWinner {
        SQUAD1,
        SQUAD2,
        DRAW
    }
}
