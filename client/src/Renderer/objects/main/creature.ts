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
  hueTintPipeline: HueTintFXPipeline;

  constructor(scene: Phaser.Scene) {
    super(scene);
    this.lifeBar = new LifeBar(this.scene, 0, 0, 1, 1);
    this.scene.add.existing(this.lifeBar);
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
    this.resetPipeline();
    if (hueTint) {
      this.setData("hueTint", hueTint);
      this.setPipeline(this.hueTintPipeline);
    }

    const spawnWorldPoint = tileMap.tileToWorldXY(x, y);

    this.lifeBar.init(spawnWorldPoint.x, spawnWorldPoint.y - 1, creature.life, getMaxLifeOfCreature(creature));

    this.lifeBar.update();
  }

  updateLife(life: number) {
    this.lifeBar.life = life;
    this.lifeBar.update();
  }

  moveTo(coord: WorldCoord, speed?: number) {
    super.moveTo(coord, speed);
    const worldXY = this.tileXYToWorldXY(coord);
    this.scene.tweens.add({
      targets: this.lifeBar,
      x: worldXY.x - TILE_WIDTH / 2,
      y: worldXY.y - TILE_HEIGHT / 2 - 1,
      duration: speed || DEFAULT_DURATION,
      ease: EASE,
    });
  }

  destroy() {
    super.destroy();
    this.lifeBar.destroy();
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
    super.setActive(active);
    return this;
  }

  setVisible(visible: boolean) {
    this.stopTweens();
    this.lifeBar.setVisible(visible);
    super.setVisible(visible);
    return this;
  }

  mark() {
    this.setData("outline", true);
  }

  unmark() {
    this.setData("outline", false);
  }
}
