import { WorldCoord, WithId, EthAddress } from "../../_types/GlobalTypes";
import { DIRECTIONS } from "../../Utils/Utils";
import { ViewportObjectManager } from "./ViewportObjectManager";
import GameManager from "../../Backend/Game/GameManager";
import { MoveType } from "../objects/main/gridUnit";
import { worldCoordsEq } from "../utils/worldCoords";
import { aStar, checkInRange, tileCoordToRegionCoord } from "../../Backend/Utils/Utils";
import { TileUpgrade } from "../../_types/ContractTypes";
import {
  StaticViewportGameObjectType,
  ViewportGameObject,
  ViewportGameObjectUnionType
} from "../objects/ViewportGameObject";
import { GroupRegistry } from "../utils/groupRegistry";
import { hasActiveTile } from "./ActiveTileManager";
import { Service } from "../game";
import MainScene from "../scenes/mainScene";

const MAX_TICK = 100000;

export enum UnitType {
  Imp,
  Creature,
}

interface UnitConfig {
  workMoveDuration: number;
  randomMoveDuration: number;
  randomMoveProbability: number;
  avoidPeers: boolean;
  avoidPeersDuringRandomWalk: boolean;
  avoidLoadingTiles: boolean;
  avoidUpgrades: boolean;
  stepOnDestinationTile: boolean;
  stepOverWalls: boolean;
}

const UnitConfig: { [type in UnitType]: UnitConfig } = {
  [UnitType.Imp]: {
    workMoveDuration: 200,
    randomMoveDuration: 500,
    randomMoveProbability: 0.4,
    avoidPeers: true,
    avoidPeersDuringRandomWalk: true,
    avoidLoadingTiles: true,
    avoidUpgrades: true,
    stepOnDestinationTile: false,
    stepOverWalls: false,
  },
  [UnitType.Creature]: {
    workMoveDuration: 200,
    randomMoveDuration: 1000,
    randomMoveProbability: 0.1,
    avoidPeers: false,
    avoidPeersDuringRandomWalk: true,
    avoidLoadingTiles: false,
    avoidUpgrades: true,
    stepOnDestinationTile: true,
    stepOverWalls: true,
  },
};

/**
 * Takes care of random unit moves and moving units along a path.
 * Calls methods on ViewportObjectManager to move the game objects.
 */
export class UnitMoveManager implements Service {
  private gm: GameManager = GameManager.getInstance();

  private tick: number = 0;
  private paths = new Map<string, WorldCoord[]>();
  private units = new Map<string, UnitType>();
  private owners = new Map<string, EthAddress>();
  private lastMoves = new Map<string, number>();
  private rnd: Phaser.Math.RandomDataGenerator = new Phaser.Math.RandomDataGenerator();

  private pathEndActions = new Map<string, (unit?: ViewportGameObjectUnionType["object"]) => void>();
  private tileMap: Phaser.Tilemaps.Tilemap; // Reference to 'main map' tilemap.

  public plannedPaths = new Map<string, WorldCoord[]>();

  constructor(private viewportObjectManager: ViewportObjectManager, private groupRegistry: GroupRegistry) { }

  bootService(scene: MainScene) {
    this.tileMap = scene.gameMap.map;
  }

  destroyService() {
    this.pathEndActions.clear();
    this.paths.clear();
    this.units.clear();
    this.lastMoves.clear();
    this.plannedPaths.clear();
    this.owners.clear();
  }

  /**
   * Returns true if the grid unit is allowed to move to the given coordinate
   * @param coord TileCoord to check
   * @param panic Allow grid units to step on peers in panic mode
   */
  private canMoveToTile(unitId: string, coord: WorldCoord, moveType: MoveType, panic?: boolean): boolean {
    const unitType = this.units.get(unitId)!;
    const creatureOwner = this.owners.get(unitId)!;
    const config = UnitConfig[unitType];
    const tile = this.gm.extendedDungeon.getTileAt(coord);
    const contractUnit = this.gm.extendedDungeon.creatures.get(unitId);

    if (!tile.isMined) return false;

    // Allow grid units to step on peers in panic mode
    const isBlockedByPeer =
      config.avoidPeersDuringRandomWalk &&
      !panic &&
      this.viewportObjectManager.objectRegistry.getObjectsAtCoord(coord).length > 0;
    if (isBlockedByPeer) return false;

    const isBlockedByUpgrade =
      config.avoidUpgrades && !panic && this.gm.extendedDungeon.getTileAt(coord).upgrade !== TileUpgrade.NONE;
    if (isBlockedByUpgrade) return false;
    const isBlockedByWall = config.stepOverWalls ? tile.isWalled && tile.owner !== creatureOwner : tile.isWalled;
    if (isBlockedByWall) return false;

    const isBlockedByLoadingTile = hasActiveTile(this.viewportObjectManager, coord);
    if (isBlockedByLoadingTile) return false;

    const hasPathVisualization =
      unitType === UnitType.Creature && moveType === MoveType.Random && this.plannedPaths.get(unitId);
    if (hasPathVisualization) return false;

    if (unitType === UnitType.Creature && contractUnit && moveType === MoveType.Random) {
      const validRegion = worldCoordsEq(tileCoordToRegionCoord(coord), tileCoordToRegionCoord(contractUnit.tileCoord));
      return validRegion;
    }

    // Imps should not walk in enemy regions
    if (!panic && unitType === UnitType.Imp && moveType === MoveType.Random) {
      const { controller, disputed } = this.gm.extendedDungeon.getRegionController(tileCoordToRegionCoord(coord));
      return !disputed && controller === creatureOwner;
    }

    return true;
  }

