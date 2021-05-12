import GridUnit, { DEFAULT_DURATION } from "./gridUnit";
import { WorldCoord, Creature as CreatureData, EthAddress } from "../../../_types/GlobalTypes";
import ExtendedDungeon from "../../../Backend/Game/ExtendedDungeon";
import LifeBar from "./lifeBar";
import { TILE_HEIGHT, TILE_WIDTH } from "../../constants";
import { getMaxLifeOfCreature, creatureToSprite } from "../../utils/creatures";
import { CreaturePath } from "./creaturePath";
import { HueTintFXPipeline } from "../../pipelines/hueTintAndOutlineFXPipeline";
import Constants from "../../../Backend/Game/Constants";
import { SoundManager, SoundType } from "../../../Renderer/manager/SoundManager";

const EASE = Phaser.Math.Easing.Quadratic.InOut;

export class Creature extends GridUnit {
  constants: Constants;
  extendedDungeon: ExtendedDungeon;
  onReachedDestination?: (coord: WorldCoord) => void;
  lifeBar: LifeBar;
  stars: Phaser.GameObjects.Sprite;
  hueTintPipeline: HueTintFXPipeline;

  constructor(scene: Phaser.Scene) {
    super(scene);
    this.lifeBar = new LifeBar(this.scene, -TILE_WIDTH / 2, -TILE_HEIGHT / 2 - 2, 1, 1);
    this.stars = new Phaser.GameObjects.Sprite(this.scene, 0, -TILE_HEIGHT / 2 - 8, "");
    this.add(this.lifeBar);
    this.add(this.stars);
  }

  initCreature(
    tileMap: Phaser.Tilemaps.Tilemap,
    x: number,
    y: number,
    id: string,
    constants: Constants,
    creature: CreatureData,
    extendedDungeon: ExtendedDungeon,
    hueTintPipeline: HueTintFXPipeline,
    owner: EthAddress,
    hueTint?: number
  ) {
    const sprite = creatureToSprite[creature.species][creature.creatureType];
    super.init(tileMap, x, y, sprite, owner, id);
    this.stopTweens();
    this.constants = constants;
    this.extendedDungeon = extendedDungeon;
    this.setVisible(true);
    this.setActive(true);
    this.unmark();
    this.hueTintPipeline = hueTintPipeline;
    this.sprite.resetPipeline();
    // janky. https://www.html5gamedevs.com/topic/5338-how-to-create-sprite-animations-dynamically/
    // we probably want to create sprite and animations programatically at load time for all heroes, instead of doing the frankenstein thing i did
    if (hueTint) {
      this.sprite.setPipeline(this.hueTintPipeline);
      this.sprite.setData("hueTint", hueTint);
    }

    this.lifeBar.init(creature.life, getMaxLifeOfCreature(creature));

    this.lifeBar.update();
    this.updateLevel(creature.level);
  }

  updateLife(life: number, maxLife: number) {
    this.lifeBar.life = life;
    this.lifeBar.maxLife = maxLife;
    this.lifeBar.update();
  }

  updateLevel(level: number) {
    if (level === 3) {
      this.stars.setVisible(true);
      this.stars.anims.play("stars-gold", true);
    } else if (level === 2) {
      this.stars.setVisible(true);
      this.stars.anims.play("stars-silver", true);
    } else if (level === 1) {
      this.stars.setVisible(true);
      this.stars.anims.play("stars-bronze", true);
    } else {
      this.stars.anims.stop();
      this.stars.setVisible(false);
    }
  }

  destroy() {
    super.destroy();
    this.lifeBar.destroy();
    this.stars.destroy();
  }

  stopTweens() {
    const tweens = this.scene.tweens.getTweensOf([this, this.lifeBar], true);
    for (const tween of tweens) {
      tween.stop(0);
      this.scene.tweens.remove(tween);
    }
    this.scene.tweens.killTweensOf([this, this.lifeBar]);
  }

  allTweensAreDone(): boolean {
    const tweens = this.scene.tweens.getTweensOf(this.lifeBar, true);
    return super.allTweensAreDone() && !tweens.find((tween) => tween.progress < 1);
  }

  setActive(active: boolean) {
    this.stopTweens();
    this.lifeBar.setActive(active);
    this.stars.setActive(active);
    super.setActive(active);
    return this;
  }

  setVisible(visible: boolean) {
    this.stopTweens();
    this.lifeBar.setVisible(visible);
    this.stars.setVisible(visible);
    super.setVisible(visible);
    return this;
  }

  mark() {
    this.sprite.setData("outline", true);
  }

  unmark() {
    this.sprite.setData("outline", false);
  }
}
