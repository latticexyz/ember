import { Creature } from "../objects/main/creature";
import { Creature as CreatureData, WorldCoord } from "../../_types/GlobalTypes";
import { aStar, checkInRange, tileCoordToRegionCoord, notNull } from "../../Backend/Utils/Utils";
import GameManager from "../../Backend/Game/GameManager";
import { ColorKey, colors, CREATURE_GROUP_STANDBY_SIZE } from "../constants";
import { getColorFromEthAddress } from "../utils/colors";
import { CheckedTypeUtils } from "../../Backend/Utils/CheckedTypeUtils";
import { getSurroundingTilesOfSameType } from "../../Backend/Utils/Tiles";
import { worldCoordsEq } from "../utils/worldCoords";
import { GameMap } from "../objects/main/map";
import { ViewportObjectManager } from "./ViewportObjectManager";
import { ViewportGameObject } from "../objects/ViewportGameObject";
import { GroupRegistry } from "../utils/groupRegistry";
import { UnitMoveManager, UnitType } from "./UnitMoveManager";
import MainScene from "../scenes/mainScene";
import { TileUpgrade } from "../../_types/ContractTypes";
import { getRandomElement } from "../utils/random";
import { Service } from "../game";

export class CreatureManager implements Service {
  private gm: GameManager = GameManager.getInstance();
  private creatureGroup: Phaser.GameObjects.Group;

  private scene: MainScene;
  private gameMap: GameMap;

  constructor(
    private viewportObjectManager: ViewportObjectManager,
    private unitMoveManager: UnitMoveManager,
    private groupRegistry: GroupRegistry
  ) { }

  bootService(scene: MainScene) {
    this.scene = scene
    this.gameMap = scene.gameMap;

    // This group is owned by GroupRegistry, so it will be destroyed when
    // the GroupRegistry service is destroyed.
    this.creatureGroup = this.groupRegistry.groups.creature;
  }

  destroyService() { }

  private getCreatureIdsInRegions(regions: WorldCoord[]) {
    const creatureIds = regions
      .map((regionCoord) => this.gm.extendedDungeon.regions.get(regionCoord)?.creatures)
      .filter(notNull)
      .flat(1);

    return creatureIds;
  }

  public getCreaturesAtCoords(tileCoords: WorldCoord[]): Creature[] {
    const creatures: Creature[] = [];

    for (const coord of tileCoords) {
      const objectsAtCoord = this.viewportObjectManager.objectRegistry.getObjectsAtCoord(coord);
      const creaturesAtCoord = objectsAtCoord
        .filter((object) => object.typedGameObject?.type === UnitType.Creature)
        .map((object) => object.typedGameObject?.object as Creature);
      creatures.push(...creaturesAtCoord);
    }

    return creatures;
  }

  public registerCreaturesInRegion(regions: WorldCoord[]) {
    const creatureIds = this.getCreatureIdsInRegions(regions);
    this.registerCreatures(creatureIds);
  }

  private registerCreatures(creatureIds: string[]) {
    const creatures = creatureIds.map((id) => this.gm.extendedDungeon.creatures.get(id));
    for (let i = 0; i < creatureIds.length; i++) {
      const creature = creatures[i];
      if (!creature) throw new Error("Creature not found " + creatureIds[i]);
      const location = creature?.tileCoord;
      this.registerCreature(creatureIds[i], creature, location);
    }
  }

  /**
   * Registers a creature in the ViewportObjectManager
   * @param id Creature's unique identifier
   * @param creature Creature data
   * @param initialTileCoord Tile coord to spawn the creature at
   */
  public registerCreature(id: string, _creature: CreatureData, initialTileCoord: WorldCoord) {
    this.viewportObjectManager.add(
      new ViewportGameObject(id, {
        spawn: (currentCoord) => {
          const creature = this.gm.extendedDungeon.creatures.get(id);
          if (!creature) {
            throw new Error(`Creature doesn't exist in dungeon: ${id}`);
          }
          const hueTint =
            creature.owner === this.gm.address
              ? colors[ColorKey.Player]
              : getColorFromEthAddress(CheckedTypeUtils.address(creature.owner)).color;
          const creatureObject = this.creatureGroup.get() as Creature;

          creatureObject.initCreature(
            this.gameMap.map,
            currentCoord?.x || initialTileCoord.x,
            currentCoord?.y || initialTileCoord.y,
            id,
            this.gm.constants,
            creature,
            this.gm.extendedDungeon,
            this.scene.hueTintPipeline,
            creature.owner,
            hueTint
          );

          // If the currentCoord has an upgrade, move to a random location in the region
          if (!currentCoord || this.gm.extendedDungeon.getTileAt(currentCoord).upgrade !== TileUpgrade.NONE)
            this.setDestination(id, initialTileCoord, true);

          return { type: UnitType.Creature, object: creatureObject };
        },
        despawn: () => {
          const creature = this.getCreatureById(id);

          if (!creature) {
            console.error("Creature is not spawned", id);
            return;
          }

          const tweens = this.scene.tweens.getTweensOf(creature, true);
          for (const tween of tweens) this.scene.tweens.remove(tween);

          this.creatureGroup.killAndHide(creature);
          if (this.creatureGroup.children.size > CREATURE_GROUP_STANDBY_SIZE) {
            creature.destroy();
          }
        },
        update: () => {
          const creature = this.getCreatureById(id);
          creature?.update();
        },
      }),
      initialTileCoord
    );
    this.unitMoveManager.registerUnit(id, UnitType.Creature);
  }

