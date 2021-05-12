import { WorldCoord } from "../../_types/GlobalTypes";
import { TILE_WIDTH, TILE_HEIGHT } from "../constants";
import { tileCoordToRegionCoord } from "../../Backend/Utils/Utils";

export function worldCoordsEq(a: WorldCoord | undefined, b: WorldCoord | undefined): boolean {
  if (!a || !b) return false;
  return a.x === b.x && a.y === b.y;
}

export function serializeWorldCoord(a: WorldCoord, namespace?: string): string {
  return `${namespace ? namespace + "/" : ""}${a.x},${a.y}`;
}

export function deserializeWorldCoord(a: string, namespace?: string): WorldCoord {
  const [x, y] = a.substring(namespace ? namespace.length + 1 : 0).split(",");
  if (!x || !y) {
    throw new Error("couldn't deserialize world coord. namespace: " + namespace + ". data: " + a);
  }
  const out = { x: parseInt(x), y: parseInt(y) };
  return out;
}

export function worldCoordsToPhaserTileCoords(
  w: WorldCoord,
  mapWidth: number,
  mapHeight: number
): { x: number; y: number } {
  const phaserCoord = { x: w.x + mapWidth / 2, y: w.y + mapHeight / 2 };
  return phaserCoord;
}

export function pixelCoordToTileCoord(coord: WorldCoord): WorldCoord {
  return {
    x: Math.floor(coord.x / TILE_WIDTH),
    y: Math.floor(coord.y / TILE_HEIGHT),
  };
}

export function pixelCoordToRegionCoord(coord: WorldCoord): WorldCoord {
  const tileCoord = pixelCoordToTileCoord(coord);
  return tileCoordToRegionCoord(tileCoord);
}

export function tileCoordToPixelCoord(coord: WorldCoord): WorldCoord {
  return {
    x: Math.floor(coord.x * TILE_WIDTH),
    y: Math.floor(coord.y * TILE_HEIGHT),
  };
}

// export function tileCoordsToPhaserCoords(w: TileCoords): Phaser.Math.Vector2 {
//   const x = w.x + TILES_X;
//   const y = w.y + TILES_Y;
//   return new Phaser.Math.Vector2(x, y);
// }

//export function phaserCoordsToTileCoords(v: Phaser.Math.Vector2): TileCoords {
//  const x = v.x - TILES_X;
//  const y = v.y - TILES_Y;
//  return { x, y } as TileCoords
//}
//
//export function regionCoordsToPhaserCoords(w: TileCoords): Phaser.Math.Vector2 {
//  const x = w.x + TILES_X;
//  const y = w.y + TILES_Y;
//  return new Phaser.Math.Vector2(x, y)
//}
//
//export function phaserCoordsToTileCoords(v: Phaser.Math.Vector2): TileCoords {
//  const x = v.x - TILES_X;
//  const y = v.y - TILES_Y;
//  return { x, y } as TileCoords
//}
