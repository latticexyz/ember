// Handles generating nice connections between walls that marching squares couldn't get
// Previously, this was a pass on top of marching squares.
// But we didn't really need marching squares anymore
import { ethers, utils } from "ethers";
import GameManager from "../../../Backend/Game/GameManager";
import { tileCoordToRegionCoord } from "../../../Backend/Utils/Utils";
import { NAMED_CIRCULAR_DIRECTIONS, NAMED_VON_NEUMANN_DIRS } from "../../../Utils/Utils";
import { Area, EthAddress, Tile, WorldCoord } from "../../../_types/GlobalTypes";
import { getDefaultColorFromTerrainTilesetId, TerrainTilesetId, WALL_IDS } from "../../constants";
import ChunkedTilemap from "../../primitives/ChunkedTilemap";
import { forEachTile } from "../../primitives/utils";
import { getColorFromEthAddress } from "../../utils/colors";
import { isTileClaimed, isTileMined, isTileWall, isRockWall, isRock, isTilePlayerWall } from "../../utils/tiles";

// Maps from a bitmask of adjacent walls to the wall tile to use
const ConnectionTable: Map<number, string> = new Map([
  // Naming convention assumes a central "node"
  // Then an "arm" sticking out from that node in specified direction
  [14, "upRightDown"],
  [7, "leftRightDown"],
  [13, "leftUpRight"],
  [11, "leftUpDown"],
  [15, "leftUpRightDown"],

  // Corners
  [12, "upRight"],
  [9, "leftUp"],
  [3, "leftDown"],
  [6, "rightDown"],

  // Straight pieces
  [10, "upDown"],
  [5, "leftRight"],

  // End pieces
  // TODO: Get nice end pieces
  [2, "down"],
  [4, "right"],
  [1, "left"],
  [8, "top"],
  [0, "single"],
]);

export class WallConnector {
  gm: GameManager;
  map: ChunkedTilemap;

  constructor(map: ChunkedTilemap) {
    this.gm = GameManager.getInstance();
    this.map = map;
  }
  private drawTile(tile: Phaser.Tilemaps.Tile, type: string, rockWall: number, worldCoord: WorldCoord) {
    if (!tile) {
      console.error(tile, type, worldCoord);
      throw new Error("Tile should not be null");
    }
    // TODO: make sure rockWall is 0 or 1
    tile.index = WALL_IDS[type][rockWall];
  }

  // Naive wall connection pass
  renderWallsConnectionPass(area: Area) {
    forEachTile({
      map: this.map,
      layer: "terrain",
      tileX: area.tileX,
      tileY: area.tileY,
      width: area.width,
      height: area.height,
      callback: (tile, worldCoord) => {
        const adjacentWalls = { top: 0, right: 0, bottom: 0, left: 0 };
        if (isTileWall(tile.index) || isRockWall(tile.index)) {
          let rockWall = 1;
          for (const [dirName, dir] of Object.entries(NAMED_CIRCULAR_DIRECTIONS)) {
            const { x, y } = dir;
            // Clockwise, starting from top
            const adjacentTile = this.map.getTileAt(worldCoord.x + x, worldCoord.y + y, undefined, "terrain");
            if (!adjacentTile) {
              continue;
            }
            // Handle wall connections
            if (isTileWall(adjacentTile.index) || isRockWall(adjacentTile.index)) {
              adjacentWalls[dirName] = 1;
            } else {
              adjacentWalls[dirName] = 0;
            }
            // handle rock walls, 1 = rock wall, 0 = normal wall
            rockWall *= this.shouldBeRockWall(adjacentTile);
            this.checkShouldBeTinted(tile, worldCoord, !!rockWall);
          }

          const bitmask = this.getBitmask(
            adjacentWalls.top,
            adjacentWalls.right,
            adjacentWalls.bottom,
            adjacentWalls.left
          );
          const tileToDraw = ConnectionTable.get(bitmask);
          if (tileToDraw) {
            this.drawTile(tile, tileToDraw, rockWall, worldCoord);
            // For debugging
            // const zz = this.map.tileToWorldXY(worldCoord.x, worldCoord.y);
            // this.map.scene.add.text(zz.x, zz.y, adjTint.toString());
          }
        }
      },
    });
  }

  getBitmask = (top: number, right: number, bottom: number, left: number) => {
    // Get a bitmask from a tile's neighbors, in clockwise direction
    return top * 8 + right * 4 + bottom * 2 + left;
  };

  shouldBeRockWall = (adjacent: Phaser.Tilemaps.Tile) => {
    if (isTileClaimed(adjacent.index) || isTilePlayerWall(adjacent.index)) {
      return 0;
    }
    // else, should be rock
    return 1;
  };

  checkShouldBeTinted = (tile: Phaser.Tilemaps.Tile, worldCoord: WorldCoord, isRockWall: boolean) => {
    const wallRegion = tileCoordToRegionCoord(worldCoord);
    const { controller, disputed } = this.gm.extendedDungeon.getRegionController(wallRegion);

    // If it's in a region with a controller, tint with controller color
    if (controller !== ethers.constants.AddressZero && !disputed) {
      // If it's your wall, tint it brown
      if (controller === this.gm.address) {
        tile.tint = getDefaultColorFromTerrainTilesetId(TerrainTilesetId.Wall);
      } else {
        tile.tint = getColorFromEthAddress(controller).color;
      }
    } else {
      // otherwise untint it
      // the resource pass might have tinted the souls in green if it's a pit
      if (isRockWall) {
        tile.tint = 0x776761;
      } else {
        tile.tint = 0xffffff;
      }
    }
  };
}
