import ExtendedDungeon from "../Game/ExtendedDungeon";
import { WorldCoord, Region } from "../../_types/GlobalTypes";
import { CoordMap } from "../../Utils/CoordMap";
import { CIRCULAR_DIRECTIONS } from "../../Utils/Utils";

export function getSurroundingRegionsOfSameType(
  initialRegion: WorldCoord,
  isSameType: (region: Region, regionCoord: WorldCoord) => boolean,
  extendedDungeon: ExtendedDungeon
) {
  const visited = new CoordMap<boolean>();
  const queue: WorldCoord[] = [initialRegion];
  const surroundingTiles: WorldCoord[] = [initialRegion];

  const visit = (coords: WorldCoord) => {
    visited.set(coords, true);
  };

  const isValid = (coord: WorldCoord) => {
    const region = extendedDungeon.regions.get(coord);
    return region && !visited.get(coord) && isSameType(region, coord);
  };

  while (queue.length !== 0) {
    const current = queue.shift()!;
    visit(current);

    for (const direction of CIRCULAR_DIRECTIONS) {
      const adjacentRegion = { x: current.x + direction.x, y: current.y + direction.y };
      if (isValid(adjacentRegion)) {
        visit(adjacentRegion);
        queue.push(adjacentRegion);
        surroundingTiles.push(adjacentRegion);
      }
    }
  }

  return surroundingTiles;
}
