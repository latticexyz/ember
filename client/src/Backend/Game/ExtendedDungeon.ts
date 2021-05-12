import * as ethers from "ethers";
import Dungeon from "../ETH/Dungeon";
import {
  TileDelayedAction,
  Tile,
  WorldCoord,
  HarvestableGroundResources,
  Region,
  Creature,
  EthAddress,
  TxType,
  DungeonEvent,
  Settlement,
} from "../../_types/GlobalTypes";
import { CheckedTypeUtils } from "../Utils/CheckedTypeUtils";
import { CreatureSpecies, CreatureType, TileUpgrade } from "../../_types/ContractTypes";
import Constants from "./Constants";
import { CoordMap } from "../../Utils/CoordMap";
import {
  manhattan,
  notNull,
  rangeStart,
  regionCoordToTileCoord,
  tileCoordToRegionCoord,
  tilesInRegion,
} from "../Utils/Utils";
import { REGION_LENGTH } from "../Utils/Defaults";
import { GameContracts } from "../ETH/NetworkConfig";
import Network from "../ETH/Network";
import { serializeWorldCoord, worldCoordsEq } from "../../Renderer/utils/worldCoords";
import { idToCoord } from "../Utils/PackedCoords";
import { Explorer } from "../Explorer/LazyExplorer";
import { Cache, Store } from "../Cache/Cache";
import { getDungeonHeartCacheKey } from "../Cache/utils";
import { Entries, addListener } from "../../Utils/Utils";
import { DungeonEvents } from "../ETH/types";

interface PerlinValues {
  gold: number;
  soul: number;
}

type RegionController = { controller: EthAddress; disputed: boolean };

export interface ExtendedDungeonMaps {
  coordToPerlinValues: CoordMap<PerlinValues>;
  regionControllers: CoordMap<RegionController>;
}

/**
 * Extending dungeon with simple access methods for increased convenience
 */
export class ExtendedDungeon extends Dungeon {
  public maps: ExtendedDungeonMaps;
  public explorer: Explorer;
  private dungeonEventListeners: Entries<DungeonEvents>[];

  private constructor(
    net: Network<GameContracts, TxType>,
    player: EthAddress,
    constants: Constants,
    explorer: Explorer,
    maps: ExtendedDungeonMaps
  ) {
    super(net, player, constants);
    this.explorer = explorer;
    this.maps = maps;
    this.dungeonEventListeners = [];
  }

  static async create(
    net: Network<GameContracts, TxType>,
    player: EthAddress,
    constants: Constants
  ): Promise<ExtendedDungeon> {
    if (!net.contracts) {
      throw new Error("The Network must first load the contracts");
    }

    const maps: ExtendedDungeonMaps = {
      coordToPerlinValues: new CoordMap<PerlinValues>(),
      regionControllers: new CoordMap<RegionController>(),
    };

    const explorer = await Explorer.create(maps.coordToPerlinValues, constants);
    const dungeon = new ExtendedDungeon(net, player, constants, explorer, maps);
    return dungeon;
  }

  public destroy(): void { }

  public getDelayedActionsAt(coord: WorldCoord): TileDelayedAction[] {
    return this.delayedActions.filter((d) => worldCoordsEq(d.coord, coord));
  }

  public getTileAt(coord: WorldCoord): Tile {
    return (
      this.tiles.get(coord) || {
        owner: CheckedTypeUtils.EMPTY_ADDRESS,
        lastHarvestTimestamp: 0,
        touchable: true,
        upgrade: TileUpgrade.NONE,
        isMined: false,
        isWalled: false,
      }
    );
  }

  public getRegionAt(coord: WorldCoord): Region {
    return (
      this.regions.get(coord) || {
        tiles: [],
        isMined: false,
        firstMiner: CheckedTypeUtils.EMPTY_ADDRESS,
        souls: 0,
        gold: 0,
        creatures: [],
        lastSpawnTimestamp: 0,
      }
    );
  }

  public async load(): Promise<void> {
    await super.load();
  }

  public getRegionController(regionCoord: WorldCoord): RegionController {
    return this.maps.regionControllers.get(regionCoord) || this.computeAndSaveRegionController(regionCoord);
  }

