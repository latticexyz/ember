import anylogger, { Logger, BaseLevels } from "anylogger";
import { Creature } from "../objects/main/creature";
import { Creature as CreatureData, Settlement, WorldCoord } from "../../_types/GlobalTypes";
import {
  aStar,
  checkInRange,
  tileCoordToRegionCoord,
  notNull,
  regionCoordToTileCoord,
} from "../../Backend/Utils/Utils";
import GameManager from "../../Backend/Game/GameManager";
import { ColorKey, colors, CREATURE_GROUP_STANDBY_SIZE } from "../constants";
import { getColorFromEthAddress } from "../utils/colors";
import { CheckedTypeUtils } from "../../Backend/Utils/CheckedTypeUtils";
import { getSurroundingTilesOfSameType } from "../../Backend/Utils/Tiles";
import { deserializeWorldCoord, serializeWorldCoord, worldCoordsEq } from "../utils/worldCoords";
import { GameMap } from "../objects/main/map";
import { ViewportObjectManager } from "./ViewportObjectManager";
import { StaticViewportGameObjectType, ViewportGameObject } from "../objects/ViewportGameObject";
import { GroupRegistry } from "../utils/groupRegistry";
import { UnitMoveManager, UnitType } from "./UnitMoveManager";
import MainScene from "../scenes/mainScene";
import { TileUpgrade } from "../../_types/ContractTypes";
import { getRandomElement } from "../utils/random";
import { SoundManager, SoundType } from "./SoundManager";
import SettlementObject from "../objects/main/settlement";
import ChunkedTilemap from "../primitives/ChunkedTilemap";
import { Service } from "../game";

const NAMESPACE = "settlement";

export class SettlementManager implements Service {
  private log: Logger<BaseLevels>;
  private gm: GameManager = GameManager.getInstance();
  private settlementGroup: Phaser.GameObjects.Group;
  private tileMap: ChunkedTilemap;
  private intervalId: ReturnType<typeof setInterval>;

  constructor(
    private groupRegistry: GroupRegistry,
    private viewportObjectManager: ViewportObjectManager
  ) {
    this.log = anylogger("settlement-manager");
    this.intervalId = setInterval(() => this.updateEnergyOfSpawnedSettlements(), 1000);
  }

  bootService(scene: MainScene) {
    this.tileMap = scene.gameMap.map;
    this.settlementGroup = this.groupRegistry.groups.settlement;
  }

  destroyService() {
    clearInterval(this.intervalId);
  }

  private updateEnergyOfSpawnedSettlements() {
    const settlementRegions = this.gm.extendedDungeon.settlements.coords();
    for (const settlementRegion of settlementRegions) {
      const id = serializeWorldCoord(settlementRegion, NAMESPACE);
      const typedGameObject = this.viewportObjectManager.getSpawnedObjectById(id)?.typedGameObject;
      if (typedGameObject && typedGameObject.type === StaticViewportGameObjectType.Settlement) {
        typedGameObject.object.updateEnergy();
      }
    }
  }

  private getSettlementsIdsInRegions(regions: WorldCoord[]) {
    const settlementIds = regions
      .map((regionCoord) =>
        this.gm.extendedDungeon.settlements.has(regionCoord) ? serializeWorldCoord(regionCoord, NAMESPACE) : null
      )
      .filter(notNull)
      .flat(1);

    return settlementIds;
  }
  public registerSettlementsInRegion(regions: WorldCoord[]) {
    const creatureIds = this.getSettlementsIdsInRegions(regions);
    this.registerSettlements(creatureIds);
  }

  public getSettlementId(regionCoord: WorldCoord): string {
    return serializeWorldCoord(regionCoord, NAMESPACE);
  }

  private registerSettlements(settlementIds: string[]) {
    const settlements = settlementIds.map((id) =>
      this.gm.extendedDungeon.settlements.get(deserializeWorldCoord(id, NAMESPACE))
    );
    for (let i = 0; i < settlementIds.length; i++) {
      const settlement = settlements[i];
      if (!settlement) throw new Error("Settlement not found " + settlementIds[i]);
      const location = deserializeWorldCoord(settlementIds[i], NAMESPACE);
      this.registerSettlement(settlementIds[i], location);
    }
  }

  private getSettlementById(id: string): SettlementObject | undefined {
    const typedGameObject = this.viewportObjectManager.getSpawnedObjectById(id)?.typedGameObject;
    if (typedGameObject && typedGameObject.type === StaticViewportGameObjectType.Settlement)
      return typedGameObject.object;
  }
  /**
   * Registers a settlement in the ViewportObjectManager
   * @param id Settlement's unique identifier
   * @param settlement Settlement data
   * @param regionCoord Region coord corresponding to the settlement
   */
  public registerSettlement(id: string, regionCoord: WorldCoord) {
    const tileCoord = regionCoordToTileCoord(regionCoord);
    this.viewportObjectManager.add(
      new ViewportGameObject(id, {
        spawn: (_) => {
          const settlement = this.gm.extendedDungeon.settlements.get(regionCoord);
          if (!settlement) {
            throw new Error(`Settlement doesn't exist in dungeon: ${id}`);
          }
          const settlementObject: SettlementObject = this.settlementGroup.get();
          const { x, y } = tileCoord;
          const spawnWorldPoint = this.tileMap.tileToWorldXY(x, y);
          settlementObject.initSettlement(spawnWorldPoint.x, spawnWorldPoint.y, settlement);

          return { type: StaticViewportGameObjectType.Settlement, object: settlementObject };
        },
        despawn: () => {
          const settlement = this.getSettlementById(id);

          if (!settlement) {
            console.error("Settlement is not spawned", id);
            return;
          }

          this.settlementGroup.killAndHide(settlement);
          if (this.settlementGroup.children.size > CREATURE_GROUP_STANDBY_SIZE) {
            settlement.destroy();
          }
        },
        update: () => { },
      }),
      tileCoord
    );
  }

  public isRegistered(id: string): boolean {
    return Boolean(this.viewportObjectManager.objectRegistry.getObjectById(id));
  }

  public updateSettlement(id: string, settlementData: Settlement) {
    const settlement = this.getSettlementById(id);
    settlement?.updateSettlement(settlementData);
  }
}
