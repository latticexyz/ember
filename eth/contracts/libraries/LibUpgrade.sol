// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import "./LibTypes.sol";
import "./LibAppStorage.sol";
import "./LibMath.sol";
import "./LibUtils.sol";

library LibUpgrade {
    using LibUtils for uint256;

    // IMPORTANT: those need the same name/signatures as the events in DungeonFacet
    event RegionUpdated(uint256 region, LibTypes.Region data);
    event PlayerUpdated(address player, LibTypes.Player data);
    // harvest
    event TileHarvestableGroundResourcesUpdated(uint256 tile, LibTypes.HarvestableGroundResources data);
    event TileLastHarvestTimestampUpdated(uint256 tile, uint32 timestamp);
    // creatures
    event CreatureUpdated(uint256 creatureId, uint256 regionId, LibTypes.Creature data);

    ///////////////////////////////////
    /// RESOURCES ///
    ///////////////////////////////////

    function getAppStorage() internal pure returns (AppStorage storage ret) {
        ret = LibAppStorage.diamondStorage();
    }

    function __msgSender() internal view returns (address) {
        AppStorage storage s = getAppStorage();
        address impersonating = s.impersonators[msg.sender];
        if (impersonating != address(0)) {
            return impersonating;
        } else {
            return msg.sender;
        }
    }

    function _modifyResourceOfPlayer(
        address playerAddress,
        int256 amount,
        uint256 regionId,
        LibTypes.Resource resource
    ) public {
        AppStorage storage s = getAppStorage();
        LibTypes.Player storage player = s.players[playerAddress];
        bool overflow = false;
        if (resource == LibTypes.Resource.GOLD) {
            if (amount < 0) {
                require(player.gold >= uint256(-amount), "gold underflows");
                player.gold -= uint256(-amount);
            } else {
                if (player.gold + uint256(amount) > player.maxGold) {
                    uint256 remaining = player.gold + uint256(amount) - player.maxGold;
                    player.gold = player.maxGold;
                    s.regions[regionId].gold += remaining;
                    overflow = true;
                } else {
                    player.gold += uint256(amount);
                }
            }
        } else if (resource == LibTypes.Resource.SOULS) {
            if (amount < 0) {
                require(player.souls >= uint256(-amount), "souls underflow");
                player.souls -= uint256(-amount);
            } else {
                if (player.souls + uint256(amount) > player.maxSouls) {
                    uint256 remaining = player.souls + uint256(amount) - player.maxSouls;
                    player.souls = player.maxSouls;
                    s.regions[regionId].souls += remaining;
                    overflow = true;
                } else {
                    player.souls += uint256(amount);
                }
            }
        }
        emit PlayerUpdated(player.player, player);
        if (overflow) {
            emit RegionUpdated(regionId, s.regions[regionId]);
        }
    }

    function _chargePlayerForUpgradeAndInitHarvestTimestamp(uint256 tileId, LibTypes.TileUpgrade upgrade) public {
        AppStorage storage s = getAppStorage();
        LibTypes.Player storage player = s.players[__msgSender()];
        // Can't upgrade to NONE or DUNGEON_HEART
        require(upgrade > LibTypes.TileUpgrade.DUNGEON_HEART, "illegal upgrade");
        // Can only build a SOUL_GENERATOR on a soul tile
        if (upgrade == LibTypes.TileUpgrade.SOUL_GENERATOR) {
            require(s.tileHarvestableGroundResources[tileId].souls > 0, "no souls can be harvested from this tile");
        }
        uint256 cost = s.gameConstants.TILE_UPGRADE_PRICES[uint256(upgrade)];
        require(player.gold >= cost, "not enough funds");
        player.gold -= cost;
        // Init the harvest timestamp
        s.tiles[tileId].lastHarvestTimestamp = uint32(block.timestamp);
        emit TileLastHarvestTimestampUpdated(tileId, uint32(block.timestamp));
        emit PlayerUpdated(player.player, player);
    }

    function __healCreaturesOnRegion(
        address player,
        uint256 regionId,
        uint256 totalHealAmount
    ) internal {
        AppStorage storage s = getAppStorage();
        uint256[] storage creatureIds = s.regions[regionId].creatures;
        if (creatureIds.length == 0 || totalHealAmount == 0) {
            return;
        }
        require(s.creatures[creatureIds[0]].owner == player, "don't heal ennemies you idiot");
        uint256 sharePerMonster = LibMath.toUInt(LibMath.divu(totalHealAmount, creatureIds.length));
        if (sharePerMonster == 0) {
            sharePerMonster = 1;
        }
        uint256 remainingHealAmount = totalHealAmount;
        bool done = false;
        uint256 creaturesWithFullLife = 0;
        bool[] memory creaturesWithFullLifeMap = new bool[](creatureIds.length);
        while (!done) {
            for (uint256 i = 0; i < creatureIds.length; i++) {
                if (remainingHealAmount < sharePerMonster) {
                    sharePerMonster = remainingHealAmount;
                }
                if (sharePerMonster == 0) {
                    done = true;
                    break;
                }
                if (creaturesWithFullLife == creatureIds.length) {
                    done = true;
                    break;
                }
                uint256 maxLife = s.gameConstants.CREATURES_BASE_STAT_PER_SPECIES[
                    uint256(s.creatures[creatureIds[i]].species)
                ][uint256(LibTypes.CreatureStat.LIFE)] *
                    (
                        s.creatures[creatureIds[i]].creatureType == LibTypes.CreatureType.UNIQUE
                            ? s.gameConstants.CREATURES_UNIQUE_STAT_MULTIPLIER
                            : 1
                    );
                uint256 previousLife = s.creatures[creatureIds[i]].life;
                // already fully healed
                if (creaturesWithFullLifeMap[i]) {
                    continue;
                    // fully heal it and set as healed
                } else if (previousLife + sharePerMonster > maxLife) {
                    s.creatures[creatureIds[i]].life = maxLife;
                    creaturesWithFullLife++;
                    creaturesWithFullLifeMap[i] = true;
                    // heal with share
                } else {
                    s.creatures[creatureIds[i]].life += sharePerMonster;
                }
                remainingHealAmount -= s.creatures[creatureIds[i]].life - previousLife;
            }
        }
        for (uint256 i; i < creatureIds.length; i++) {
            emit CreatureUpdated(creatureIds[i], regionId, s.creatures[creatureIds[i]]);
        }
    }

    function _harvestTiles(uint256[] memory tileIds, LibTypes.TileUpgrade upgrade) public {
        AppStorage storage s = getAppStorage();
        LibTypes.Player storage player = s.players[__msgSender()];
        uint256 regionId = LibUtils.tileIdToRegionId(tileIds[0], s.REGION_LENGTH);
        uint16 numberOfSecondsForOneHarvest = s.gameConstants.TILE_UPGRADE_NUMBER_OF_SECONDS_FOR_ONE_HARVEST[
            uint256(upgrade)
        ];
        require(numberOfSecondsForOneHarvest != 0, "this tile upgrade cannot be harvested");
        // console.log("harvesting %s tiles", tileIds.length);
        // we know all those tiles have the same upgrade and are connected to each other.
        // we just need to compute the quadatric scaling
        // for each tile we compute the amount harvested by counting the number of seconds elapsed between
        // the last harvest and the current one, and scale by the corresponding quadatric scaling factor
        // first let's compute the boost depending on the tier
        // boost is in percent. ie: 25% is 25;
        uint256 totalHarvest = 0;
        uint256 boost = 0;
        uint256 t = tileIds.length;
        {
            uint256 tranche1 = uint256(s.gameConstants.HARVEST_BOOST_TRANCHES[0]);
            uint256 tranche2 = uint256(s.gameConstants.HARVEST_BOOST_TRANCHES[1]);
            uint256 tranche3 = uint256(s.gameConstants.HARVEST_BOOST_TRANCHES[2]);
            uint256 tranche4 = uint256(s.gameConstants.HARVEST_BOOST_TRANCHES[3]);
            if (t > 32) {
                // 200% to 250% linearly
                // boost = (200 + ((t - 32) / 32) * 50);
                boost = tranche1 + tranche2 + tranche3 + LibMath.mulu(LibMath.divu(t - 32, 32), tranche4);
            } else if (t > 16) {
                // 100% to 200% linearly
                // boost = 100 + ((t - 16) / 16) * 100;
                boost = tranche1 + tranche2 + LibMath.mulu(LibMath.divu(t - 16, 16), tranche3);
            } else if (t > 8) {
                // 25% to 100% linearly
                // boost = 25 + ((t - 8) / 8) * 75;
                boost = tranche1 + LibMath.mulu(LibMath.divu(t - 8, 8), tranche2);
            } else if (t > 1) {
                // 0% to 25% linearly
                // boost = 0 + (t / 8) * 25
                boost = LibMath.mulu(LibMath.divu(t, 8), tranche1);
            }
        }
        for (uint256 i = 0; i < tileIds.length; i++) {
            uint256 harvest = (block.timestamp - s.tiles[tileIds[i]].lastHarvestTimestamp) /
                numberOfSecondsForOneHarvest;
            harvest = LibMath.toUInt(LibMath.divu((harvest * 100) + (harvest * boost), 100));
            if (harvest > s.gameConstants.TILE_UPGRADE_MAX_HARVEST[uint256(upgrade)]) {
                harvest = s.gameConstants.TILE_UPGRADE_MAX_HARVEST[uint256(upgrade)];
            }
            // ground resources
            if (upgrade == LibTypes.TileUpgrade.SOUL_GENERATOR) {
                if (harvest > s.tileHarvestableGroundResources[tileIds[i]].souls) {
                    harvest = s.tileHarvestableGroundResources[tileIds[i]].souls;
                }
                s.tileHarvestableGroundResources[tileIds[i]].souls -= harvest;
                emit TileHarvestableGroundResourcesUpdated(tileIds[i], s.tileHarvestableGroundResources[tileIds[i]]);
            }
            s.tiles[tileIds[i]].lastHarvestTimestamp = uint32(block.timestamp);
            emit TileLastHarvestTimestampUpdated(tileIds[i], uint32(block.timestamp));
            totalHarvest += harvest;
        }
        if (upgrade == LibTypes.TileUpgrade.GOLD_GENERATOR) {
            _modifyResourceOfPlayer(__msgSender(), int256(totalHarvest), regionId, LibTypes.Resource.GOLD);
        } else if (upgrade == LibTypes.TileUpgrade.SOUL_GENERATOR) {
            _modifyResourceOfPlayer(__msgSender(), int256(totalHarvest), regionId, LibTypes.Resource.SOULS);
        } else if (upgrade == LibTypes.TileUpgrade.LAIR) {
            __healCreaturesOnRegion(player.player, regionId, totalHarvest);
        }
        emit PlayerUpdated(player.player, player);
    }

    function _modifyResourceStorageOfPlayer(
        address owner,
        LibTypes.TileUpgrade upgrade,
        bool decrease
    ) public {
        AppStorage storage s = getAppStorage();
        LibTypes.Player storage player = s.players[owner];
        int256 multiplier = decrease ? int256(-1) : int256(1);
        if (upgrade == LibTypes.TileUpgrade.DUNGEON_HEART) {
            player.maxGold = player.maxGold.addInt256(
                multiplier * int256(s.gameConstants.TILE_UPGRADE_GOLD_STORAGE[0])
            );
            player.maxSouls = player.maxSouls.addInt256(
                multiplier * int256(s.gameConstants.TILE_UPGRADE_SOUL_STORAGE[0])
            );
        } else if (upgrade == LibTypes.TileUpgrade.GOLD_STORAGE) {
            player.maxGold = player.maxGold.addInt256(
                multiplier * int256(s.gameConstants.TILE_UPGRADE_GOLD_STORAGE[1])
            );
            player.maxSouls = player.maxSouls.addInt256(
                multiplier * int256(s.gameConstants.TILE_UPGRADE_SOUL_STORAGE[1])
            );
        } else if (upgrade == LibTypes.TileUpgrade.SOUL_STORAGE) {
            player.maxGold = player.maxGold.addInt256(
                multiplier * int256(s.gameConstants.TILE_UPGRADE_GOLD_STORAGE[2])
            );
            player.maxSouls = player.maxSouls.addInt256(
                multiplier * int256(s.gameConstants.TILE_UPGRADE_SOUL_STORAGE[2])
            );
        } else if (upgrade == LibTypes.TileUpgrade.LAIR) {
            player.maxPopulation = player.maxPopulation.addInt256(
                multiplier * int256(s.gameConstants.POPULATION_PER_LAIR)
            );
        }
        emit PlayerUpdated(player.player, player);
    }
}
