import GameManager from "../../../Backend/Game/GameManager";
import { Area, WorldCoord } from "../../../_types/GlobalTypes";
import { GEM_WALL_IDS, TerrainTilesetId, WALL_IDS } from "../../constants";
import ChunkedTilemap from "../../primitives/ChunkedTilemap";
import { forEachTile } from "../../primitives/utils";
import {
  isTileClaimed,
  isTileMined,
  isTileWall,
  isRock,
  isTileGold,
  isTileSoul,
  isTileGemWall,
} from "../../utils/tiles";
export class WallDepthPass {
  gm: GameManager;
  map: ChunkedTilemap;

  constructor(map: ChunkedTilemap) {
    this.gm = GameManager.getInstance();
    this.map = map;
  }
  private drawTile(
    tile: Phaser.Tilemaps.Tile,
    type: string,
    gemWall: boolean,
    rockWall: boolean,
    worldCoord: WorldCoord
  ) {
    if (!tile) {
      console.error(tile, type, worldCoord);
      throw new Error("Tile should not be null");
    }
    const dictionary = gemWall ? GEM_WALL_IDS : WALL_IDS;
    const id = dictionary[type];
    if (!id) return;
    tile.index = dictionary[type][rockWall ? 1 : 0];
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
        if (isTileWall(tile.index)) {
          const isInside = (index: number) => isTileClaimed(index) || isTileMined(index);
          const isOutside = (index: number) =>
            isRock(index) || isTileGold(index) || isTileSoul(index) || index === TerrainTilesetId.InnerWall;
          const isWall = (index: number) => isTileWall(index);
          const top = this.map.getTileAt(worldCoord.x, worldCoord.y - 1, undefined, "terrain").index;
          const bottom = this.map.getTileAt(worldCoord.x, worldCoord.y + 1, undefined, "terrain").index;
          const right = this.map.getTileAt(worldCoord.x + 1, worldCoord.y, undefined, "terrain").index;
          const left = this.map.getTileAt(worldCoord.x - 1, worldCoord.y, undefined, "terrain").index;
          const bottomRight = this.map.getTileAt(worldCoord.x + 1, worldCoord.y + 1, undefined, "terrain").index;
          const bottomLeft = this.map.getTileAt(worldCoord.x - 1, worldCoord.y + 1, undefined, "terrain").index;
          const upperRight = this.map.getTileAt(worldCoord.x + 1, worldCoord.y - 1, undefined, "terrain").index;
          const upperLeft = this.map.getTileAt(worldCoord.x - 1, worldCoord.y - 1, undefined, "terrain").index;
          const isRockWall = !this.gm.extendedDungeon.getTileAt(worldCoord).isWalled;
          const isGemWall = isTileGemWall(tile.index);

          // horizontal walls
          if (isOutside(top) && isInside(bottom)) {
            this.drawTile(tile, "horizontalFace", isGemWall, isRockWall, worldCoord);
          }
          if (isInside(top) && isInside(bottom) && isWall(right) && isWall(left)) {
            this.drawTile(tile, "horizontalFaceBorder", isGemWall, isRockWall, worldCoord);
          }
          // Vertical walls
          if (isInside(right) && isOutside(left)) {
            this.drawTile(tile, "verticalBorderRight", isGemWall, isRockWall, worldCoord);
          }
          if (isInside(left) && isOutside(right)) {
            this.drawTile(tile, "verticalBorderLeft", isGemWall, isRockWall, worldCoord);
          }

          // corner walls
          if (isInside(top) && isWall(left) && isWall(bottom) && isInside(right)) {
            // If corner walls are inside the dungeon, draw them with a border + face
            this.drawTile(tile, "ioLeftDown", isGemWall, isRockWall, worldCoord);
            if (isOutside(bottomLeft)) {
              // if the bottom left tile is outside the dungeon, draw the corner without faces
              this.drawTile(tile, "oLeftDown", isGemWall, isRockWall, worldCoord);
            }
          }
          if (isInside(left) && isWall(bottom) && isInside(top) && isWall(right)) {
            this.drawTile(tile, "ioRightDown", isGemWall, isRockWall, worldCoord);
            if (isOutside(bottomRight)) {
              this.drawTile(tile, "oRightDown", isGemWall, isRockWall, worldCoord);
            }
          }
          if (isInside(left) && isWall(top) && isInside(bottom) && isWall(right)) {
            this.drawTile(tile, "ioUpRight", isGemWall, isRockWall, worldCoord);
            if (isOutside(upperRight)) {
              this.drawTile(tile, "oUpRight", isGemWall, isRockWall, worldCoord);
            }
          }

          if (isInside(right) && isWall(top) && isInside(bottom) && !isInside(left)) {
            this.drawTile(tile, "ioLeftUp", isGemWall, isRockWall, worldCoord);
            if (isOutside(upperLeft)) {
              this.drawTile(tile, "oLeftUp", isGemWall, isRockWall, worldCoord);
            }
          }
          // Transition walls with 3 arms
          if (isInside(bottom) && isWall(left) && isWall(right) && isWall(top)) {
            // draw with a face if inside the dungeon
            this.drawTile(tile, "ioLeftUpRight", isGemWall, isRockWall, worldCoord);
            if (isOutside(upperRight)) {
              this.drawTile(tile, "leftUpRightBorderLeft", isGemWall, isRockWall, worldCoord);
            }
            if (isOutside(upperLeft)) {
              this.drawTile(tile, "leftUpRightBorderRight", isGemWall, isRockWall, worldCoord);
            }
          }
          if (isInside(right) && isWall(bottom) && isWall(top) && isWall(left)) {
            if (isOutside(bottomLeft)) {
              this.drawTile(tile, "oLeftUpDown", isGemWall, isRockWall, worldCoord);
            } else {
              this.drawTile(tile, "ioLeftUpDown", isGemWall, isRockWall, worldCoord);
            }
          }
          if (isWall(bottom) && isWall(right) && isWall(top) && isInside(left)) {
            this.drawTile(tile, "ioUpRightDown", isGemWall, isRockWall, worldCoord);
            if (isOutside(bottomRight)) {
              this.drawTile(tile, "oUpRightDown", isGemWall, isRockWall, worldCoord);
            }
          }
          if (isWall(bottom) && isWall(right) && isWall(left)) {
            if (isOutside(bottomRight)) {
              this.drawTile(tile, "oLeftRightDownFaceLeft", isGemWall, isRockWall, worldCoord);
            }
            if (isOutside(bottomLeft)) {
              this.drawTile(tile, "oLeftRightDownFaceRight", isGemWall, isRockWall, worldCoord);
            }
          }
        }
      },
    });
  }
}