  private moveToRandomValidDirection(unitId: string): WorldCoord | undefined {
    const pos = this.viewportObjectManager.objectRegistry.getCoordById(unitId);
    if (!pos) return;
    const unitType = this.units.get(unitId)!;
    const config = UnitConfig[unitType];

    // random moves
    const roll = this.rnd.frac();
    const steppedOnPeer = this.viewportObjectManager.objectRegistry.getObjectsAtCoord(pos).length > 1;

    if (steppedOnPeer || roll < config.randomMoveProbability) {
      // random valid direction
      const validDirections: number[] = [];
      DIRECTIONS.forEach((direction, index) => {
        if (this.canMoveToTile(unitId, { x: pos.x + direction.x, y: pos.y + direction.y }, MoveType.Random)) {
          validDirections.push(index);
        }
      });

      if (validDirections.length === 0) {
        if (!steppedOnPeer) return;

        // If steppedOnPeer, also allow stepping on peers to escape
        DIRECTIONS.forEach((direction, index) => {
          const destination = { x: pos.x + direction.x, y: pos.y + direction.y };
          if (this.canMoveToTile(unitId, destination, MoveType.Random, true)) {
            validDirections.push(index);
          }
        });

        if (validDirections.length === 0) return;
      }

      const randomDirectionIndex = this.rnd.pick(validDirections);

      if ((this.tick % randomDirectionIndex) * 100 === 0) {
        const typedGameObject = this.viewportObjectManager.getSpawnedObjectById(unitId)?.typedGameObject;
        if (typedGameObject && (typedGameObject.type === UnitType.Creature || typedGameObject.type === UnitType.Imp)) {
          if (typedGameObject.object.sprite.flipX === true) {
            typedGameObject.object.sprite.flipX = false;
          } else {
            typedGameObject.object.sprite.flipX = true;
          }
        }
      }

      const randomDirection = DIRECTIONS[randomDirectionIndex];
      const destination = { x: pos.x + randomDirection.x, y: pos.y + randomDirection.y };
      this.viewportObjectManager.moveObject(unitId, destination, config.randomMoveDuration);
    }
  }

  private moveAlongPath(id: string, path: WorldCoord[]) {
    const [next, ...remaining] = path;
    const unitType = this.units.get(id)!;
    const config = UnitConfig[unitType];

    const blockedByPeer =
      config.avoidPeers && this.viewportObjectManager.objectRegistry.getObjectsAtCoord(next).length > 0;

    const blockedByLoadingTile = config.avoidLoadingTiles && hasActiveTile(this.viewportObjectManager, next);

    const isBlockedByUpgrade =
      config.avoidUpgrades && this.gm.extendedDungeon.getTileAt(next).upgrade !== TileUpgrade.NONE;

    // we make sure that the last coord in the path is not subject to the restrictions above
    if ((!blockedByPeer && !blockedByLoadingTile && !isBlockedByUpgrade) || remaining.length === 0) {
      this.viewportObjectManager.moveObject(id, next, config.workMoveDuration);
      this.lastMoves.set(id, Date.now());
    }

    this.paths.set(id, remaining);
  }

  private getCreaturePathIds(creatureId: string) {
    return ["path0/" + creatureId, "path1/" + creatureId];
  }

  public setPath(
    id: string,
    path: WorldCoord[],
    pathEndAction?: (unit?: ViewportGameObjectUnionType["object"]) => void
  ) {
    this.paths.set(id, path);
    this.deletePlannedPath(id);
    if (pathEndAction) this.pathEndActions.set(id, pathEndAction);
  }

