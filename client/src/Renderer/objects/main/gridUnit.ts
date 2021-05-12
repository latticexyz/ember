import { v4 } from "uuid";
import { WorldCoord, WithId, EthAddress } from "../../../_types/GlobalTypes";
import {
  getAnimationNameFromSpriteNameAndModifier,
  getModularSpriteAnimationNamesFromSpriteNameAndModifier,
  isAnimationModular,
  MODULAR_SPRITE_PARTS,
  SpriteModifier,
  SpriteName,
  TILE_HEIGHT,
  TILE_WIDTH,
} from "../../constants";
import GameManager from "../../../Backend/Game/GameManager";
import "../../game";

export const DEFAULT_DURATION = 200;

export enum MoveType {
  Random,
  Path,
}

export default class GridUnit extends Phaser.GameObjects.Container implements WithId {
  gm: GameManager;
  id: string;
  tileMap: Phaser.Tilemaps.Tilemap;
  spriteName: SpriteName;
  moveDisabled: boolean;
  owner: EthAddress;
  sprite: Phaser.GameObjects.Sprite;
  isModular: boolean;

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0);
    this.gm = GameManager.getInstance();
    this.sprite = new Phaser.GameObjects.Sprite(scene, 0, 0, "", 0);
    this.add(this.sprite);
  }

  init(tileMap: Phaser.Tilemaps.Tilemap, x: number, y: number, spriteName: SpriteName, owner: EthAddress, id?: string) {
    this.stopTweens();
    const spawnWorldPoint = tileMap.tileToWorldXY(x, y);
    this.setX(spawnWorldPoint.x + TILE_WIDTH / 2);
    this.setY(spawnWorldPoint.y + TILE_HEIGHT / 2);
    this.id = id || v4();
    this.spriteName = spriteName;
    this.tileMap = tileMap;
    this.sprite.anims.play(getAnimationNameFromSpriteNameAndModifier(this.spriteName, SpriteModifier.Idle), true);
    this.depth = 2;
    this.setVisible(true);
    this.setActive(true);
    this.moveDisabled = false;
    this.owner = owner;
  }

  stopTweens() {
    const tweens = this.scene.tweens.getTweensOf(this, true);
    for (const tween of tweens) {
      tween.stop(0);
      this.scene.tweens.remove(tween);
    }
    this.scene.tweens.killTweensOf(this);
  }

  allTweensAreDone(): boolean {
    const tweens = this.scene.tweens.getTweensOf(this, true);
    return !tweens.find((tween) => tween.progress < 1);
  }

  moveToWorldCoord(coord: WorldCoord, speed?: number) {
    this.sprite.anims.play(getAnimationNameFromSpriteNameAndModifier(this.spriteName, SpriteModifier.Walking), true);
    const worldXY = this.tileXYToWorldXY(coord);
    // handle flip properly
    if (worldXY.x < this.x) {
      this.sprite.setFlipX(true);
    } else if (worldXY.x > this.x) {
      this.sprite.setFlipX(false);
    }
    this.scene.tweens.add({
      targets: this,
      y: worldXY.y,
      x: worldXY.x,
      duration: speed || DEFAULT_DURATION,
      ease: Phaser.Math.Easing.Quadratic.InOut,
      onComplete: () => {
        this.sprite.anims.play(getAnimationNameFromSpriteNameAndModifier(this.spriteName, SpriteModifier.Idle), true);
      },
    });
  }

  protected tileXYToWorldXY(coord: WorldCoord): Phaser.Math.Vector2 {
    const worldPoint = this.tileMap.tileToWorldXY(coord.x, coord.y);
    return new Phaser.Math.Vector2(worldPoint.x + TILE_WIDTH / 2, worldPoint.y + TILE_HEIGHT / 2);
  }

  setActive(active: boolean) {
    this.stopTweens();
    return super.setActive(active);
  }

  setVisible(visible: boolean) {
    this.stopTweens();
    return super.setVisible(visible);
  }

  update() { }
}