  public isRegistered(id: string): boolean {
    return Boolean(this.viewportObjectManager.objectRegistry.getObjectById(id));
  }

  public killCreature(id: string) {
    this.viewportObjectManager.remove(id);
    this.unitMoveManager.deregisterUnit(id);
  }

  public updateCreatureLife(id: string, life: number) {
    const creature = this.getCreatureById(id);
    creature?.updateLife(life);
  }

  private getCreatureById(id: string): Creature | undefined {
    const typedGameObject = this.viewportObjectManager.getSpawnedObjectById(id)?.typedGameObject;
    if (typedGameObject && typedGameObject.type === UnitType.Creature) return typedGameObject.object;
  }

  private getReachableTilesInRegion(destinationTile: WorldCoord) {
    const destinationRegion = tileCoordToRegionCoord(destinationTile);
    const reachableCoordsInDestinationRegion = getSurroundingTilesOfSameType(
      destinationTile,
      (tile, coord) => {
        const tileRegionCoord = tileCoordToRegionCoord(coord);
        return (
          tile.isMined &&
          (!tile.isWalled || tile.owner === this.gm.address) &&
          worldCoordsEq(tileRegionCoord, destinationRegion)
        );
      },
      this.gm.extendedDungeon
    );

    const creaturesInRegion = this.gm.extendedDungeon.getRegionAt(destinationRegion).creatures;

    const creatureLocations = creaturesInRegion
      .map((creatureId) => this.viewportObjectManager.objectRegistry.getCoordById(creatureId))
      .filter(notNull);

    const scheduledLocations = this.viewportObjectManager.objectRegistry.getSoonToBeOccupiedCoords();

    const reachableCoordsInDestinationRegionThatHaveNoCreaturesScheduledOrSpawnedOrUpgrades =
      reachableCoordsInDestinationRegion.filter(
        (location) =>
          !creatureLocations.find((creatureLocation) => worldCoordsEq(creatureLocation, location)) &&
          !scheduledLocations.find((scheduledLocation) => worldCoordsEq(scheduledLocation, location)) &&
          this.gm.extendedDungeon.getTileAt(location).upgrade === TileUpgrade.NONE
      );
    if (reachableCoordsInDestinationRegionThatHaveNoCreaturesScheduledOrSpawnedOrUpgrades.length > 0) {
      return reachableCoordsInDestinationRegionThatHaveNoCreaturesScheduledOrSpawnedOrUpgrades;
    }
    return reachableCoordsInDestinationRegion.filter(
      (location) =>
        !creatureLocations.find((creatureLocation) => worldCoordsEq(creatureLocation, location)) &&
        !scheduledLocations.find((scheduledLocation) => worldCoordsEq(scheduledLocation, location))
    );
  }

  // TODO: clean up a bunch of this code and functions below and break up into modular functions.
  public setDestination(id: string, destinationTile: WorldCoord, randomEqualTile?: boolean) {
    let toOptions = randomEqualTile ? this.getReachableTilesInRegion(destinationTile) : [destinationTile];
    if (toOptions.length === 0) toOptions = [destinationTile];

    destinationTile = getRandomElement(toOptions);

    const currentPosition = this.viewportObjectManager.objectRegistry.getCoordById(id)!;
    const rangeCheck = checkInRange(this.gm.constants.MAX_X, this.gm.constants.MAX_Y);

    const isValidTile = (coord: WorldCoord): boolean => {
      if (!rangeCheck(coord)) return false;
      const tile = this.gm.extendedDungeon.getTileAt(coord);
      return tile.isMined && (!tile.isWalled || tile.owner === this.gm.address);
    };

    const path = aStar(currentPosition, destinationTile, this.gm.extendedDungeon, isValidTile);
    if (!path) {
      throw new Error("Critical: no valid path found for creature. State might be out of sync.");
    }

    this.setPlannedDestination(id, undefined);
    this.unitMoveManager.setPath(id, path);
  }

  public setPlannedDestination(creatureId: string, destinationTile: WorldCoord | undefined) {
    const creature = this.getCreatureById(creatureId);

    if (!destinationTile) {
      this.unitMoveManager.plannedPaths.delete(creatureId);
    } else {
      const currentLocation = this.viewportObjectManager.objectRegistry.getCoordById(creatureId)!;

      const isTraversable = (coord: WorldCoord): boolean => {
        const tile = this.gm.extendedDungeon.getTileAt(coord);
        return !!tile && tile.isMined && (!tile.isWalled || tile.owner === this.gm.address);
      };

      const path = aStar(currentLocation, destinationTile, this.gm.extendedDungeon, isTraversable);
      if (path) {
        this.unitMoveManager.setPlannedPath(creatureId, path);
      }
    }
  }

  public markCreature(creatureId: string) {
    const creature = this.getCreatureById(creatureId);
    creature?.mark();
  }

  public unmarkCreature(creatureId: string) {
    const creature = this.getCreatureById(creatureId);
    creature?.unmark();
  }

  public getCreatureCoordById(id: string) {
    return this.viewportObjectManager.objectRegistry.getCoordById(id);
  }
}