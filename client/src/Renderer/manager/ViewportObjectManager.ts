import EventEmitter from "events";
import { ViewportGameObject, isMovable } from "../objects/ViewportGameObject";
import { WorldCoord } from "../../_types/GlobalTypes";
import { createStrictEventEmitterClass, tileCoordToRegionCoord } from "../../Backend/Utils/Utils";
import { ViewportObjectManagerEvent } from "../../_types/ContractTypes";
import { DynamicObjectRegistry } from "../utils/dynamicObjectRegistry";
import { ViewportManager } from "./ViewportManager";
import { Service } from "../game";

interface ViewportObjectManagerEvents {
  [ViewportObjectManagerEvent.ViewportObjectSpawned]: (creatureId: string) => void;
  [ViewportObjectManagerEvent.ViewportObjectDespawned]: (creatureId: string) => void;
}

/**
 * This class contains the single source of truth for client object locations.
 * Never move a dynamic game object directly, but always use the functions in this class.
 */
export class ViewportObjectManager extends createStrictEventEmitterClass<ViewportObjectManagerEvents>() implements Service {
  // keeps track of all registered game objects
  public objectRegistry = new DynamicObjectRegistry<ViewportGameObject>();

  // keeps track of currently spawned objects to efficiently update only those
  private spawnedObjectIds = new Map<string, boolean>();

  private viewportManager: ViewportManager;

  constructor(viewportManager: ViewportManager) {
    super();
    this.viewportManager = viewportManager;

    viewportManager.setOnViewportChange((viewport, currentRegions, addedRegions, removedRegions) => {
      if (addedRegions.length > 0) {
        this.spawnObjectsInRegions(addedRegions);
      }
      if (removedRegions.length > 0) {
        this.despawnObjectsInRegions(removedRegions);
      }
    });
  }

  bootService(_: Phaser.Scene) { }

  destroyService() {
    this.objectRegistry.delete();
    this.spawnedObjectIds.clear();
  }

  public add(object: ViewportGameObject, coord: WorldCoord) {
    let isNewObject = false;
    if (!this.objectRegistry.getObjectById(object.id)) {
      this.objectRegistry.addObject(object, coord);
      isNewObject = true;
    }

    if (this.viewportManager.isTileInViewport(coord) && !object.isSpawned) {
      this.spawnObject(object.id, isNewObject);
    }
  }

  public remove(id: string) {
    const object = this.objectRegistry.getObjectById(id);
    if (!object) return;
    object.despawn(true);
    this.objectRegistry.deleteObject(id);
  }

  public update() {
    for (const id of this.spawnedObjectIds.keys()) {
      const object = this.objectRegistry.getObjectById(id);
      object?.update();
    }
  }

  public has(id: string): boolean {
    return Boolean(this.objectRegistry.getCoordById(id));
  }

  /**
   * Updates the location of the ViewportObject.
   * Handles moving objects in and out of the viewport and spawn/despawn accordingly.
   * @param id ID of the object to move to a new location
   * @param to TileCoord to move to
   * @param speed Speed of the move in milliseconds
   */
  public moveObject(id: string, to: WorldCoord, speed?: number) {
    this.objectRegistry.moveObject(id, to);

    const objectIsSpawned = this.isObjectSpawned(id);
    const object = objectIsSpawned ? this.objectRegistry.getObjectById(id) : null;

    if (this.viewportManager.isRegionInViewport(tileCoordToRegionCoord(to))) {
      if (objectIsSpawned) {
        object && isMovable(object) && object.typedGameObject.object.moveTo(to, speed);
      } else {
        this.spawnObject(id);
      }
    } else {
      if (objectIsSpawned) {
        object && isMovable(object) && object.typedGameObject.object.moveTo(to, speed);
        this.despawnObject(id);
      }
    }
  }

  public getSpawnedObjectById(id: string): ViewportGameObject | undefined {
    if (this.spawnedObjectIds.get(id)) {
      return this.objectRegistry.getObjectById(id);
    }
  }

  public getSpawnedObjectIds(): string[] {
    return [...this.spawnedObjectIds.keys()];
  }

  public isObjectSpawned(id: string): boolean {
    return Boolean(this.spawnedObjectIds.get(id));
  }

  private getObjectsInRegions(regionCoords: WorldCoord[]) {
    const objects: ViewportGameObject[] = [];

    for (const regionCoord of regionCoords) {
      objects.push(...this.objectRegistry.getObjectsInRegion(regionCoord));
    }

    return objects;
  }

  private spawnObjectsInRegions(regionCoords: WorldCoord[]) {
    const objects = this.getObjectsInRegions(regionCoords);

    for (const object of objects) {
      if (!object.isSpawned) {
        this.spawnObject(object.id);
      }
    }
  }

  private despawnObjectsInRegions(regionCoords: WorldCoord[]) {
    const objects = this.getObjectsInRegions(regionCoords);
    for (const object of objects) {
      if (object.isSpawned) {
        this.despawnObject(object.id);
      }
    }
  }

  private spawnObject(id: string, isNewObject?: boolean) {
    const object = this.objectRegistry.getObjectById(id)!;
    if (object.isSpawned) object.despawn();

    const location = this.objectRegistry.getCoordById(id);
    object.spawn(location, isNewObject);
    this.spawnedObjectIds.set(object.id, true);
    this.emit(ViewportObjectManagerEvent.ViewportObjectSpawned, id);
  }

  private despawnObject(id: string) {
    const object = this.objectRegistry.getObjectById(id)!;
    object.despawn();
    this.emit(ViewportObjectManagerEvent.ViewportObjectDespawned, id);
    this.spawnedObjectIds.delete(object.id);
  }
}
