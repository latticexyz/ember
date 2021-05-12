import { WithId, WorldCoord } from "../../_types/GlobalTypes";
import { CoordMap } from "../../Utils/CoordMap";
import { tileCoordToRegionCoord } from "../../Backend/Utils/Utils";
import { v4 } from "uuid";

/**
 * A registry to register registries
 * (To get all objects in a region from different registries)
 */
export class MetaRegistry<T extends WithId> {
  private registries: { [id: string]: ObjectRegistry<T> };

  constructor() {
    this.registries = {};
  }

  public getObjectsAtCoord(coord: WorldCoord) {
    return Object.values(this.registries)
      .map((registry) => registry.getObjectsAtCoord(coord))
      .flat(1);
  }

  public getObjectsInRegion(regionCoord: WorldCoord) {
    return Object.values(this.registries)
      .map((registry) => registry.getObjectsInRegion(regionCoord))
      .flat(1);
  }

  public addRegistry(registry: ObjectRegistry<T>) {
    this.registries[registry.id] = registry;
  }

  public removeRegistry(registry: ObjectRegistry<T>) {
    delete this.registries[registry.id];
  }
}

export class ObjectRegistry<T extends WithId> {
  // mapping tile coords to objects on them
  protected coordToObjects: CoordMap<T[]>;

  // mapping region coords to objects in them
  protected regionCoordToObjects: CoordMap<T[]>;

  // mapping object ids to their current tile coord
  protected idToCoord: Map<string, WorldCoord>;

  // id to identify the registry (eg. in MetaRegistry)
  public id: string;

  constructor() {
    this.coordToObjects = new CoordMap<T[]>({ defaultValue: [] });
    this.regionCoordToObjects = new CoordMap<T[]>({ defaultValue: [] });
    this.idToCoord = new Map<string, WorldCoord>();
    this.id = v4();
  }

  public addObject(object: T, coord: WorldCoord) {
    const objectsAtCoord = this.coordToObjects.get(coord)!.filter((o) => o.id !== object.id);
    this.coordToObjects.set(coord, [...objectsAtCoord, object]);
    this.idToCoord.set(object.id, coord);

    const regionCoord = tileCoordToRegionCoord(coord);
    const objectsInRegion = this.regionCoordToObjects.get(regionCoord)!.filter((o) => o.id !== object.id);
    this.regionCoordToObjects.set(regionCoord, [...objectsInRegion, object]);
  }

  public getObjectsAtCoord(coord: WorldCoord): T[] {
    return this.coordToObjects.get(coord) || [];
  }

  public getObjectsInRegion(regionCoord: WorldCoord): T[] {
    return this.regionCoordToObjects.get(regionCoord)!;
  }

  public deleteObject(id: string) {
    const coord = this.idToCoord.get(id);
    if (!coord) return;

    const objectsAtCoord = this.coordToObjects.get(coord)!;
    this.idToCoord.delete(id);
    const newObjectsAtCoord = objectsAtCoord.filter((o) => o.id !== id);
    if (newObjectsAtCoord.length === 0) {
      this.coordToObjects.delete(coord);
    } else {
      this.coordToObjects.set(coord, newObjectsAtCoord);
    }

    const regionCoord = tileCoordToRegionCoord(coord);
    const objectsInRegion = this.regionCoordToObjects.get(regionCoord)!;
    const newObjectsInRegion = objectsInRegion.filter((o) => o.id !== id);
    if (newObjectsInRegion.length === 0) {
      this.regionCoordToObjects.delete(regionCoord);
    } else {
      this.regionCoordToObjects.set(
        regionCoord,
        objectsInRegion.filter((o) => o.id !== id)
      );
    }
  }

  public getObjectById(id: string) {
    const coord = this.idToCoord.get(id);
    if (!coord) return undefined;
    const objectsAtCoord = this.coordToObjects.get(coord)!;
    return objectsAtCoord.find((object) => object.id === id);
  }

  public getCoordById(id: string) {
    return this.idToCoord.get(id);
  }

  public delete() {
    this.coordToObjects.map.clear();
    this.regionCoordToObjects.map.clear();
    this.idToCoord.clear();
  }
}
