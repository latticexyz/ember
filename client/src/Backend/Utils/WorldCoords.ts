import { WorldCoord } from "../../_types/GlobalTypes";
import { CoordMap } from "../../Utils/CoordMap";
import { DIRECTIONS } from "../../Utils/Utils";
import { manhattan } from "./Utils";

export function getAdjacentCoords(start: WorldCoord): WorldCoord[] {
  return getSurroundingCoords(start, 1);
}

export function getSurroundingCoords(start: WorldCoord, maxDistance: number): WorldCoord[] {
  const coords: WorldCoord[] = [];

  const visited = new CoordMap<boolean>();
  visited.set(start, true);

  const queue = [start];
  while (queue.length !== 0) {
    // For each new item, add its neighbors if they're within maxDistance
    const current = queue.shift()!;
    for (const direction of DIRECTIONS) {
      const newCoord = { x: current.x + direction.x, y: current.y + direction.y };
      if (visited.get(newCoord)) continue;
      const distance = manhattan(start, newCoord);
      if (distance <= maxDistance) {
        coords.push(newCoord);
        // If newCoord is already at maxDistance, no need to check its neighbors
        if (distance !== maxDistance) queue.push(newCoord);
      }
    }
  }

  return coords;
}
