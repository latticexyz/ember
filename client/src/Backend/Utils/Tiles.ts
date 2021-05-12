import ExtendedDungeon from "../Game/ExtendedDungeon";
import { WorldCoord, Tile } from "../../_types/GlobalTypes";
import { CoordMap } from "../../Utils/CoordMap";
import { DIRECTIONS } from "../../Utils/Utils";
import { tileCoordToRegionCoord } from "./Utils";

export function getSurroundingTilesOfSameType(
  initialCoord: WorldCoord,
  isSameType: (tile: Tile, worldCoord: WorldCoord) => boolean,
  extendedDungeon: ExtendedDungeon
) {
  const visited = new CoordMap<boolean>();
  const queue: WorldCoord[] = [initialCoord];
  const surroundingTiles: WorldCoord[] = [initialCoord];
  const initialRegion = tileCoordToRegionCoord(initialCoord);

  const visit = (coords: WorldCoord) => {
    visited.set(coords, true);
  };

  const isValid = (coord: WorldCoord) => {
    const tile = extendedDungeon.getTileAt(coord);
    return !visited.get(coord) && isSameType(tile, coord);
  };

  while (queue.length !== 0) {
    const current = queue.shift()!;
    visit(current);

    for (const direction of DIRECTIONS) {
      const adjacentTile = { x: current.x + direction.x, y: current.y + direction.y };
      if (isValid(adjacentTile)) {
        visit(adjacentTile);
        queue.push(adjacentTile);
        surroundingTiles.push(adjacentTile);
      }
    }
  }

  return surroundingTiles;
}
