import GameManager from "../../../Backend/Game/GameManager";
import { WorldCoord, ImpWorkType, EthAddress } from "../../../_types/GlobalTypes";
import GridUnit from "./gridUnit";
import { HueTintFXPipeline } from "../../pipelines/hueTintAndOutlineFXPipeline";
import { SoundManager, SoundType } from "../../manager/SoundManager";
import { getAnimationNameFromSpriteNameAndModifier, SpriteModifier, SpriteName } from "../../constants";

const SOUNDS = {
  [ImpWorkType.MINE]: SoundType.MINE,
  [ImpWorkType.UPGRADE]: SoundType.UPGRADE,
};

export default class Imp extends GridUnit {
  lastWorkAt: number; //timestamp at which the imp last had work
  gm: GameManager;
  emitter: Phaser.GameObjects.Particles.ParticleEmitter;
  manager: Phaser.GameObjects.Particles.ParticleEmitterManager;
  hueTintPipeline: HueTintFXPipeline;
  private workingOn?: WorldCoord;
  private workType?: ImpWorkType;

  constructor(scene: Phaser.Scene) {
    super(scene);
  }

  initImp(
    tileMap: Phaser.Tilemaps.Tilemap,
    emitterManager: Phaser.GameObjects.Particles.ParticleEmitterManager,
    x: number,
    y: number,
    hueTintPipeline: HueTintFXPipeline,
    owner: EthAddress,
    id?: string,
    hueTint?: number,
    isNewObject?: boolean
  ) {
    super.init(tileMap, x, y, SpriteName.Imp, owner, id);
    this.clearWorkingOn();
    this.manager = emitterManager;
    this.hueTintPipeline = hueTintPipeline;
    this.sprite.resetPipeline();
    if (hueTint) {
      this.sprite.setPipeline(this.hueTintPipeline);
      this.sprite.setData("hueTint", hueTint);
    }
    this.gm = GameManager.getInstance();
    if (isNewObject) {
      SoundManager.register(SoundType.IMP_APPEAR, { x, y });
      this.sprite.anims.play("imp-appear");
      this.moveDisabled = true;
      this.once("animationcomplete", () => {
        this.sprite.anims.play(getAnimationNameFromSpriteNameAndModifier(SpriteName.Imp, SpriteModifier.Idle));
        this.moveDisabled = false;
      });
    }
  }

  setWorkingOn(coord: WorldCoord, workType: ImpWorkType = ImpWorkType.MINE) {
    this.workingOn = coord;
    this.workType = workType;

    SoundManager.register(SOUNDS[workType], this.workingOn);
    this.sprite.anims.play(getAnimationNameFromSpriteNameAndModifier(SpriteName.Imp, SpriteModifier.Action), true);

    const worldXY = this.tileXYToWorldXY(coord);
    this.emitter = this.manager.createEmitter({
      // each particle starts at full scale and shrinks down until it disappears
      scale: {
        start: 0.2,
        end: 0.1,
      },

      tint: {
        start: 0xede3df,
        end: 0xffffff,
      },
      // each particle has a random speed from zero (no speed) to 200 pixels per second
      speed: {
        min: 20,
        max: 100,
      },
      // the emitter is not active at the moment, this means no particles are emitted
      active: false,
      // each particle has a 500 milliseconds lifespan
      lifespan: 500,
      quantity: 20,
      moveToX: worldXY.x,
      moveToY: worldXY.y,
      rotate: 10,
    });
    // place particle emitter in the top left coordinate of the platform
    // now the emitter is active
    this.emitter.active = true;
    // set a emit zone
    this.emitter.setEmitZone({
      source: new Phaser.Geom.Rectangle(0, 0, this.width / 10, this.height / 10),
      type: "random",
      quantity: 50,
    });

    this.emitter.flow(150);
  }

  clearWorkingOn() {
    this.emitter?.stop();
    this.lastWorkAt = Date.now();
    if (this.workingOn !== undefined) SoundManager.removeSpatialSound(this.workingOn);
    this.sprite.anims.play(getAnimationNameFromSpriteNameAndModifier(SpriteName.Imp, SpriteModifier.Idle));
    this.workingOn = undefined;
    this.workType = undefined;
  }

  setActive(active: boolean): this {
    if (this.emitter) this.emitter.active = active;
    this.stopTweens();
    super.setActive(active);
    return this;
  }

  setVisible(visible: boolean): this {
    this.emitter?.setVisible(visible);
    this.stopTweens();
    super.setVisible(visible);
    return this;
  }

  update() {
    super.update();
    if (this.emitter) {
      this.emitter.setPosition(this.x, this.y - 2);
    }
  }
}
