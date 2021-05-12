// Handles generating nice connections between walls that marching squares couldn't get
// Previously, this was a pass on top of marching squares.
// But we didn't really need marching squares anymore
import { ethers } from "ethers";
import GameManager from "../../../Backend/Game/GameManager";
import { CheckedTypeUtils } from "../../../Backend/Utils/CheckedTypeUtils";
import { tileCoordToRegionCoord } from "../../../Backend/Utils/Utils";
import { NAMED_CIRCULAR_DIRECTIONS } from "../../../Utils/Utils";
import { Area, EthAddress, WorldCoord } from "../../../_types/GlobalTypes";
import { GEM_WALL_IDS, getDefaultColorFromTerrainTilesetId, TerrainTilesetId, WALL_IDS } from "../../constants";
import ChunkedTilemap from "../../primitives/ChunkedTilemap";
import { forEachTile } from "../../primitives/utils";
import { getColorFromEthAddress } from "../../utils/colors";
import { isTileWall } from "../../utils/tiles";

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
  private drawTile(
    tile: Phaser.Tilemaps.Tile,
    type: string,
    gemWall: boolean,
    rockWall: number,
    worldCoord: WorldCoord
  ) {
    if (!tile) {
      console.error(tile, type, worldCoord);
      throw new Error("Tile should not be null");
    }
    // TODO: make sure rockWall is 0 or 1
    tile.index = (gemWall ? GEM_WALL_IDS : WALL_IDS)[type][rockWall];
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
        if (isTileWall(tile.index)) {
          let settlementAddress: EthAddress = CheckedTypeUtils.address(ethers.constants.AddressZero);
          for (const [dirName, dir] of Object.entries(NAMED_CIRCULAR_DIRECTIONS)) {
            const { x, y } = dir;
            // Clockwise, starting from top
            const adjacentCoord = { x: worldCoord.x + x, y: worldCoord.y + y };
            const adjacentTile = this.map.getTileAt(worldCoord.x + x, worldCoord.y + y, undefined, "terrain");
            if (!adjacentTile) {
              continue;
            }
            // Handle wall connections
            if (isTileWall(adjacentTile.index)) {
              adjacentWalls[dirName] = 1;
            } else {
              adjacentWalls[dirName] = 0;
            }
            if (settlementAddress === ethers.constants.AddressZero) {
              const wallRegion = tileCoordToRegionCoord(adjacentCoord);
              const { settlement, found } = this.gm.extendedDungeon.getSettlement(wallRegion);
              if (found) {
                settlementAddress = settlement.owner;
              }
            }

            if (settlementAddress !== ethers.constants.AddressZero) {
              if (settlementAddress === this.gm.address) {
                tile.tint = getDefaultColorFromTerrainTilesetId(TerrainTilesetId.Wall);
              } else {
                tile.tint = getColorFromEthAddress(settlementAddress).color;
              }
            }

            const bitmask = this.getBitmask(
              adjacentWalls.top,
              adjacentWalls.right,
              adjacentWalls.bottom,
              adjacentWalls.left
            );

            const tileToDraw = ConnectionTable.get(bitmask);
            const isPlayerWall = this.gm.extendedDungeon.getTileAt(worldCoord).isWalled;
            if (tileToDraw) {
              this.drawTile(
                tile,
                tileToDraw,
                settlementAddress !== ethers.constants.AddressZero ? true : false,
                isPlayerWall ? 0 : 1,
                worldCoord
              );
            }
          }
        } else if (tile.index === TerrainTilesetId.InnerWall) {
          for (const [_, dir] of Object.entries(NAMED_CIRCULAR_DIRECTIONS)) {
            const { x, y } = dir;
            const adjacentCoord = { x: worldCoord.x + x, y: worldCoord.y + y };
            const wallRegion = tileCoordToRegionCoord(adjacentCoord);
            const { settlement, found } = this.gm.extendedDungeon.getSettlement(wallRegion);
            if (found) {
              if (settlement.owner === this.gm.address) {
                tile.tint = getDefaultColorFromTerrainTilesetId(TerrainTilesetId.Wall);
              } else {
                tile.tint = getColorFromEthAddress(settlement.owner).color;
              }
            }
          }
        }
      },
    });
  }

  getBitmask = (top: number, right: number, bottom: number, left: number) => {
    // Get a bitmask from a tile's neighbors, in clockwise direction
    return top * 8 + right * 4 + bottom * 2 + left;
  };
}