  public getSettlement(regionCoord: WorldCoord): { settlement: Settlement; regionCoord: WorldCoord; found: boolean } {
    for (const i of rangeStart(-1, 1)) {
      for (const j of rangeStart(-1, 1)) {
        const checkRegion = { x: regionCoord.x + i, y: regionCoord.y + j };
        const potentialSettlement = this.settlements.get(checkRegion);
        if (potentialSettlement) {
          if (potentialSettlement.level === 0 && worldCoordsEq(checkRegion, regionCoord)) {
            return { settlement: potentialSettlement, regionCoord: checkRegion, found: true };
          }
          if (potentialSettlement.level === 1 && manhattan(checkRegion, regionCoord) < 2) {
            return { settlement: potentialSettlement, regionCoord: checkRegion, found: true };
          }
          if (potentialSettlement.level === 2) {
            return { settlement: potentialSettlement, regionCoord: checkRegion, found: true };
          }
        }
      }
    }
    return {
      settlement: { lastEnergyUpdateTimestamp: 0, energy: 0, level: 0, owner: CheckedTypeUtils.EMPTY_ADDRESS },
      regionCoord: { x: 0, y: 0 },
      found: false,
    };
  }

  public getTilesInSettlement(regionCoord: WorldCoord): WorldCoord[] {
    const settlement = this.settlements.get(regionCoord);
    if (!settlement) {
      throw new Error("No settlement here " + JSON.stringify(regionCoord));
    }
    const tiles: WorldCoord[] = [];
    for (const i of rangeStart(-1, 1)) {
      for (const j of rangeStart(-1, 1)) {
        const checkRegion = { x: regionCoord.x + i, y: regionCoord.y + j };
        if (settlement.level === 0 && worldCoordsEq(checkRegion, regionCoord)) {
          tiles.push(...tilesInRegion(checkRegion));
        }
        if (settlement.level === 1 && manhattan(checkRegion, regionCoord) < 2) {
          tiles.push(...tilesInRegion(checkRegion));
        }
        if (settlement.level === 2) {
          tiles.push(...tilesInRegion(checkRegion));
        }
      }
    }
    return tiles;
  }

  public chargeEnergyForAction(tileCoord: WorldCoord, cost: number) {
    const regionCoord = tileCoordToRegionCoord(tileCoord);
    const { settlement, regionCoord: settlementRegionCoord } = this.getSettlement(regionCoord);
    if (!settlement) {
      throw new Error("no settlements there");
    }
    const newEnergy = settlement.energy - cost;
    this.setSettlement(settlementRegionCoord, {
      ...settlement,
      energy: newEnergy < 0 ? 0 : newEnergy,
    });
  }

  public updateCurrentEnergyFromChainTime(regionCoord: WorldCoord) {
    const settlement = this.settlements.get(regionCoord);
    if (!settlement) return;
    const energy = this.getSettlementEnergy(regionCoord);
    if (energy > settlement.energy) {
      console.log("updating energy of " + serializeWorldCoord(regionCoord) + " to " + energy);
      this.setSettlement(regionCoord, {
        ...settlement,
        energy,
        lastEnergyUpdateTimestamp: this.net.predictedChainTime,
      });
    }
  }

  public getSettlementEnergy(regionCoord: WorldCoord): number {
    const { settlement } = this.getSettlement(regionCoord);
    if (!settlement) {
      throw new Error("no settlement here " + serializeWorldCoord(regionCoord));
    }
    const energy =
      settlement.energy +
      Math.floor(
        Math.max(0, this.net.predictedChainTime - settlement.lastEnergyUpdateTimestamp) /
        this.constants.gameConstants.NUMBER_OF_SECONDS_FOR_ONE_ENERGY_REGEN
      );
    const maxEnergy = this.constants.gameConstants.MAX_ENERGY_PER_LEVEL[settlement.level];
    return Math.min(energy, maxEnergy);
  }

  private computeAndSaveRegionController(regionCoord: WorldCoord): RegionController {
    const zeroAddress = CheckedTypeUtils.address(ethers.constants.AddressZero);
    let maxInfluence = 0;
    let totalInfluence = 0;
    let playerWithMaxInfluence: EthAddress = zeroAddress;

    const influenceData = this.influenceDataByRegion.get(regionCoord);
    if (!influenceData) return { controller: zeroAddress, disputed: false };

    for (const [ethAddress, influence] of influenceData) {
      if (influence > maxInfluence) {
        maxInfluence = influence;
        playerWithMaxInfluence = ethAddress;
      }
      totalInfluence += influence;
    }

    if (maxInfluence < this.constants.gameConstants.MIN_INFLUENCE_FOR_CONTROL) {
      const regionController = { controller: zeroAddress, disputed: false };
      this.maps.regionControllers.set(regionCoord, regionController);
      return regionController;
    }

    if (maxInfluence * 2 <= totalInfluence) {
      const regionController = { controller: playerWithMaxInfluence, disputed: true };
      this.maps.regionControllers.set(regionCoord, regionController);
      return regionController;
    }

    const regionController = { controller: playerWithMaxInfluence, disputed: false };
    this.maps.regionControllers.set(regionCoord, regionController);
    return regionController;
  }

