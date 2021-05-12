import { WorldCoord } from "../_types/GlobalTypes";
import { CoordMap } from "./CoordMap";
import EventEmitter from "events";
import StrictEventEmitter from "strict-event-emitter-types";

export const DIRECTIONS = [
  { x: 0, y: 1 },
  { x: 1, y: 0 },
  { x: 0, y: -1 },
  { x: -1, y: 0 },
];

export const CIRCULAR_DIRECTIONS = [
  { x: 0, y: -1 },
  { x: 1, y: -1 },
  { x: 1, y: 0 },
  { x: 1, y: 1 },
  { x: 0, y: 1 },
  { x: -1, y: 1 },
  { x: -1, y: 0 },
  { x: -1, y: -1 },
];

export const NAMED_CIRCULAR_DIRECTIONS = {
  top: { x: 0, y: -1 },
  trDiag: { x: 1, y: -1 },
  right: { x: 1, y: 0 },
  brDiag: { x: 1, y: 1 },
  bottom: { x: 0, y: 1 },
  blDiag: { x: -1, y: 1 },
  left: { x: -1, y: 0 },
  tlDiag: { x: -1, y: -1 },
};

export const NAMED_VON_NEUMANN_DIRS = {
  top: { x: 0, y: -1 },
  right: { x: 1, y: 0 },
  bottom: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
};

export function translate(coord: WorldCoord, x: number, y: number) {
  return { x: coord.x + x, y: coord.y + y };
}

export function mod(a: number, b: number) {
  return ((a % b) + b) % b;
}

export function sfc32(a, b, c, d) {
  return function () {
    a >>>= 0;
    b >>>= 0;
    c >>>= 0;
    d >>>= 0;
    var t = (a + b) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    d = (d + 1) | 0;
    t = (t + d) | 0;
    c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  };
}

export function xmur3(str) {
  for (var i = 0, h = 1779033703 ^ str.length; i < str.length; i++)
    (h = Math.imul(h ^ str.charCodeAt(i), 3432918353)), (h = (h << 13) | (h >>> 19));
  return function () {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
  };
}

// General BFS implementation
export function longestPath(start: WorldCoord, tiles: WorldCoord[]) {
  const visited = new CoordMap<boolean>();
  const pathQueue: WorldCoord[][] = [];
  let longestPath: WorldCoord[] = [];
  const grid = new CoordMap<boolean>();
  tiles.forEach((tile) => grid.set(tile, true));

  const visit = (tile: WorldCoord) => {
    visited.set(tile, true);
  };

  const isValid = (tile: WorldCoord) => {
    return !visited.get(tile) && grid.get(tile);
  };

  const initialPath = [start];
  pathQueue.push(initialPath);
  longestPath = initialPath;
  visit(start);

  while (pathQueue.length !== 0) {
    // get the current path
    const currentPath = pathQueue.shift();
    if (!currentPath) continue;

    // get the tip of the current path
    const { x: currentX, y: currentY } = currentPath[currentPath.length - 1];

    for (const direction of DIRECTIONS) {
      const adjacentTile = { x: currentX + direction.x, y: currentY + direction.y };
      if (isValid(adjacentTile)) {
        // Extend the current path
        const newPath = [...currentPath, adjacentTile];
        visit(adjacentTile);
        pathQueue.push(newPath);

        if (newPath.length > longestPath.length) {
          longestPath = newPath;
        }
      }
    }
  }

  return longestPath;
}

export type Events<T> = T extends StrictEventEmitter<EventEmitter, infer E> ? E : never;
export type Entries<T> = [keyof T, T[keyof T]];

export function addListener<
  E extends StrictEventEmitter<EventEmitter, any>,
  K extends keyof Events<E>,
  V extends Events<E>[K]
>(eventEmitter: E, event: K, listener: V): Entries<Events<E>> {
  eventEmitter.addListener(event, listener);
  return [event, listener];
}
