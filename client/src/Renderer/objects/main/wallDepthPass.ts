import GameManager from "../../../Backend/Game/GameManager";
import { Area, WorldCoord } from "../../../_types/GlobalTypes";
import { WALL_IDS } from "../../constants";
import ChunkedTilemap from "../../primitives/ChunkedTilemap";
import { forEachTile } from "../../primitives/utils";
import {
  isTileClaimed,
  isTileMined,
  isTileWall,
  isRockWall,
  isRock,
  isTileGold,
  isTileSoul,
  isTilePlayerWall,
} from "../../utils/tiles";
export class WallDepthPass {
  gm: GameManager;
  map: ChunkedTilemap;

  constructor(map: ChunkedTilemap) {
    this.gm = GameManager.getInstance();
    this.map = map;
  }
  private drawTile(tile: Phaser.Tilemaps.Tile, type: string, rockWall: boolean, worldCoord: WorldCoord) {
    if (!tile) {
      console.error(tile, type, worldCoord);
      throw new Error("Tile should not be null");
    }
    const id = WALL_IDS[type];
    if (!id) return;
    tile.index = WALL_IDS[type][rockWall ? 1 : 0];
  }

  // Naive wall connection pass
  render(area: Area) {
    forEachTile({
      map: this.map,
      layer: "terrain",
      tileX: area.tileX,
      tileY: area.tileY,
      width: area.width,
      height: area.height,
      callback: (tile, worldCoord) => {
        if (isTileWall(tile.index) || isRockWall(tile.index)) {
          const isInside = (index: number) => isTileClaimed(index) || isTileMined(index) || isTilePlayerWall(index);
          const isOutside = (index: number) => isRock(index) || isTileGold(index) || isTileSoul(index);
          const isWall = (index: number) => isTileWall(index) || isRockWall(index);
          const top = this.map.getTileAt(worldCoord.x, worldCoord.y - 1, undefined, "terrain").index;
          const bottom = this.map.getTileAt(worldCoord.x, worldCoord.y + 1, undefined, "terrain").index;
          const right = this.map.getTileAt(worldCoord.x + 1, worldCoord.y, undefined, "terrain").index;
          const left = this.map.getTileAt(worldCoord.x - 1, worldCoord.y, undefined, "terrain").index;
          const bottomRight = this.map.getTileAt(worldCoord.x + 1, worldCoord.y + 1, undefined, "terrain").index;
          const bottomLeft = this.map.getTileAt(worldCoord.x - 1, worldCoord.y + 1, undefined, "terrain").index;
          const upperRight = this.map.getTileAt(worldCoord.x + 1, worldCoord.y - 1, undefined, "terrain").index;
          const upperLeft = this.map.getTileAt(worldCoord.x - 1, worldCoord.y - 1, undefined, "terrain").index;

          // horizontal walls
          if (isOutside(top) && isInside(bottom)) {
            this.drawTile(tile, "horizontalFace", isRockWall(tile.index), worldCoord);
          }
          if (isInside(top) && isInside(bottom) && isWall(right) && isWall(left)) {
            this.drawTile(tile, "horizontalFaceBorder", isRockWall(tile.index), worldCoord);
          }
          // Vertical walls
          if (isInside(right) && isOutside(left)) {
            this.drawTile(tile, "verticalBorderRight", isRockWall(tile.index), worldCoord);
          }
          if (isInside(left) && isOutside(right)) {
            this.drawTile(tile, "verticalBorderLeft", isRockWall(tile.index), worldCoord);
          }

          // corner walls
          if (isInside(top) && isWall(left) && isWall(bottom) && isInside(right)) {
            // If corner walls are inside the dungeon, draw them with a border + face
            this.drawTile(tile, "ioLeftDown", isRockWall(tile.index), worldCoord);
            if (isOutside(bottomLeft)) {
              // if the bottom left tile is outside the dungeon, draw the corner without faces
              this.drawTile(tile, "oLeftDown", isRockWall(tile.index), worldCoord);
            }
          }
          if (isInside(left) && isWall(bottom) && isInside(top) && isWall(right)) {
            this.drawTile(tile, "ioRightDown", isRockWall(tile.index), worldCoord);
            if (isOutside(bottomRight)) {
              this.drawTile(tile, "oRightDown", isRockWall(tile.index), worldCoord);
            }
          }
          if (isInside(left) && isWall(top) && isInside(bottom) && isWall(right)) {
            this.drawTile(tile, "ioUpRight", isRockWall(tile.index), worldCoord);
            if (isOutside(upperRight)) {
              this.drawTile(tile, "oUpRight", isRockWall(tile.index), worldCoord);
            }
          }

          if (isInside(right) && isWall(top) && isInside(bottom) && !isInside(left)) {
            this.drawTile(tile, "ioLeftUp", isRockWall(tile.index), worldCoord);
            if (isOutside(upperLeft)) {
              this.drawTile(tile, "oLeftUp", isRockWall(tile.index), worldCoord);
            }
          }
          // Transition walls with 3 arms
          if (isInside(bottom) && isWall(left) && isWall(right) && isWall(top)) {
            // draw with a face if inside the dungeon
            this.drawTile(tile, "ioLeftUpRight", isRockWall(tile.index), worldCoord);
            if (isOutside(upperRight)) {
              this.drawTile(tile, "leftUpRightBorderLeft", isRockWall(tile.index), worldCoord);
            }
            if (isOutside(upperLeft)) {
              this.drawTile(tile, "leftUpRightBorderRight", isRockWall(tile.index), worldCoord);
            }
          }
          if (isInside(right) && isWall(bottom) && isWall(top) && isWall(left)) {
            if (isOutside(bottomLeft)) {
              this.drawTile(tile, "oLeftUpDown", isRockWall(tile.index), worldCoord);
            } else {
              this.drawTile(tile, "ioLeftUpDown", isRockWall(tile.index), worldCoord);
            }
          }
          if (isWall(bottom) && isWall(right) && isWall(top) && isInside(left)) {
            this.drawTile(tile, "ioUpRightDown", isRockWall(tile.index), worldCoord);
            if (isOutside(bottomRight)) {
              this.drawTile(tile, "oUpRightDown", isRockWall(tile.index), worldCoord);
            }
          }
          if (isWall(bottom) && isWall(right) && isWall(left)) {
            if (isOutside(bottomRight)) {
              this.drawTile(tile, "oLeftRightDownFaceLeft", isRockWall(tile.index), worldCoord);
            }
            if (isOutside(bottomLeft)) {
              this.drawTile(tile, "oLeftRightDownFaceRight", isRockWall(tile.index), worldCoord);
            }
          }
        }
      },
    });
  }
}