  public clearPath(id: string) {
    this.paths.delete(id);
    this.deletePlannedPath(id);
    this.pathEndActions.delete(id);
  }

  public setPlannedDestination(id: string, destination: WorldCoord, creatureOwner: EthAddress) {
    const currentPosition = this.viewportObjectManager.objectRegistry.getCoordById(id);
    if (!currentPosition) return;

    const rangeCheck = checkInRange(this.gm.constants.MAX_X, this.gm.constants.MAX_Y);
    const isValidTile = (coord: WorldCoord): boolean => {
      if (!rangeCheck(coord)) return false;
      const tile = this.gm.extendedDungeon.getTileAt(coord);
      return tile.isMined && (!tile.isWalled || tile.owner === creatureOwner);
    };

    const currentTile = this.viewportObjectManager.objectRegistry.getCoordById(id)!;
    const path = aStar(currentTile, destination, this.gm.extendedDungeon, isValidTile);
    if (!path) {
      return;
    }

    this.setPlannedPath(id, path);
  }

  public setPlannedPath(id: string, path: WorldCoord[]) {
    this.plannedPaths.set(id, path);
    const pathIds = this.getCreaturePathIds(id);

    const methods = (pathId: string) => ({
      spawn: () => {
        const creaturePath = this.groupRegistry.groups.creaturePath.get();
        creaturePath.init(this.tileMap);
        creaturePath.setPath(path);
        return { object: creaturePath, type: StaticViewportGameObjectType.CreaturePath };
      },
      despawn: () => {
        let typedGameObject = this.viewportObjectManager.getSpawnedObjectById(pathId)?.typedGameObject;
        if (typedGameObject && typedGameObject.type === StaticViewportGameObjectType.CreaturePath) {
          this.groupRegistry.groups.creaturePath.killAndHide(typedGameObject.object);
          typedGameObject.object.destroy();
        }
      },
      update: () => { },
    });

    // Adding two path visualizations to the viewport object manager, one that shows up if the start coord is
    // in the viewport and one that shows up if the end coord is in the viewport. We could think about adding
    // support for multi-coord objects to the viewport object manager in the future, but for now this is the
    // only use case and would require very deep changes to the viewport object manager.
    this.viewportObjectManager.add(new ViewportGameObject(pathIds[0], methods(pathIds[0])), path[0]);
    this.viewportObjectManager.add(new ViewportGameObject(pathIds[1], methods(pathIds[1])), path[path.length - 1]);
  }

  public deletePlannedPath(id: string) {
    this.plannedPaths.delete(id);
    for (const pathId of this.getCreaturePathIds(id)) {
      this.viewportObjectManager.remove(pathId);
    }
  }

  public registerUnit(id: string, type: UnitType, owner: EthAddress) {
    this.units.set(id, type);
    this.owners.set(id, owner);
  }

  public deregisterUnit(id: string) {
    this.units.delete(id);
    this.paths.delete(id);
    this.deletePlannedPath(id);
    this.lastMoves.delete(id);
  }

  public update() {
    this.tick = this.tick + 1;
    this.tick = this.tick % MAX_TICK;

    const unitIds = this.units.keys();

    const now = Date.now();
    for (const id of unitIds) {
      const path = this.paths.get(id);
      const unitType = this.units.get(id);
      if (unitType === undefined) continue;

      const config = UnitConfig[unitType];
      const lastMove = this.lastMoves.get(id) || 0;
      const timeSinceLastMove = now - lastMove;
      const typedGameObject = this.viewportObjectManager.getSpawnedObjectById(id)?.typedGameObject;
      if (
        typedGameObject &&
        (typedGameObject.type === UnitType.Imp || typedGameObject.type === UnitType.Creature) &&
        typedGameObject.object.moveDisabled
      )
        continue;

      // If there is no path, move to a random destination
      if (!path || path.length === 0) {
        if (timeSinceLastMove > config.randomMoveDuration && this.viewportObjectManager.isObjectSpawned(id)) {
          this.moveToRandomValidDirection(id);
          this.lastMoves.set(id, now);
        }
        continue;
      }

      if (timeSinceLastMove > config.workMoveDuration) {
        if (path.length > (config.stepOnDestinationTile ? 0 : 1)) {
          this.moveAlongPath(id, path);
        } else {
          if (path.length === 1) {
            const unit = this.viewportObjectManager.getSpawnedObjectById(id)?.typedGameObject?.object;
            const action = this.pathEndActions.get(id);
            if (action) action(unit);
          }
        }
      }
    }
  }
}
