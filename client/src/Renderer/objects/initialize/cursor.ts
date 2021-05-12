export default class Cursor {
  map: Phaser.Tilemaps.Tilemap;
  scene: Phaser.Scene;
  graphics: Phaser.GameObjects.Graphics;
  constructor(scene: Phaser.Scene, map: Phaser.Tilemaps.Tilemap) {
    this.map = map;
    this.scene = scene;

    this.graphics = scene.add.graphics();
    this.graphics.setDepth(10);
  }

  update(render: boolean, canSelect: boolean) {
    const pointer = this.scene.input.activePointer;
    const worldPoint = pointer.positionToCamera(this.scene.cameras.main) as Phaser.Math.Vector2;
    const pointerTileXY = this.map.worldToTileXY(worldPoint.x, worldPoint.y);
    const snappedWorldPoint = this.map.tileToWorldXY(pointerTileXY.x, pointerTileXY.y);
    this.graphics.setPosition(snappedWorldPoint.x, snappedWorldPoint.y);
    this.graphics.visible = render;
    if (!canSelect) {
      this.graphics.lineStyle(2, 0xff4f78, 1);
      this.graphics.strokeRect(0, 0, this.map.tileWidth, this.map.tileHeight);
    } else {
      this.graphics.lineStyle(2, 0xffffff, 1);
      this.graphics.strokeRect(0, 0, this.map.tileWidth, this.map.tileHeight);
    }
  }

  destroy() {
    this.graphics.destroy();
  }
}