  public isResource(coord: WorldCoord) {
    const value = this.maps.coordToPerlinValues.get(coord);
    if (!value) {
      return null;
    }

    return {
      gold: value.gold >= this.constants.gameConstants.GOLD_PERLIN_THRESHOLD,
      soul: value.soul >= this.constants.gameConstants.SOUL_PERLIN_THRESHOLD,
      soulGround: value.soul >= this.constants.gameConstants.SOUL_GROUND_RESOURCE_PERLIN_THRESHOLD,
    };
  }

  public isGoldResource(coord: WorldCoord) {
    const value = this.maps.coordToPerlinValues.get(coord);
    if (!value) {
      return false;
    }
    return value.gold >= this.constants.gameConstants.GOLD_PERLIN_THRESHOLD;
  }

  public isSoulResource(coord: WorldCoord) {
    const value = this.maps.coordToPerlinValues.get(coord);
    if (!value) {
      return false;
    }
    return value.soul >= this.constants.gameConstants.SOUL_PERLIN_THRESHOLD;
  }

  public isSoulGroundResource(coord: WorldCoord) {
    const value = this.maps.coordToPerlinValues.get(coord);
    if (!value) {
      return false;
    }
    return value.soul >= this.constants.gameConstants.SOUL_GROUND_RESOURCE_PERLIN_THRESHOLD;
  }

  public hasGroundResources(coord: WorldCoord): HarvestableGroundResources | null {
    let harvestableGroundResources = this.tileHarvestableGroundResources.get(coord);
    if (harvestableGroundResources) {
      return harvestableGroundResources;
    }

    if (this.getTileAt(coord).isMined || !this.isSoulGroundResource(coord)) return null;

    harvestableGroundResources = {
      souls: this.constants.gameConstants.MAX_SOULS_HARVESTED_PER_SOUL_TILE,
    };

    this.tileHarvestableGroundResources.set(coord, harvestableGroundResources);
    return harvestableGroundResources;
  }

  public getHarvestBoost(coords: WorldCoord[]): number {
    const [tranche1, tranche2, tranche3, tranche4] = this.constants.gameConstants.HARVEST_BOOST_TRANCHES;

    const t = coords.length;

    if (t > 32) {
      // 200% to 250% linearly
      // boost = (200 + ((t - 32) / 32) * 50);
      return tranche1 + tranche2 + tranche3 + Math.floor(((t - 32) / 32) * tranche4);
    } else if (t > 16) {
      // 100% to 200% linearly
      // boost = 100 + ((t - 16) / 16) * 100;
      return tranche1 + tranche2 + Math.floor(((t - 16) / 16) * tranche3);
    } else if (t > 8) {
      // 25% to 100% linearly
      // boost = 25 + ((t - 8) / 8) * 75;
      return tranche1 + Math.floor(((t - 8) / 8) * tranche2);
    } else if (t > 1) {
      // 0% to 25% linearly
      // boost = 0 + (t / 8) * 25
      return Math.floor((t / 8) * tranche1);
    } else {
      return 0;
    }
  }

  /**
   * @param coords WorldCoords of the tile group to harvest. Expects it to be a connected group, but doesn't check.
   */
  public getHarvestableAmount(
    coords: WorldCoord[],
    upgrade: TileUpgrade
  ): CoordMap<{ individual: number; boost: number; capped: boolean }> {
    const harvestable = new CoordMap<{ individual: number; boost: number; capped: boolean }>();
    const cap = this.constants.gameConstants.TILE_UPGRADE_MAX_HARVEST[upgrade];
    const groupBoost = this.getHarvestBoost(coords);

    // Compute harvestable amount
    coords.forEach((coord) => {
      const chainTime = this.net.predictedChainTime;

      const lastHarvested = this.tiles.get(coord)?.lastHarvestTimestamp;
      if (lastHarvested == null) return;

      const numberOfSecondsForOneHarvest =
        this.constants.gameConstants.TILE_UPGRADE_NUMBER_OF_SECONDS_FOR_ONE_HARVEST[upgrade];

      let individual = Math.floor((chainTime - lastHarvested) / numberOfSecondsForOneHarvest);
      let boost = Math.floor((groupBoost / 100) * individual);
      let capped = false;

      // ground resources
      if (upgrade === TileUpgrade.SOUL_GENERATOR) {
        const harvestableGroundResource = this.tileHarvestableGroundResources.get(coord);
        if (!harvestableGroundResource) {
          console.error("this should not happen, the tile harvestable ground resource has not been found");
          return;
        }
        individual = Math.min(individual, harvestableGroundResource.souls);
        boost = Math.min(boost, harvestableGroundResource.souls - individual);
      }
      if (individual + boost > cap) {
        individual = cap;
        boost = 0;
        capped = true;
      }

      harvestable.set(coord, { individual, boost, capped });
    });

    return harvestable;
  }

