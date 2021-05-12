import { v4 } from "uuid";
import { WorldCoord, WithId, EthAddress } from "../../../_types/GlobalTypes";
import { TILE_HEIGHT, TILE_WIDTH } from "../../constants";
import GameManager from "../../../Backend/Game/GameManager";
import "../../game";

export const DEFAULT_DURATION = 200;

export enum MoveType {
  Random,
  Path,
}

export default class GridUnit extends Phaser.GameObjects.Sprite implements WithId {
  gm: GameManager;
  id: string;
  tileMap: Phaser.Tilemaps.Tilemap;
  animName: string;
  moveDisabled: boolean;
  owner: EthAddress;

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0, "imp");
    this.gm = GameManager.getInstance();
  }

  init(tileMap: Phaser.Tilemaps.Tilemap, x: number, y: number, animName: string, owner: EthAddress, id?: string) {
    this.stopTweens();
    const spawnWorldPoint = tileMap.tileToWorldXY(x, y);
    this.setX(spawnWorldPoint.x + TILE_WIDTH / 2);
    this.setY(spawnWorldPoint.y + TILE_HEIGHT / 2);
    this.setTexture(animName);
    this.id = id || v4();
    this.animName = animName;
    this.tileMap = tileMap;
    this.anims.play(this.animName + "-idle", true);
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

  moveTo(coord: WorldCoord, speed?: number) {
    const worldXY = this.tileXYToWorldXY(coord);
    this.scene.tweens.add({
      targets: this,
      y: worldXY.y,
      x: worldXY.x,
      duration: speed || DEFAULT_DURATION,
      ease: Phaser.Math.Easing.Quadratic.InOut,
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
