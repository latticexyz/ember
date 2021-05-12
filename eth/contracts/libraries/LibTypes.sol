// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

library LibTypes {
    struct GameConstants {
        bool CAN_SPAWN;
        // Player Init
        uint256 INITIAL_GOLD;
        uint256 INITIAL_SOULS;
        // Mana
        uint256 MAX_MANA;
        uint256 NUMBER_OF_SECONDS_FOR_ONE_MANA_REGEN;
        uint16[2] MANA_PER_ACTION_TYPE;
        // Settlement
        uint16[2][3] SETTLEMENT_PRICE_PER_LEVEL;
        // price increase for first settlement (should be 100), for the second settlement, for third settlement, and for fourth settlement
        uint16[4] SETTLEMENT_PRICE_PERCENT_INCREASE_PER_UNIT;
        // Mana
        uint256 NUMBER_OF_SECONDS_FOR_ONE_ENERGY_REGEN;
        uint16[3] MAX_ENERGY_PER_LEVEL;
        // Mining
        uint256 GOLD_PER_GOLD_BLOCK;
        uint256 SOULS_PER_SOUL_BLOCK;
        uint256 GOLD_PERLIN_THRESHOLD;
        uint256 SOUL_PERLIN_THRESHOLD;
        uint256 SOUL_GROUND_RESOURCE_PERLIN_THRESHOLD;
        // Bank
        uint256 DRIP_AMOUNT;
        uint256 TIME_BETWEEN_DRIPS;
        // Upgrades
        uint256 WALL_PRICE;
        uint16[8] TILE_UPGRADE_PRICES;
        uint16[8] TILE_UPGRADE_PRICE_PERCENT_INCREASE_PER_UNIT;
        uint16[8] INFLUENCE_PER_TILE_UPGRADE;
        // Dungeon Heart, Gold Storage, Soul Storage
        uint16[3] TILE_UPGRADE_GOLD_STORAGE;
        uint16[3] TILE_UPGRADE_SOUL_STORAGE;
        // Population increase per Lair
        uint256 POPULATION_PER_LAIR;
        // Population increase per Dungeon Heart
        uint256 POPULATION_PER_DH;
        // Harvest
        uint16[4] HARVEST_BOOST_TRANCHES;
        uint16[8] TILE_UPGRADE_NUMBER_OF_SECONDS_FOR_ONE_HARVEST;
        uint16[8] TILE_UPGRADE_MAX_HARVEST;
        uint256 MAX_SOULS_HARVESTED_PER_SOUL_TILE;
        // Delayed actions
        // TileDelayedActionType -> bool -> uint256
        uint16[2][3] DELAYED_ACTIONS_MIN_SECOND_DELAY;
        uint256 SECONDS_UNTIL_EXPIRED_DELAYED_ACTION;
        // Influence
        uint256 MIN_INFLUENCE_FOR_CONTROL;
        // Creatures.
        int256 CREATURES_UNIQUE_GROUP_NEG_BOOST;
        uint256 CREATURES_UNIQUE_STAT_MULTIPLIER;
        // CreatureSpecies -> CreatureType -> (gold, souls)
        uint16[2][5][2] CREATURES_PRICE;
        // CreatureSpecies -> CreatureType -> 3 level ugprades -> uint256 price
        uint16[3][5][2] CREATURES_LEVEL_UP_PRICE;
        // CreatureSpecies -> ATK/LIFE -> 4 levels -> value
        uint16[4][2][2] CREATURES_BASE_STAT_PER_SPECIES;
        // CreaturesType -> CreaturesType -> value;
        uint16[5][5] CREATURES_TYPE_STRENGTH_AGAINST_TYPE;
        // CreatureSpecies -> 0-3 -> value
        uint16[4][2] CREATURES_INFLUENCE_PER_SPECIES_AND_LEVEL;
        uint16[5] CREATURES_GROUP_MULTIPLIERS;
        // CreatureSpecies -> CreatureType -> value;
        uint16[5][2] MAX_CREATURES_PER_SPECIES_AND_TYPES;
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

    struct Settlement {
        address owner;
        uint256 level;
        uint256 energy;
        uint256 lastEnergyUpdateTimestamp;
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
        LAIR,
        TRAINING_ROOM
    }

    enum ActionType {
        MINE,
        UPGRADE
    }

    enum CreatureSpecies {
        BALANCED,
        HERO
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
