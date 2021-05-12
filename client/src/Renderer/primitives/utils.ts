import { WorldCoord } from "../../_types/GlobalTypes";
import CenteredChunkedTilemap from "./CenteredChunkedTilemap";

export interface ForEachTileOptions {
  map: Phaser.Tilemaps.Tilemap | CenteredChunkedTilemap;
  layer: string;
  tileX?: number;
  tileY?: number;
  width?: number;
  height?: number;
  callback: (tile: Phaser.Tilemaps.Tile, coord: WorldCoord) => void;
}

export const forEachTile = ({ map, layer, tileX, tileY, width, height, callback }: ForEachTileOptions) => {
  //@ts-ignore
  map.forEachTile(callback, undefined, tileX, tileY, width, height, undefined, layer);
};
