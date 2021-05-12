import { TerrainTilesetId, colors, ColorKey, WALL_IDS } from "../constants";
import { EthAddress, WorldCoord } from "../../_types/GlobalTypes";
import { getColorFromEthAddress } from "./colors";
import ExtendedDungeon from "../../Backend/Game/ExtendedDungeon";
import { tileCoordToRegionCoord } from "../../Backend/Utils/Utils";

export const isRock = (tileIndex: number): boolean => {
  if (
    tileIndex === TerrainTilesetId.RockA ||
    tileIndex === TerrainTilesetId.RockB ||
    tileIndex === TerrainTilesetId.RockC ||
    tileIndex === TerrainTilesetId.RockD
  ) {
    return true;
  }
  return false;
};

export const isTileMined = (tileIndex: number): boolean => {
  if (tileIndex === TerrainTilesetId.Ground || tileIndex === TerrainTilesetId.OwnedGround) {
    return true;
  }
  return false;
};

export const isTileGold = (tileIndex: number): boolean => {
  return tileIndex === TerrainTilesetId.Gold;
};

export const isTileSoul = (tileIndex: number): boolean => {
  return tileIndex === TerrainTilesetId.Soul;
};

export const isTileClaimed = (tileIndex: number): boolean => {
  return tileIndex === TerrainTilesetId.OwnedGround;
};

export const isTileUnderInfluence = (
  tile: Phaser.Tilemaps.Tile | undefined,
  address: EthAddress,
  isCurrentPlayer = false
): boolean => {
  if (isCurrentPlayer) {
    return tile != null && tile.tint === (colors[ColorKey.Player] as number);
  } else {
    return tile != null && tile.tint === getColorFromEthAddress(address).color;
  }
};

function transpose(matrix: number[][]) {
  return matrix[0].map((col, i) => matrix.map((row) => row[i]));
}
const transposed = transpose(Object.values(WALL_IDS));

export const isTileWall = (tileIndex: number): boolean => {
  return tileIndex === TerrainTilesetId.Wall || transposed[0].includes(tileIndex);
};

export const isRockWall = (tileIndex: number): boolean => {
  return transposed[1].includes(tileIndex);
};

export const isTilePlayerWall = (tileIndex: number): boolean => {
  if (tileIndex === TerrainTilesetId.PlayerWall || tileIndex === TerrainTilesetId.PlayerWallMinedBottom) {
    return true;
  }
  return false;
};
export const isCoordUpgradable = (
  { x, y }: WorldCoord,
  map: Phaser.Tilemaps.Tilemap,
  player: EthAddress,
  extendedDungeon: ExtendedDungeon
): boolean => {
  const tileIsMined = isTileMined(map.getTileAt(x, y, true, "terrain")?.index);
  const tileIsClaimed = isTileClaimed(map.getTileAt(x, y, true, "terrain")?.index);
  const tileIsUpgraded = extendedDungeon.getTileAt({ x, y }).upgrade !== 0;
  const regionCoord = tileCoordToRegionCoord({ x, y });
  const { controller, disputed } = extendedDungeon.getRegionController(regionCoord);
  const tileIsUnderOwnInfluence = controller === player && !disputed;
  return tileIsMined && tileIsClaimed && tileIsUnderOwnInfluence && !tileIsUpgraded;
};
