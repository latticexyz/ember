import { WorldCoord } from "../../_types/GlobalTypes";
import { ImpManager } from "./ImpManager";
import { GameMap } from "../objects/main/map";
import { ChunkManager } from "./ChunkManager";
import { AnimationFragment, AnimationContext } from "../utils/animations";
import { ViewportManager } from "./ViewportManager";
import { Service } from "../game";
import MainScene from "../scenes/mainScene";

export const VIEWPORT_ANIMATION_PADDING = 8;

export class AnimationManager implements Service {
  private gameMap: GameMap; // Reference to the 'main map' from scene.
  private context: AnimationContext;
  private particleManager: Phaser.GameObjects.Particles.ParticleEmitterManager;

  constructor(
    private impManager: ImpManager,
    private chunkManager: ChunkManager,
    private viewportManager: ViewportManager
  ) { }

  bootService(scene: MainScene) {
    this.particleManager = scene.particleManager;
    this.gameMap = scene.gameMap;

    this.context = {
      gameMap: this.gameMap,
      particleManager: this.particleManager,
      impManager: this.impManager,
      scene: scene,
    };
  }

  destroyService() { }

  public async addAnimation(animation: AnimationFragment, coord: WorldCoord) {
    if (!this.viewportManager.isTileInViewport(coord, VIEWPORT_ANIMATION_PADDING)) {
      return;
    }

    this.onAddAnimation(coord);
    try {
      await animation(coord, this.context);
    } catch (e) {
      console.error(e);
    }
    this.onRemoveAnimation(coord);
  }

  private onAddAnimation(coord: WorldCoord) {
    this.gameMap.map.addSkipCoord(coord);
  }

  private onRemoveAnimation(coord: WorldCoord) {
    this.gameMap.map.removeSkipCoord(coord);
    this.chunkManager.setTileStale(coord);
  }
}
