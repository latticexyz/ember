import { GameMap } from "../objects/main/map";
import { WorldCoord, EthAddress, ImpWorkType } from "../../_types/GlobalTypes";
import { ImpManager } from "../manager/ImpManager";
import { deferred } from "../../Backend/Utils/Utils";
import { TILE_HEIGHT, TILE_WIDTH } from "../constants";

export interface AnimationContext {
  gameMap: GameMap;
  particleManager: Phaser.GameObjects.Particles.ParticleEmitterManager;
  impManager: ImpManager;
  scene: Phaser.Scene;
}

export type AnimationFragment = (coord: WorldCoord, context: AnimationContext) => Promise<void>;

export function stackAnimations(...animations: AnimationFragment[]): AnimationFragment {
  const animationFragment: AnimationFragment = async (coord, context) => {
    for (const animation of animations) {
      await animation(coord, context);
    }
  };
  return animationFragment;
}

export const animateTileExplosion: AnimationFragment = async (coord, { particleManager, gameMap }) => {
  const emitter = particleManager.createEmitter({
    scale: {
      start: 0.3,
      end: 0.0,
    },
    tint: {
      start: 0x808080,
      end: 0x808080,
    },
    speed: {
      min: -800,
      max: 100,
    },
    gravityY: 700,
    lifespan: 600,
    blendMode: Phaser.BlendModes.SCREEN,
  });
  const pos = gameMap.map.tileToWorldXY(coord.x, coord.y);
  emitter.setBounds(pos.x - 50, pos.y - 50, 100, 100);
  emitter.explode(8, pos.x, pos.y);
  // SoundManager.register(SoundType.EXPLOSION, coord);
};

export const createAnimateControllerChange: (tint: number) => AnimationFragment =
  (tint: number) =>
  async (coord, { particleManager, gameMap }) => {
    const pos = gameMap.map.tileToWorldXY(coord.x, coord.y);
    const zone = new Phaser.Geom.Rectangle(pos.x, pos.y, TILE_WIDTH, TILE_HEIGHT);
    const emitter = particleManager.createEmitter({
      tint: {
        min: tint,
        max: tint,
      },
      scale: {
        start: 0.15,
        end: 0.05,
      },
      alpha: { start: 1, end: 0 },
      gravityY: -40,
      speedY: -100,
      lifespan: 400,
      blendMode: Phaser.BlendModes.NORMAL,
    });
    emitter.setEmitZone({
      type: "random",
      //@ts-ignore
      source: zone,
    });
    emitter.flow(1, 10);
    setTimeout(() => emitter.stop(), 150);
  };

export const createWorkingImpAnimation: (address: EthAddress, type?: ImpWorkType) => AnimationFragment =
  (address, type = ImpWorkType.MINE) =>
  async (coord, context) => {
    const [resolve, reject, promise] = deferred<void>();
    context.impManager.addTileToWorkOn(address, coord, type);
    setTimeout(() => {
      animateTileExplosion(coord, context);
      context.impManager.removeTileToWorkOn(address, coord);
      resolve();
    }, 3000);
    return promise;
  };

export const animateLaser: AnimationFragment = async (coord, { gameMap, scene }) => {
  const [resolve, reject, promise] = deferred<void>();
  const pos = gameMap.map.tileToWorldXY(coord.x, coord.y);
  const height = 24;
  const width = 24;
  const scaleY = 1000;

  const laserTop = scene.add.sprite(pos.x + width / 2, pos.y - (scaleY * height) / 2, "laser");
  laserTop.depth = 400;

  const laserBottom = scene.add.sprite(pos.x + width / 2, pos.y + height / 2, "laser");
  laserBottom.depth = 400;

  laserTop.setScale(1, scaleY);
  laserTop.anims.play("laser-top-anim");
  laserBottom.anims.play("laser-bottom-anim");

  setTimeout(() => {
    laserBottom.destroy();
    laserTop.destroy();
    resolve();
  }, 1000);
  return promise;
};
