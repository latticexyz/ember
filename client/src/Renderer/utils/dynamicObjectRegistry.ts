import { WithId, WorldCoord } from "../../_types/GlobalTypes";
import { CoordMap } from "../../Utils/CoordMap";
import { tileCoordToRegionCoord } from "../../Backend/Utils/Utils";
import { worldCoordsEq } from "./worldCoords";
import { ObjectRegistry } from "./objectRegistry";

export class DynamicObjectRegistry<T extends WithId> extends ObjectRegistry<T> {
  // Sometimes we send objects to a non-adjacent tile.
  // Since they move from tile to tile, it takes a while for them to arrive at their final destination.
  // In scheduledCoords we keep track of those final destinations before the objects arrive,
  // so that we can avoid sending multiple objects to the same final destination.
  private soonToBeOccupiedCoords: CoordMap<boolean>;

  private scheduledMoves: Map<string, WorldCoord>;

  constructor() {
    super();
    this.soonToBeOccupiedCoords = new CoordMap<boolean>();
    this.scheduledMoves = new Map<string, WorldCoord>();
  }

  public delete() {
    this.soonToBeOccupiedCoords.map.clear();
    this.scheduledMoves.clear();
    super.delete();
  }

  public addObject(object: T, coord: WorldCoord) {
    this.soonToBeOccupiedCoords.delete(coord);
    super.addObject(object, coord);
  }

  public scheduleMoveTo(to: WorldCoord, id: string) {
    this.scheduledMoves.set(id, to);
    this.soonToBeOccupiedCoords.set(to, true);
  }

  public getSoonToBeOccupiedCoords(): WorldCoord[] {
    return this.soonToBeOccupiedCoords.coords();
  }

  public moveObject(id: string, to: WorldCoord) {
    this.soonToBeOccupiedCoords.delete(to);
    const from = this.idToCoord.get(id);
    if (!from) {
      console.warn("This object is not registered", id);
      return;
    }

    this.idToCoord.set(id, to);

    // Update coord map
    const oldObjectsAtTo = this.coordToObjects.get(to)!;
    const oldObjectsAtFrom = this.coordToObjects.get(from)!;
    const object = oldObjectsAtFrom.find((o) => o.id === id);
    if (!object) {
      console.warn("Can't find object with id " + id);
      return;
    }

    const newObjectsAtFrom = oldObjectsAtFrom.filter((o) => o.id !== id);
    const newObjectsAtTo = [...oldObjectsAtTo, object];

    if (newObjectsAtFrom.length === 0) {
      this.coordToObjects.delete(from);
    } else {
      this.coordToObjects.set(from, newObjectsAtFrom);
    }
    this.coordToObjects.set(to, newObjectsAtTo);

    // Update region map
    const fromRegion = tileCoordToRegionCoord(from);
    const toRegion = tileCoordToRegionCoord(to);
    if (!worldCoordsEq(fromRegion, toRegion)) {
      const oldObjectsAtToRegion = this.regionCoordToObjects.get(toRegion)!;
      const oldObjectsAtFromRegion = this.regionCoordToObjects.get(fromRegion)!;

      const newObjectsAtToRegion = [...oldObjectsAtToRegion, object];
      const newObjectsAtFromRegion = oldObjectsAtFromRegion.filter((o) => {
        return o.id !== id;
      });

      if (newObjectsAtFromRegion.length === 0) {
        this.regionCoordToObjects.delete(fromRegion);
      } else {
        this.regionCoordToObjects.set(fromRegion, newObjectsAtFromRegion);
      }
      this.regionCoordToObjects.set(toRegion, newObjectsAtToRegion);
    }

    // Update scheduled moves
    const scheduledMove = this.scheduledMoves.get(id);
    if (scheduledMove && worldCoordsEq(scheduledMove, to)) {
      this.scheduledMoves.delete(id);
    }
  }

  public getScheduledMoveById(id: string) {
    return this.scheduledMoves.get(id);
  }
}
