import { EventEmitter } from "events";
import { CoordMap } from "../../Utils/CoordMap";
import { WorldCoord, PerlinValues, ExplorerEvent } from "../../_types/GlobalTypes";
import { createStrictEventEmitterClass, concatCoordMap } from "../Utils/Utils";
import { Cache, Store } from "../Cache/Cache";
import Constants from "../Game/Constants";
import { ExplorerWorker } from "./worker";
import { spawn } from "threads";
import { getSurroundingCoords } from "../Utils/WorldCoords";

export interface ExplorerEvents {
  [ExplorerEvent.PerlinExplored]: (region: WorldCoord) => void;
}

export class Explorer extends createStrictEventEmitterClass<ExplorerEvents>() {
  private cache: Cache;
  private worker: ExplorerWorker;
  private perlinMap: CoordMap<PerlinValues>;
  private constants: Constants;
  private exploredRegions: CoordMap<boolean>;
  private regionsToExplore: WorldCoord[];
  private priorityRegionsToExplore: WorldCoord[];
  private exploring: boolean;

  constructor(cache: Cache, worker: ExplorerWorker, perlinMap: CoordMap<PerlinValues>, constants: Constants) {
    super();
    this.cache = cache;
    this.worker = worker;
    this.perlinMap = perlinMap;
    this.constants = constants;
    this.exploredRegions = new CoordMap<boolean>();
    this.regionsToExplore = [];
    this.priorityRegionsToExplore = [];
    this.exploring = false;
  }

  public static async create(perlinMap: CoordMap<PerlinValues>, constants: Constants) {
    //@ts-ignore
    const worker: any = await spawn(new Worker(new URL("./worker.ts", import.meta.url)));
    const cache = Cache.getInstance();
    return new Explorer(cache, worker, perlinMap, constants);
  }

  private async exploreRegion(regionCoord: WorldCoord) {
    if (this.exploredRegions.get(regionCoord)) return;
    this.exploredRegions.set(regionCoord, true);

    const regionId = CoordMap.constructKey(regionCoord);
    let perlinValues = await this.cache.getItem(Store.PerlinValues, regionId);

    if (!perlinValues) {
      perlinValues = await this.worker.explorePerlinInRegion(
        regionCoord,
        this.constants.perlinConfig1,
        this.constants.perlinConfig2
      );
      this.cache.setItem(Store.PerlinValues, regionId, perlinValues);
    }

    // We only receive the raw data as an object, not as a CoordMap, from both the worker and the cache
    perlinValues = CoordMap.from(perlinValues);
    concatCoordMap(this.perlinMap, perlinValues);

    this.emit(ExplorerEvent.PerlinExplored, regionCoord);
  }

  public async processRegionsToExplore() {
    if (this.exploring) return;
    this.exploring = true;

    while (this.priorityRegionsToExplore.length + this.regionsToExplore.length > 0) {
      const current = this.priorityRegionsToExplore.pop() || this.regionsToExplore.pop()!;
      await this.exploreRegion(current);
    }

    this.exploring = false;
  }

  public async addRegionsToExplore(regionCoords: WorldCoord[], priority?: boolean) {
    const regionsToExplore = new CoordMap<boolean>();
    for (const region of regionCoords) regionsToExplore.set(region, true);

    const center = regionCoords[Math.floor(regionCoords.length / 2)];
    const queue: WorldCoord[] = [center];
    regionsToExplore.delete(center);

    while (regionsToExplore.size > 0 || queue.length > 0) {
      let current = queue.shift();
      if (!current) current = regionsToExplore.coords()[Math.floor(regionsToExplore.size / 2)]!;

      priority ? this.priorityRegionsToExplore.push(current) : this.regionsToExplore.push(current);

      const neighbors = getSurroundingCoords(current, 1);
      for (const neighbor of neighbors) {
        if (regionsToExplore.get(neighbor)) {
          queue.push(neighbor);
          regionsToExplore.delete(neighbor);
        }
      }
    }

    this.processRegionsToExplore();
  }
}
