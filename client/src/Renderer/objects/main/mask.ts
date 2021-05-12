import { Polygon } from "./polygon";
import { WorldCoord } from "../../../_types/GlobalTypes";
import { getCornerPointsFromRect } from "../../utils/polygon";

const DEFAULT_BUFFER = 100;
const DEFAULT_ALPHA = 0.4;

interface MaskOptions {
  buffer?: number;
  alpha?: number;
  depth?: number;
}

export class Mask {
  polygon: Polygon;
  background: Phaser.GameObjects.Graphics;

  constructor(
    scene: Phaser.Scene,
    map: Phaser.Tilemaps.Tilemap,
    private camera: Phaser.Cameras.Scene2D.Camera,
    private options?: MaskOptions
  ) {
    this.options = options;
    this.polygon = new Polygon(scene);
    this.polygon.init(map, { alpha: 0, depth: this.options?.depth });
    this.background = new Phaser.GameObjects.Graphics(scene);
    scene.add.existing(this.background);
    scene.add.existing(this.polygon);
  }

  setRegions(regions: WorldCoord[]) {
    const { x, y, width, height } = this.camera.worldView;
    const buffer = this.options?.buffer ?? DEFAULT_BUFFER;
    this.background.fillStyle(0x000000, this.options?.alpha ?? DEFAULT_ALPHA);
    this.background.fillRect(x - buffer, y - buffer, width + 2 * buffer, height + 2 * buffer);
    this.polygon.setRegions(regions);
    const mask = this.polygon.createGeometryMask();
    mask.setInvertAlpha(true);
    this.background.setMask(mask);
    this.background.depth = this.options?.depth || 0;
  }

  clear() {
    this.background.clear();
    this.polygon.clear();
  }

  destroy() {
    this.background.destroy();
    this.polygon.destroy();
  }
}