  // TODO: add caching
  public getPlayerHero(address: EthAddress): { creature: Creature; id: string; found: boolean } {
    for (const [id, creature] of this.creatures.entries()) {
      if (creature.owner === address && creature.species === CreatureSpecies.HERO) {
        return { creature, id, found: true };
      }
    }
    return {
      creature: {
        owner: CheckedTypeUtils.EMPTY_ADDRESS,
        creatureType: CreatureType.NORMAL,
        species: CreatureSpecies.BALANCED,
        level: 0,
        life: 0,
        tileCoord: { x: 0, y: 0 },
      },
      id: "NONE",
      found: false,
    };
  }

  public getCreaturesInRegion(regionCoord: WorldCoord): Creature[] {
    const region = this.regions.get(regionCoord);
    const creatureIds = region?.creatures || [];
    const creatures = creatureIds.map((id) => this.creatures.get(id)).filter(notNull);
    return creatures;
  }

  public getLastSpawnTimestampInRegion(regionCoord: WorldCoord): number {
    const region = this.regions.get(regionCoord);
    return region?.lastSpawnTimestamp ?? 0;
  }

  public async getPlayerDungeonHeartRegion(address: EthAddress): Promise<WorldCoord> {
    const cache = Cache.getInstance();
    const cacheKey = getDungeonHeartCacheKey(address, this.net.diamondAddress);
    let dhCoord = await cache.getItem(Store.DungeonHeartRegions, cacheKey);
    if (dhCoord) return dhCoord;

    const iface = this.net.contracts.dungeonFacet.interface;
    const eth = this.net.getProvider();
    const logs = await eth.getLogs({
      address: this.net.diamondAddress,
      topics: this.net.contracts.dungeonFacet.filters.PlayerInitialized(address, null, null).topics,
      fromBlock: 0,
    });
    const events = logs.map((log) => iface.parseLog(log));
    const regionId = events[0].args[2].toString();
    dhCoord = idToCoord(regionId);
    cache.setItem(Store.DungeonHeartRegions, cacheKey, dhCoord);
    return dhCoord;
  }

  public async getPlayerDungeonHeart(address: EthAddress): Promise<WorldCoord> {
    const region = await this.getPlayerDungeonHeartRegion(address);
    const topLeftCorner = regionCoordToTileCoord(region);
    const dhCoord = {
      x: topLeftCorner.x + REGION_LENGTH / 2 - 2,
      y: topLeftCorner.y + REGION_LENGTH / 2 - 2,
    } as WorldCoord;
    return dhCoord;
  }

  protected setupEventListeners() {
    this.removeEventListeners();
    super.setupEventListeners();
    const dungeon = this as ExtendedDungeon;

    this.dungeonEventListeners = [
      addListener(dungeon, DungeonEvent.PlayerInfluenceInRegionUpdated, (player, regionCoord, amount) => {
        const previousRegionController =
          this.maps.regionControllers.get(regionCoord)?.controller || CheckedTypeUtils.EMPTY_ADDRESS;

        const newRegionController =
          this.computeAndSaveRegionController(regionCoord)?.controller || CheckedTypeUtils.EMPTY_ADDRESS;

        if (previousRegionController !== newRegionController) {
          this.emit(DungeonEvent.RegionControllerChanged, regionCoord, previousRegionController, newRegionController);
        }
      }),
    ];
  }

  protected removeEventListeners() {
    this.dungeonEventListeners.forEach((listener) => this.removeListener(...listener));
    this.dungeonEventListeners = [];
  }
}

export default ExtendedDungeon;
