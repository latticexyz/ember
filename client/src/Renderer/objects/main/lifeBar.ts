import { hexColors } from "../../../theme";
import { TILE_WIDTH, TILE_HEIGHT_OFFSET } from "../../constants";

export default class LifeBar extends Phaser.GameObjects.Container {
  prevLife: number;
  life: number;
  maxLife: number;
  g: Phaser.GameObjects.Graphics;
  leftSprite: Phaser.GameObjects.Sprite;
  rightSprite: Phaser.GameObjects.Sprite;

  constructor(scene: Phaser.Scene, x: number, y: number, life: number, maxLife: number) {
    super(scene);
    this.depth = 50;
    this.maxLife = maxLife;
    this.life = life;
    this.prevLife = 0;
    this.x = x;
    this.y = y;
    this.leftSprite = this.scene.add.sprite(0, TILE_HEIGHT_OFFSET / 2 + 3, "ui", 19);
    this.rightSprite = this.scene.add.sprite(TILE_WIDTH, TILE_HEIGHT_OFFSET / 2 + 3, "ui", 20);
    this.g = this.scene.add.graphics();
    this.add(this.leftSprite);
    this.add(this.rightSprite);
    this.add(this.g);
  }

  init(x, y, life: number, maxLife: number) {
    this.maxLife = maxLife;
    this.life = life;
    this.prevLife = 0;
    this.x = x;
    this.y = y;
  }

  strokeLifeBar() {
    this.g.clear();
    this.g.lineStyle(1, 0xffffff);
    this.g.beginPath();
    this.g.moveTo(1, -0.5);
    this.g.lineTo(TILE_WIDTH - 1, -0.5);
    this.g.strokePath();
    if (this.life / this.maxLife <= 0.4) {
      this.g.lineStyle(1, hexColors.invalid);
    } else {
      this.g.lineStyle(1, hexColors.valid);
    }
    this.g.beginPath();
    this.g.moveTo(1, -0.5);
    this.g.lineTo(1 + Math.ceil((this.life / this.maxLife) * (TILE_WIDTH - 2)), -0.5);
    this.g.strokePath();
  }
  update() {
    if (this.prevLife != this.life) {
      this.strokeLifeBar();
      this.prevLife = this.life;
    }
  }
}
