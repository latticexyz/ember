import { Area, WorldCoord } from "../../_types/GlobalTypes";
import { CoordMap } from "../../Utils/CoordMap";
import { getRegionsInAreaMap, areaEq, areAreasOverlapping, extendArea, areaFromRegion } from "../utils/area";
import { v4 } from "uuid";
import { l2 } from "../../Backend/Utils/Utils";
import { Service } from "../game";

export class ViewportManager implements Service {
  private viewport: Area;
  private regionsInViewport: CoordMap<boolean>;
  private onViewportChangeCallbacks: {
    [id: string]: (
      viewport: Area,
      currentRegions: CoordMap<boolean>,
      addedRegions: WorldCoord[],
      removedRegions: WorldCoord[]
    ) => void;
  };

  constructor() {
    this.viewport = { tileX: 0, tileY: 0, width: 0, height: 0 };
    this.regionsInViewport = new CoordMap<boolean>();
    this.onViewportChangeCallbacks = {};
  }

  bootService(_: Phaser.Scene) { }

  destroyService() {
    this.regionsInViewport.map.clear();
    this.onViewportChangeCallbacks = {};
  }

  public setOnViewportChange(
    callback: (
      viewport: Area,
      currentRegions: CoordMap<boolean>,
      addedRegions: WorldCoord[],
      removedRegions: WorldCoord[]
    ) => void
  ) {
    const id = v4();
    this.onViewportChangeCallbacks[id] = callback;
    return id;
  }

  public setViewport(viewport: Area) {
    if (areaEq(viewport, this.viewport)) return;

    this.viewport = { ...viewport };
    const currentRegionsMap = getRegionsInAreaMap(this.viewport);
    const currentRegionsArray = currentRegionsMap.coords();
    const addedRegions: WorldCoord[] = [];
    const removedRegions: WorldCoord[] = [];

    // If it exists now but didn't exist before, add it to added regions
    for (const region of currentRegionsArray) {
      if (!this.regionsInViewport.get(region)) {
        addedRegions.push(region);
      }
    }

    // If it existed before but not now, add it to removed regions
    for (const region of this.regionsInViewport.coords()) {
      if (!currentRegionsMap.get(region)) {
        removedRegions.push(region);
      }
    }

    this.regionsInViewport = currentRegionsMap;
    this.onViewportChange(viewport, currentRegionsMap, addedRegions, removedRegions);
    this.regionsInViewport = getRegionsInAreaMap(this.viewport);
  }

  public getViewport(): Area {
    return this.viewport;
  }

  public getRegionsInViewportMap(): CoordMap<boolean> {
    return this.regionsInViewport;
  }

  public getRegionsInViewportArray(): WorldCoord[] {
    return this.regionsInViewport.coords();
  }

  public isAreaInViewport(area: Area, padding: number = 0) {
    return areAreasOverlapping(extendArea(area, padding), this.viewport);
  }

  public isTileInViewport(tileCoord: WorldCoord, padding: number = 0): boolean {
    return (
      tileCoord.x >= this.viewport.tileX - padding &&
      tileCoord.y >= this.viewport.tileY - padding &&
      tileCoord.x <= this.viewport.tileX + this.viewport.width + padding &&
      tileCoord.y <= this.viewport.tileY + this.viewport.height + padding
    );
  }

  public isRegionInViewport(regionCoord: WorldCoord): boolean {
    return Boolean(this.regionsInViewport.get(regionCoord));
  }

  private onViewportChange(
    viewport: Area,
    currentRegions: CoordMap<boolean>,
    addedRegions: WorldCoord[],
    removedRegions: WorldCoord[]
  ) {
    for (const callback of Object.values(this.onViewportChangeCallbacks)) {
      callback(viewport, currentRegions, addedRegions, removedRegions);
    }
  }

  public getViewportCenter(): WorldCoord {
    return {
      x: this.viewport.tileX + Math.floor(this.viewport.width / 2),
      y: this.viewport.tileY + Math.floor(this.viewport.height / 2),
    };
  }

  public getDistanceToViewportCenter(coord: WorldCoord) {
    const viewportCenter = this.getViewportCenter();
    return l2(viewportCenter, coord);
  }

  /**
   * Returns proximity of the given coord to the viewport center (between 0 and 1)
   * @param coord: Tile to get proximity for
   */
  public getProximityToViewportCenter(coord: WorldCoord, padding: number = 0) {
    const distance = this.getDistanceToViewportCenter(coord);
    const radius = Math.ceil(Math.max(this.viewport.height, this.viewport.width) / 2) + padding;
    if (radius === 0) return 0;
    return Math.max((radius - distance) / radius, 0);
  }

  public getPanFromViewportCenter(coord: WorldCoord, padding: number = 0) {
    const viewportCenter = this.getViewportCenter();
    const distance = coord.x - viewportCenter.x;
    const maxDistance = this.viewport.width / 2 + padding;
    return distance / maxDistance;
  }
}
