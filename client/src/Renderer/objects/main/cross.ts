import { hexColors } from "../../../theme";
import { TILE_HEIGHT, TILE_WIDTH } from "../../constants";

export default class Cross extends Phaser.GameObjects.Graphics {
  progress: number;
  prevProgress: number;

  constructor(scene: Phaser.Scene, x, y) {
    super(scene);
    this.progress = 0;
    this.prevProgress = 0;
    this.x = x;
    this.y = y;
  }

  strokeCross() {
    this.clear();
    this.lineStyle(1, hexColors.invalid);
    const p1 = Math.min(this.progress * 2, 1);
    this.beginPath();
    this.moveTo(1, 1);
    this.lineTo((TILE_WIDTH - 1) * p1, (TILE_HEIGHT - 1) * p1);
    this.strokePath();
    if (this.progress > 0.5) {
      const p2 = Math.min((this.progress - 0.5) * 2, 1);
      this.beginPath();
      this.moveTo(1, TILE_HEIGHT - 1);
      this.lineTo((TILE_WIDTH - 1) * p2, TILE_HEIGHT - TILE_HEIGHT * p2 + 1);
      this.strokePath();
    }
  }
  update() {
    if (this.prevProgress != this.progress) {
      this.strokeCross();
      this.prevProgress = this.progress;
    }
  }
}
