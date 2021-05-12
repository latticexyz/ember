import { TerrainTilesetId, colors, ColorKey, WALL_IDS, GEM_WALL_IDS } from "../constants";
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
  if (tileIndex === TerrainTilesetId.Ground || isTileClaimed(tileIndex)) {
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
  return (
    tileIndex === TerrainTilesetId.OwnedGroundLvl1 ||
    tileIndex === TerrainTilesetId.OwnedGroundLvl2 ||
    tileIndex === TerrainTilesetId.OwnedGroundLvl3
  );
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

const ALL_WALL_IDS = [...Object.values(WALL_IDS), ...Object.values(GEM_WALL_IDS)].flat();
const ALL_GEM_WALL_IDS = Object.values(GEM_WALL_IDS).flat();

export const isTileWall = (tileIndex: number): boolean => {
  return tileIndex === TerrainTilesetId.Wall || ALL_WALL_IDS.includes(tileIndex);
};

export const isTileGemWall = (tileIndex: number): boolean => {
  return tileIndex === TerrainTilesetId.Wall || ALL_GEM_WALL_IDS.includes(tileIndex);
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
