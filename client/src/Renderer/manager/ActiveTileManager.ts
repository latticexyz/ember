import TileLoading from "../objects/main/tileLoading";
import { CoordMap } from "../../Utils/CoordMap";
import { WorldCoord, TileDelayedAction } from "../../_types/GlobalTypes";
import { ViewportObjectManager } from "./ViewportObjectManager";
import { ViewportGameObject, StaticViewportGameObjectType } from "../objects/ViewportGameObject";
import { GroupRegistry } from "../utils/groupRegistry";
import { LoadingStage } from "../constants";
import { getMinimumDelayToCompleteDelayedAction } from "../../Backend/Utils/Utils";
import GameManager from "../../Backend/Game/GameManager";
import { Service } from "../game";
import MainScene from "../scenes/mainScene";

interface TileState {
  stage: LoadingStage;
  start: number;
  end?: number;
  delayedAction?: boolean;
}

export class ActiveTileManager implements Service {
  private gm: GameManager = GameManager.getInstance();
  private map: Phaser.Tilemaps.Tilemap; // Reference to tilemap from 'main map'.

  private activeTiles = new CoordMap<TileState>();
  private tileLoadingGroup: Phaser.GameObjects.Group;

  constructor(
    private viewportObjectManager: ViewportObjectManager,
    private groupRegistry: GroupRegistry
  ) { }

  bootService(scene: MainScene) {
    this.map = scene.gameMap.map;
    // The 'tileLoading' group is owned by GroupRegistry, so it will be destroyed when
    // the GroupRegistry service is destroyed.
    this.tileLoadingGroup = this.groupRegistry.groups.tileLoading;
  }

  destroyService() {
    this.activeTiles.map.clear();
  }

  public setActiveTile(coord: WorldCoord, stage: LoadingStage, delayedAction?: TileDelayedAction) {
    const id = getId(coord);
    const existingTile = this.activeTiles.get(coord);
    const now = Date.now();

    // Set start and end tile of the current stage
    if (!existingTile || stage !== existingTile.stage) {
      if (delayedAction) {
        const minimumDelay = getMinimumDelayToCompleteDelayedAction(
          delayedAction,
          this.gm.extendedDungeon,
          delayedAction.initiator,
          this.gm.constants
        );

        this.activeTiles.set(coord, { stage, start: now, end: now + minimumDelay * 1000, delayedAction: true });
      } else {
        const movingAverage = {
          [LoadingStage.Submitting]: this.gm.movingAverages.txSubmit,
          [LoadingStage.Confirming]: this.gm.movingAverages.txConfirm,
        };

        const duration: number | undefined = movingAverage[stage]?.getAverage();
        const end = duration ? now + duration : undefined;

        this.activeTiles.set(coord, { stage, start: now, end });
      }
    }

    // Update the tile if it already exists
    const tileLoading = this.getTileLoadingAt(coord);
    if (tileLoading) {
      const progress = this.getProgress(coord);
      const duration = this.getDuration(coord);
      tileLoading.setStage(stage, progress, duration, Boolean(delayedAction));
      return;
    }

    this.viewportObjectManager.add(
      new ViewportGameObject(id, {
        spawn: () => {
          const tileLoading: TileLoading = this.tileLoadingGroup.get();
          tileLoading.init(
            this.map,
            coord,
            id,
            this.activeTiles.get(coord)!.stage,
            this.getProgress(coord),
            this.getDuration(coord),
            this.activeTiles.get(coord)!.delayedAction
          );
          return { type: StaticViewportGameObjectType.TileLoading, object: tileLoading };
        },
        despawn: () => {
          const tileLoading = this.getTileLoadingAt(coord);

          if (!tileLoading) {
            return;
          }

          this.tileLoadingGroup.killAndHide(tileLoading);
          // We need to destroy this TileLoading as opposed to just hiding it via the
          // 'tileLoadingGroup', because otherwise we will not clean up Phaser Objects
          // correctly and stuff won't get garbage collected, resulting in weird 
          // Phaser errors when trying to destroy Phaser state and re-boot.
          tileLoading.destroy();
        },
        update: () => {
          const tileLoading = this.getTileLoadingAt(coord);
          tileLoading?.update();
        },
      }),
      coord
    );
  }

  public removeActiveTile(coord: WorldCoord) {
    const id = getId(coord);
    this.viewportObjectManager.remove(id);
    this.activeTiles.delete(coord);
  }

  private getProgress(coord: WorldCoord): number {
    const { end } = this.activeTiles.get(coord)!;
    const duration = this.getDuration(coord);
    const now = Date.now();
    const timeLeft = end && end - now;
    const percentage = duration && timeLeft ? (duration - timeLeft) / duration : 0;
    return percentage * 100;
  }

  private getDuration(coord: WorldCoord): number {
    const { start, end } = this.activeTiles.get(coord)!;
    return end ? end - start : 0;
  }

  private getTileLoadingAt(coord: WorldCoord): TileLoading | undefined {
    const id = getId(coord);
    const typedGameObject = this.viewportObjectManager.getSpawnedObjectById(id)?.typedGameObject;
    if (typedGameObject && typedGameObject.type === StaticViewportGameObjectType.TileLoading)
      return typedGameObject.object;
  }
}

function getId(coord: WorldCoord) {
  return `ActiveTile/${coord.x}/${coord.y}`;
}

export function hasActiveTile(viewportManager: ViewportObjectManager, coord: WorldCoord): boolean {
  const id = getId(coord);
  return viewportManager.has(id);
}
