import { WorldCoord } from "../../../_types/GlobalTypes";
import { worldCoordsToPhaserTileCoords } from "../../utils/worldCoords";
import { getCenterCoordFromTile } from "../../utils/polygon";
import { hexColors } from "../../../theme";

export class CreaturePath extends Phaser.GameObjects.Graphics {
  private tileMap: Phaser.Tilemaps.Tilemap;
  private points: WorldCoord[];

  public init(tileMap: Phaser.Tilemaps.Tilemap) {
    this.tileMap = tileMap;
    this.setActive(true);
    this.setVisible(true);
  }

  public setPath(path: WorldCoord[]) {
    this.clear();
    this.points = path.map((worldCoord) => {
      const tileCoord = worldCoordsToPhaserTileCoords(worldCoord, this.tileMap.width, this.tileMap.height);
      return getCenterCoordFromTile(tileCoord, this.tileMap.tileWidth, this.tileMap.tileHeight);
    });
    this.lineStyle(2, hexColors.black, 1);
    this.strokePoints(this.points, false, false);

    if (path.length > 0) {
      const lastPoint = this.points[path.length - 1];
      this.fillStyle(hexColors.black, 1);
      this.fillCircle(lastPoint.x, lastPoint.y, 3);
    }
  }
}
