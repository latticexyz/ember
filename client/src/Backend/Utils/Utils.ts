import { v4 } from "uuid";
import EventEmitter from "events";
import StrictEventEmitter from "strict-event-emitter-types";
import anylogger from "anylogger";

import { ActionType, Creature, EthAddress, Tile, TileDelayedAction, WorldCoord } from "../../_types/GlobalTypes";
import { ActionType as ContractActionType } from "../../_types/ContractTypes";
import Constants from "../Game/Constants";
import ExtendedDungeon from "../Game/ExtendedDungeon";
import { REGION_LENGTH } from "./Defaults";

import { NDMap } from "../../Utils/NDMap";
import { DIRECTIONS } from "../../Utils/Utils";
import { CoordMap } from "../../Utils/CoordMap";

import { GameMap } from "../../Renderer/objects/main/map";
import { InputState } from "../../Renderer/manager/InputManager";
import { worldCoordsEq } from "../../Renderer/utils/worldCoords";
import { getSurroundingCoords } from "./WorldCoords";

export function creatureEq(a: Creature, b: Creature): boolean {
  if (a.creatureType !== b.creatureType) {
    return false;
  }
  if (a.level !== b.level) {
    return false;
  }
  if (a.life !== b.life) {
    return false;
  }
  if (a.owner !== b.owner) {
    return false;
  }
  if (a.species !== b.species) {
    return false;
  }
  if (!worldCoordsEq(a.tileCoord, b.tileCoord)) {
    return false;
  }
  return true;
}

export function sleep<T>(timeout: number, returns?: T): Promise<T> {
  return new Promise<T>((resolve) => setTimeout(() => resolve(returns as T), timeout));
}

export async function rejectAfter<T>(ms: number, msg: string): Promise<T> {
  await sleep(ms);
  throw new Error(msg);
}

export function neverResolves(): Promise<void> {
  return new Promise(() => {});
}

export function concatUint8Arrays(arrays: Uint8Array[]): Uint8Array {
  // sum of individual array lengths
  let totalLength = arrays.reduce((acc, value) => acc + value.length, 0);

  if (!arrays.length) throw new Error("array is null");

  let result = new Uint8Array(totalLength);

  // for each array - copy it over result
  // next array is copied right after the previous one
  let length = 0;
  for (let array of arrays) {
    result.set(array, length);
    length += array.length;
  }

  return result;
}

const log = anylogger("net-primitive");

export const aggregateBulkGetter = async <T>(
  total: number,
  querySize: number,
  getterFn: (startIdx: number, endIdx: number) => Promise<T[]>,
  update?: (percentageComplete: number) => void,
  spacedInMs = 0
) => {
  const id = v4();
  log.info(`${id}: starting an aggregate bulk of size ${total} with query size ${querySize}`);
  const promises: Promise<T[]>[] = [];
  let soFar = 0;

  for (let i = 0; i < total / querySize; i += 1) {
    const start = i * querySize;
    const end = Math.min((i + 1) * querySize, total);

    await sleep(spacedInMs);

    promises.push(
      new Promise<T[]>(async (resolve) => {
        let res: T[] = [];
        while (res.length === 0) {
          log.debug(`${id}: query number ${i + 1}`);
          const fetchStart = Date.now();
          res = await getterFn(start, end);
          log.debug(`${id}: query done! ${Math.round(Date.now() - fetchStart)}ms`);
          if (res.length === 0) {
            break;
          }
          if (update && Math.floor((soFar * 20) / total) !== Math.floor(((soFar + querySize) * 20) / total)) {
            // print every 5%
            let percent = Math.floor(((soFar + querySize) * 20) / total) * 5;
            percent = Math.min(percent, 100);
            update(percent);
          }
          soFar += querySize;
          // console.log(`retrieved ${start}-${end}.`);
        }
        resolve(res);
      })
    );
  }
  const unflattenedResults = await Promise.all(promises);
  return unflattenedResults.flat();
};

export type RetryErrorHandler = (i: number, e: Error) => void;

export const callWithRetry = async <T>(
  fn: (...args: unknown[]) => Promise<T>,
  args: unknown[] = [],
  onError?: RetryErrorHandler,
  maxRetries = 10,
  retryInterval = 1000
): Promise<T> => {
  const id = v4();
  log.info(`${id}: starting a call with retry`);
  return new Promise<T>(async (resolve, reject) => {
    let res: T;
    for (let i = 0; i < maxRetries; i++) {
      try {
        log.debug(`${id}: call number ${i + 1}`);
        res = await fn(...args);
        log.info(`${id}: succeeded!`);
        resolve(res);
        break;
      } catch (e) {
        log.warn(`${id}: number ${i + 1} failed!`);
        log.error(e);
        if (onError) {
          try {
            onError(i, e);
          } catch (e) {
            // console.log(`failed executing callWithRetry error handler`, e);
          }
        }

        if (i < maxRetries - 1) {
          await sleep(Math.min(retryInterval * 2 ** i + Math.random() * 100, 15000));
          log.warn(`${id}: retrying...`);
        } else {
          reject(e);
        }
      }
    }
  });
};

export const timeoutAfter = async <T>(promise: Promise<T>, ms: number, timeoutMsg: string) => {
  return Promise.race([promise, rejectAfter<T>(ms, timeoutMsg)]);
};

export function deferred<T>(): [(t: T) => void, (t: Error) => void, Promise<T>] {
  let resolve: ((t: T) => void) | null = null;
  let reject: ((t: Error) => void) | null = null;
  const promise = new Promise<T>((r, rj) => {
    resolve = (t: T) => r(t);
    reject = (e: Error) => rj(e);
  });
  return [resolve as any, reject as any, promise];
}

export function concatMap<K, V>(map: Map<K, V>, map2: Map<K, V>): void {
  for (const [k, v] of map2.entries()) {
    map.set(k, v);
  }
}

export function concatCoordMap<V>(map: CoordMap<V>, map2: CoordMap<V>): void {
  for (const [k, v] of map2.entries()) {
    const coord = CoordMap.coordFromKey(k);
    map.set(coord, v);
  }
}

export function reverseMap<K, V>(map: Map<K, V>): Map<V, K> {
  const m: Map<V, K> = new Map<V, K>();
  for (const [k, v] of map.entries()) {
    m.set(v, k);
  }
  return m;
}

export function reverseMapToCoordMap<K>(map: Map<K, WorldCoord>): CoordMap<K> {
  const m: CoordMap<K> = new CoordMap<K>();
  for (const [k, v] of map.entries()) {
    m.set(v, k);
  }
  return m;
}

export function joinMaps<A, B, C>(map1: Map<A, B>, map2: Map<B, C>): Map<A, C> {
  if (map1.keys.length != map2.keys.length) {
    throw new Error("Maps must have the same length");
  }

  const joinedMap = new Map<A, C>();

  for (const [k, v] of map1.entries()) {
    const value = map2.get(v);
    if (value == null) {
      // console.log(map1, map2);
      throw new Error(`Key not found: ${k} / ${v}`);
    }
    joinedMap.set(k, value);
  }

  return joinedMap;
}

export function joinCoordMapWithMap<B, C>(map1: CoordMap<B>, map2: Map<B, C>): CoordMap<C> {
  if (map1.keys.length != map2.keys.length) {
    throw new Error("Maps must have the same length");
  }

  const joinedMap = new CoordMap<C>();

  for (const [stringifiedK, v] of map1.entries()) {
    const value = map2.get(v);
    if (value == null) {
      // console.log(map1, map2);
      throw new Error(`Key not found: ${stringifiedK} / ${v}`);
    }
    joinedMap.set(CoordMap.coordFromKey(stringifiedK), value);
  }

  return joinedMap;
}

export function range(until: number): IterableIterator<number> {
  return new Array(until).keys();
}

export function rangeStart(start: number, until: number): number[] {
  return [...new Array(until).keys()].map((i) => i + start);
}

export function createStrictEventEmitterClass<T>() {
  const TypedEmitter: {
    new (): StrictEventEmitter<EventEmitter, T>;
  } = EventEmitter as any;

  return TypedEmitter;
}

/*
  Given a coordinate for a region, computes the top left corner of that region and
  then computes all of the tile coordinates that are enclosed in the given region.
*/
export function regionCoordToSetOfTileCoords(coord: WorldCoord): WorldCoord[][] {
  // Compute top-left corner.
  const { x, y } = regionCoordToTileCoord(coord);
  const tiles: WorldCoord[][] = [];

  for (let i = 0; i < REGION_LENGTH; i++) {
    const tileRow: WorldCoord[] = [];
    for (let j = 0; j < REGION_LENGTH; j++) {
      tileRow.push({
        x: x + i,
        y: y + j,
      });
    }
    tiles.push(tileRow);
  }
  return tiles;
}

// Returns the top left corner
export function regionCoordToTileCoord(coord: WorldCoord): WorldCoord {
  return {
    x: Math.floor(coord.x * REGION_LENGTH),
    y: Math.floor(coord.y * REGION_LENGTH),
  };
}

export function regionCoordToCenterTileCoords(coord: WorldCoord): [WorldCoord, WorldCoord, WorldCoord, WorldCoord] {
  const topLeft = regionCoordToTileCoord(coord);
  const tlX = topLeft.x + REGION_LENGTH / 2 - 1;
  const tlY = topLeft.y + REGION_LENGTH / 2 - 1;

  return [
    { x: tlX, y: tlY },
    { x: tlX + 1, y: tlY },
    { x: tlX, y: tlY + 1 },
    { x: tlX + 1, y: tlY + 1 },
  ];
}

export function tileCoordToRegionCoord(coords: WorldCoord): WorldCoord {
  return {
    x: Math.floor(coords.x / REGION_LENGTH),
    y: Math.floor(coords.y / REGION_LENGTH),
  };
}

export function tilesInRegion(coord: WorldCoord): WorldCoord[] {
  const tiles: WorldCoord[] = [];
  const { x, y }: WorldCoord = regionCoordToTileCoord(coord);
  for (const yShift of range(REGION_LENGTH)) {
    for (const xShift of range(REGION_LENGTH)) {
      tiles.push({ x: x + xShift, y: y + yShift });
    }
  }
  return tiles;
}

export function manhattan(a: WorldCoord, b: WorldCoord) {
  const d1 = Math.abs(a.x - b.x);
  const d2 = Math.abs(a.y - b.y);
  return d1 + d2;
}

export function chebyshev(a: WorldCoord, b: WorldCoord) {
  const d1 = Math.abs(a.x - b.x);
  const d2 = Math.abs(a.y - b.y);
  return Math.max(d1, d2);
}

export function l2(a: WorldCoord, b: WorldCoord) {
  const d1 = (a.x - b.x) ** 2;
  const d2 = (a.y - b.y) ** 2;
  return Math.sqrt(d1 + d2);
}

export function checkInRange(maxX: number, maxY: number): (coord: WorldCoord) => boolean {
  return (coord: WorldCoord) => {
    if (coord.x > maxX) {
      return false;
    }
    if (coord.y > maxY) {
      return false;
    }
    if (coord.x < -(maxX + 1)) {
      return false;
    }
    if (coord.y < -(maxY + 1)) {
      return false;
    }
    return true;
  };
}

export function createTouchProofFilterFunction(
  startRegion: WorldCoord,
  goalRegion: WorldCoord
): (coord: WorldCoord) => boolean {
  return (c: WorldCoord) => {
    const neighbourRegion = tileCoordToRegionCoord(c);
    if (worldCoordsEq(neighbourRegion, startRegion) || worldCoordsEq(neighbourRegion, goalRegion)) {
      return true;
    } else {
      return false;
    }
  };
}

export function aStar(
  start: WorldCoord,
  goal: WorldCoord,
  extendedDungeon: ExtendedDungeon,
  filterFunction: (coords: WorldCoord) => boolean
): WorldCoord[] | undefined {
  const openSet: string[] = [CoordMap.constructKey(start)];
  const cameFrom: CoordMap<WorldCoord> = new CoordMap<WorldCoord>();
  const gScore: CoordMap<number> = new CoordMap<number>();
  gScore.set(start, 0);
  const fScore: CoordMap<number> = new CoordMap<number>();
  fScore.set(start, l2(start, goal));
  while (openSet.length > 0) {
    const currentSerialized: string = openSet.sort((_a, _b) => {
      const a = CoordMap.coordFromKey(_a);
      const b = CoordMap.coordFromKey(_b);
      const scoreA = fScore.get(a) ?? 10 ** 18;
      const scoreB = fScore.get(b) ?? 10 ** 18;
      return scoreA - scoreB;
    })[0];
    const current: WorldCoord = CoordMap.coordFromKey(currentSerialized);
    if (manhattan(current, goal) === 0) {
      let reconstructedCurrent: WorldCoord = current;
      const bestPath = [current];
      while (cameFrom.has(reconstructedCurrent)) {
        reconstructedCurrent = cameFrom.get(reconstructedCurrent)!;
        bestPath.unshift(reconstructedCurrent);
      }
      return bestPath;
    }
    // remove current
    openSet.splice(0, 1);
    const neighbours = [
      { x: current.x + 1, y: current.y },
      { x: current.x, y: current.y + 1 },
      { x: current.x - 1, y: current.y },
      { x: current.x, y: current.y - 1 },
    ];
    for (const n of neighbours) {
      try {
        if (filterFunction(n) || manhattan(n, goal) === 0) {
          const tentativeGScore = (gScore.get(current) ?? 10 ** 18) + 1;
          if (tentativeGScore < (gScore.get(n) ?? 10 ** 18)) {
            cameFrom.set(n, current);
            gScore.set(n, tentativeGScore);
            fScore.set(n, (gScore.get(n) ?? 10 ** 18) + l2(n, goal));
            if (!openSet.includes(CoordMap.constructKey(n))) {
              openSet.push(CoordMap.constructKey(n));
            }
          }
        }
      } catch (e) {
        // console.log("Skipping tile at ", n, "because it is not explored");
      }
    }
  }
  return undefined;
}

export function bfs({
  start,
  pathLimit = 20,
  regionLimit = 1,
  checkDiagonal,
  pathRequirement,
  startRequirement,
  endRequirement,
}: {
  start: WorldCoord;
  pathLimit?: number;
  regionLimit?: number;
  checkDiagonal?: boolean;
  pathRequirement?: (tile: WorldCoord) => boolean;
  startRequirement?: (tile: WorldCoord) => boolean;
  endRequirement: (tile: WorldCoord, path?: WorldCoord[]) => boolean;
}): WorldCoord[] | null {
  const visited: { [x: number]: { [y: number]: boolean } } = {};
  const pathQueue: WorldCoord[][] = [];
  const tileRegion = tileCoordToRegionCoord(start);

  function visit(tile: WorldCoord) {
    if (visited[tile.x] === undefined) {
      visited[tile.x] = { [tile.y]: true };
    } else {
      visited[tile.x][tile.y] = true;
    }
  }

  function isVisited(tile: WorldCoord) {
    return visited[tile.x] && visited[tile.x][tile.y];
  }

  function distance(a: WorldCoord, b: WorldCoord): number {
    if (checkDiagonal) {
      return chebyshev(a, b);
    } else {
      return manhattan(a, b);
    }
  }

  // Check whether the tile can be visited (ie is mined and on the map)
  function isValid(tile: WorldCoord): boolean {
    // If tile has already been visited
    if (isVisited(tile)) {
      return false;
    }

    // If tile fits the pathRequirement
    if (pathRequirement && !pathRequirement(tile)) {
      return false;
    }

    // If tile lies within 1 region distance to the start tile
    if (distance(tileRegion, tileCoordToRegionCoord(tile)) > regionLimit) {
      return false;
    }

    return true;
  }

  if (startRequirement && !startRequirement(start)) return null;

  pathQueue.push([start]);
  visit(start);

  while (pathQueue.length !== 0) {
    // Get the current path
    const currentPath = pathQueue.shift();
    if (!currentPath) continue;

    // Get the tip of the current path
    const { x: currentX, y: currentY } = currentPath[currentPath.length - 1];

    // Check for tiles in all directions
    for (const direction of DIRECTIONS) {
      const adjacentTile = { x: currentX + direction.x, y: currentY + direction.y };
      if (isValid(adjacentTile)) {
        // Extend the current path
        const newPath = [...currentPath, adjacentTile];
        visit(adjacentTile);

        // If the adjacent tile is a valid endpoint, stop the search
        if (endRequirement(adjacentTile, newPath)) {
          return [...newPath].reverse();
        }

        // If the current path is short enough to be extended again, push it to the queue
        if (newPath.length < pathLimit) {
          pathQueue.push(newPath);
        }
      }
    }
  }

  return null;
}

export function dfs({
  start,
  pathLimit = 20,
  regionLimit = 1,
  pathRequirement,
}: {
  start: WorldCoord;
  pathLimit?;
  regionLimit?;
  pathRequirement?: (tile: WorldCoord) => boolean;
}): WorldCoord[] {
  const visited: { [x: number]: { [y: number]: boolean } } = {};
  const queue: WorldCoord[] = [];
  // from to tuple
  const path: [WorldCoord, WorldCoord][] = [];
  const tileRegion = tileCoordToRegionCoord(start);

  function visit(tile: WorldCoord) {
    if (visited[tile.x] === undefined) {
      visited[tile.x] = { [tile.y]: true };
    } else {
      visited[tile.x][tile.y] = true;
    }
  }

  function isVisited(tile: WorldCoord) {
    return visited[tile.x] && visited[tile.x][tile.y];
  }

  // Check whether the tile can be visited (ie is mined and on the map)
  function isValid(tile: WorldCoord): boolean {
    // If tile has already been visited
    if (isVisited(tile)) {
      return false;
    }

    // If tile fits the pathRequirement
    if (pathRequirement && !pathRequirement(tile)) {
      return false;
    }
    if (manhattan(tileRegion, tileCoordToRegionCoord(tile)) > regionLimit) {
      return false;
    }

    return true;
  }

  const directionX = [-1, 0, 1, 0];
  const directionY = [0, 1, 0, -1];

  queue.push(start);
  path.push([start, start]);
  visit(start);

  const postProcess = (path: [WorldCoord, WorldCoord][]) => {
    const postProcessedPath: WorldCoord[] = [path.shift()![1]];
    for (const [from, to] of path) {
      if (postProcessedPath.length >= pathLimit) {
        return postProcessedPath;
      }
      if (manhattan(postProcessedPath[postProcessedPath.length - 1], to) <= 1) {
        postProcessedPath.push(to);
      } else {
        postProcessedPath.push(from, to);
      }
    }
    return postProcessedPath;
  };

  while (queue.length !== 0) {
    // Get the current path
    const currentCoord = queue.pop();
    if (!currentCoord) continue;

    // Get the tip of the current path
    const { x: currentX, y: currentY } = currentCoord;

    // Check for tiles in all directions
    for (let i = 0; i < 4; i++) {
      const adjacentTile = { x: currentX + directionX[i], y: currentY + directionY[i] };
      if (isValid(adjacentTile)) {
        // Extend the current path
        visit(adjacentTile);
        // If the current path is short enough to be extended again, push it to the queue
        if (path.length < pathLimit) {
          path.push([currentCoord, adjacentTile]);
          queue.push(adjacentTile);
        } else {
          return postProcess(path);
        }
      }
    }
  }
  return postProcess(path);
}

export function getMinimumDelayToCompleteDelayedAction(
  delayedAction: TileDelayedAction,
  extendedDungeon: ExtendedDungeon,
  player: EthAddress,
  constants: Constants
): number {
  const regionCoords: WorldCoord = tileCoordToRegionCoord(delayedAction.coord);
  const { controller, disputed } = extendedDungeon.getRegionController(regionCoords);
  const playerControlsRegion = controller === player && !disputed;
  return constants.gameConstants.DELAYED_ACTIONS_MIN_SECOND_DELAY[delayedAction.delayedActionType][
    playerControlsRegion ? 0 : 1
  ];
}

export function notNull<T>(something: T | null | undefined): something is T {
  return something != null;
}

export function getUniqueRegionCoords(tileCoords: WorldCoord[]): WorldCoord[] {
  const regions = new CoordMap<boolean>();
  for (const tileCoord of tileCoords) {
    regions.set(tileCoordToRegionCoord(tileCoord), true);
  }
  return regions.coords();
}

/*
Get a tile coordinate at the current position of the cursor.
*/
export function getWorldCoordsAtPointerPosition(input: InputState, gameMap: GameMap): WorldCoord | undefined {
  const pointer = input.deviceMouse.key;
  const worldPoint = pointer.positionToCamera(gameMap.camera) as Phaser.Math.Vector2;
  if (!worldPoint) return;

  // Add half to width and half the height to the coord to fix this.
  const pointerTileXY = gameMap.map.worldToTileXY(worldPoint.x, worldPoint.y);
  if (!pointerTileXY) return;

  return { x: pointerTileXY.x, y: pointerTileXY.y };
}

/// Creature movement path.

export enum MovementPathType {
  SHORT = "short",
  LONG = "long",
  INACCESSIBLE = "inaccessible",
}

export interface MovementPath {
  path: WorldCoord[];
  type: MovementPathType;
}

export interface Move {
  startRegion: WorldCoord;
  endRegion: WorldCoord;
  // Optional since we can have an intermediary move when
  // doing a meta-move where we don't care which tile we
  // move to, as long as there's one available in region.
  endTile: WorldCoord | undefined;
}

/*
Returns a path, if any, to a specific region and optionally a tile in a specific destination region.

The caller always has to specify what the destination region is via 'destinationRegion' parameter, but
also has the option to specify a 'destinationTile'.

If 'destinationTile' is specified and is not 'undefined', then the function returns the path, if any,
to the destination tile, otherwise the path returned is a path to *any valid* tile in 'destinationRegion'.

Can be used for
(1) Performing a 'simple' move of a creature (destination tile specified).
(2) Performing the "final" move as part of a meta-move (destination tile specified).
(3) Performing an intermidiary move as part of a meta-move (destination tile not specified). Intermediary
    moves can move creatures to whatever tiles in the intermediary region, as long as at least one is 
    available.
*/
export function getPathToDestinationTile({
  creatureIds,
  destinationRegion,
  destinationTile,
  pathLimit,
  extendedDungeon,
  playerAddress,
  regionLimit,
}: {
  creatureIds: string[];
  destinationRegion: WorldCoord;
  destinationTile: WorldCoord | undefined;
  pathLimit: number;
  extendedDungeon: ExtendedDungeon;
  playerAddress: string;
  regionLimit: number;
}): { path: WorldCoord[]; destinationTile: WorldCoord; regionsWithEnemyCreatures: WorldCoord[] } | null {
  const creatures = creatureIds.map((id) => extendedDungeon.creatures.get(id)).filter(notNull);
  const creatureLocations = creatures.map((creature) => creature.tileCoord);

  const isTraversable = (tile?: Tile): boolean =>
    !!tile && tile.isMined && (!tile.isWalled || tile.owner === playerAddress);

  // Compute path to either the specified tile or to closest tile in specified region.
  const reversedSingleCreaturePath = bfs({
    // Start from the first creature of selection location.
    start: creatureLocations[0],
    pathLimit,
    regionLimit,
    checkDiagonal: false,
    pathRequirement: (tileCoord) => {
      const tile = extendedDungeon.tiles.get(tileCoord);
      return isTraversable(tile);
    },
    endRequirement: (tileCoord) => {
      const currentRegionCoord = tileCoordToRegionCoord(tileCoord);
      if (!worldCoordsEq(currentRegionCoord, destinationRegion)) {
        return false;
      }

      // This condition checks that the path is at the exact tile. If we don't want to enforce this
      // requirement and treat any tile as an OK destination within a region, we just pass in 'undefined'.
      if (destinationTile && !worldCoordsEq(tileCoord, destinationTile)) {
        return false;
      }

      const tile = extendedDungeon.tiles.get(tileCoord);
      return isTraversable(tile);
    },
  });

  if (!reversedSingleCreaturePath) {
    return null;
  }

  // If no destination tile was given, then we pick one from the path that we just
  // computed in the previous step.
  if (!destinationTile) {
    destinationTile = reversedSingleCreaturePath[0];
  }

  // Check creature limit
  const toCreatures = extendedDungeon.getCreaturesInRegion(destinationRegion);
  const hasEnemyCreatures = toCreatures.length > 0 && toCreatures[0].owner !== playerAddress;

  if (!hasEnemyCreatures && toCreatures.length + creatures.length > 8) {
    throw new Error("Moving to this region would violate the limit of 8 creatures per region");
  }

  const startRegion = tileCoordToRegionCoord(creatureLocations[0]);

  // Get all enemy creatures along the path
  // 1) get all crossed regions
  const singleCreaturePath = [...reversedSingleCreaturePath].reverse();
  const crossedRegions = getUniqueRegionCoords(singleCreaturePath).filter(
    (regionCoord) => !worldCoordsEq(regionCoord, startRegion)
  );

  // 2) get all enemy creatures on the path
  const enemyCreatureLocations: WorldCoord[][] = [];
  const regionsWithEnemyCreatures: WorldCoord[] = [];

  for (const regionCoord of crossedRegions) {
    const creatures = extendedDungeon.getCreaturesInRegion(regionCoord);
    const hasEnemyCreatures = creatures.length > 0 && creatures[0].owner !== playerAddress;
    if (hasEnemyCreatures) {
      regionsWithEnemyCreatures.push(regionCoord);
      enemyCreatureLocations.push(creatures.map((creature) => creature.tileCoord));
    }
  }

  const reachableRegions = getSurroundingCoords(startRegion, regionLimit);
  const validRegions = new CoordMap<boolean>();
  validRegions.set(startRegion, true);
  for (const region of reachableRegions) validRegions.set(region, true);

  const isValidTile = (coord: WorldCoord) => {
    const regionCoord = tileCoordToRegionCoord(coord);
    const tile = extendedDungeon.getTileAt(coord);
    return isTraversable(tile) && Boolean(validRegions.get(regionCoord));
  };

  const path = getFamilyPathToDestinationTile({
    family: creatureLocations,
    otherFamilies: enemyCreatureLocations,
    destination: destinationTile,
    pathLimit,
    extendedDungeon: extendedDungeon,
    filterFunction: isValidTile,
  });

  if (!path) {
    console.warn("No path found to the destination tile or destination region");
    return null;
  }

  return {
    path,
    destinationTile,
    regionsWithEnemyCreatures,
  };
}

export function getFamilyPathToDestinationTile({
  family,
  otherFamilies = [],
  destination,
  pathLimit,
  extendedDungeon,
  filterFunction,
}: {
  family: WorldCoord[];
  otherFamilies?: WorldCoord[][];
  destination: WorldCoord;
  pathLimit: number;
  extendedDungeon: ExtendedDungeon;
  filterFunction: (coord: WorldCoord) => boolean;
}): WorldCoord[] | null {
  // MultiDimensional CoordMap
  const minPaths = new NDMap<WorldCoord[], WorldCoord>((keys) => keys.map(({ x, y }) => `${x}$${y}`).join("/"));

  const getMinPathBetweenPair = (a: WorldCoord, b: WorldCoord): WorldCoord[] | undefined => {
    const existingSolution = minPaths.get([a, b]);
    if (existingSolution) return existingSolution;

    // TODO: optimize by using floyd-warshall or other dynamic programming algorithm
    const minPath = aStar(a, b, extendedDungeon, filterFunction);
    if (!minPath) return;
    minPaths.set([a, b], minPath);
    minPaths.set([b, a], [...minPath].reverse());
    return minPath;
  };

  // Early return if the first creature can not reach one of the other families
  for (const otherFamily of otherFamilies) {
    if (!getMinPathBetweenPair(family[0], otherFamily[0])) {
      return null;
    }
  }

  // Try to find a permutation below the required length
  // 1) Pick up family, 2) Pick up enemy families in crossed regions, 3) Go to destination, 3) Pick up enemy family in destination region
  const pathFamilies = [...otherFamilies];
  const lastFamily = pathFamilies.pop() || [];

  const lastFamilyIsInDestinationRegion =
    lastFamily.length > 0 && worldCoordsEq(tileCoordToRegionCoord(lastFamily[0]), tileCoordToRegionCoord(destination));

  const visitingOrder = lastFamilyIsInDestinationRegion
    ? [family, ...pathFamilies, [destination], lastFamily]
    : [family, ...pathFamilies, lastFamily, [destination]];

  const visitingPermutations = getNestedPermutationIterator(visitingOrder);

  for (const visitingPermutation of visitingPermutations) {
    // Compute length of this permutation
    let path: WorldCoord[] = [];
    let invalid = false;
    for (let i = 1; i < visitingPermutation.length; i++) {
      const prevElement = visitingPermutation[i - 1];
      const currElement = visitingPermutation[i];
      const partialPath = getMinPathBetweenPair(prevElement, currElement);
      if (!partialPath) {
        // If there is no path between nodes in this permutation, it is invalid
        invalid = true;
        break;
      }
      path =
        i === visitingPermutation.length - 1
          ? path.concat(partialPath)
          : path.concat(partialPath.slice(0, partialPath.length - 1));
    }

    // If the current permutation leads to a valid path, return it
    if (!invalid && path.length <= pathLimit) {
      return path;
    }
  }

  return null;
}

export function getRandomPermutation<T>(array: T[]): T[] {
  const randomPermutationIndex = Math.floor(Math.random() * factorial(array.length));
  const lehmerCode = lehmerCodeFromInt(randomPermutationIndex, array.length);
  return permutationFromLehmerCode(lehmerCode, array);
}

function lehmerCodeFromInt(int: number, permSize: number) {
  if (permSize <= 1) return [0];
  const multiplier = factorial(permSize - 1);
  const digit = Math.floor(int / multiplier);
  return [digit].concat(lehmerCodeFromInt(int % multiplier, permSize - 1));
}

function permutationFromLehmerCode<T>(code: number[], array: T[]): T[] {
  let tempArray = [...array];
  return code.map((index) => {
    const elem = tempArray[index];
    tempArray.splice(index, 1);
    return elem;
  });
}

function getPermutationByIndex<T>(array: T[], index: number) {
  const lehmerCode = lehmerCodeFromInt(index, array.length);
  const permutation = permutationFromLehmerCode(lehmerCode, array);
  return permutation;
}

export function getPermutationIterator<T>(array: T[]): Iterable<T[]> {
  let currentIndex = 0;
  const numPermutations = factorial(array.length);

  const iterator = {
    next: () => {
      const permutation = getPermutationByIndex(array, currentIndex);
      currentIndex++;
      const done = currentIndex > numPermutations;
      if (array.length === 0) return { value: [], done };
      return { value: permutation, done };
    },
    [Symbol.iterator]: function () {
      return this;
    },
  };

  return iterator;
}

/**
 * Returns an iterator for a flat array containing the elements from the input array
 * partially-ordered by the groups of the input array
 * @param arrays
 */
export function getNestedPermutationIterator<T>(arrays: T[][]): any {
  const nonEmptyArrays = arrays.filter((array) => array.length > 0);
  const permutationLimits = nonEmptyArrays.map((array) => factorial(array.length));
  const permutationIndices = nonEmptyArrays.map(() => 0);
  let hasNext = true;

  // Just like integer increase but with different limits per digit
  // Returns true if increasing was possible
  const increasePermutationIndices = (): boolean => {
    const firstIndexBelowLimit = permutationIndices.findIndex(
      (permutationIndex, index) => permutationIndex < permutationLimits[index] - 1
    );
    if (firstIndexBelowLimit === -1) return false;
    for (let i = 0; i < firstIndexBelowLimit; i++) {
      permutationIndices[i] = 0;
    }
    permutationIndices[firstIndexBelowLimit]++;
    return true;
  };

  const iterator = {
    next: () => {
      const permutation = nonEmptyArrays
        .map((array, index) => getPermutationByIndex(array, permutationIndices[index]))
        .flat(1);
      const done = !hasNext;
      hasNext = increasePermutationIndices();
      return { value: permutation, done };
    },
    [Symbol.iterator]: function () {
      return this;
    },
  };

  return iterator;
}

export function factorial(n: number) {
  if (n <= 0) {
    return 1;
  } else {
    return n * factorial(n - 1);
  }
}

export function _checkConnection(_tiles: WorldCoord[]) {
  let tilesToVisit = _tiles.length;

  // Make a copy of the input array because it will be modified
  const tiles: any[] = new Array(_tiles.length);
  for (let i = 0; i < _tiles.length; i++) {
    tiles[i] = _tiles[i];
  }
  // The queue contains tiles whose neighbors havent been checked yet
  const queue: WorldCoord[] = new Array(_tiles.length);

  // Init the queue with the first tile and ignore this tile in future iterations
  queue[0] = tiles[0];
  let queueLength = 1;
  tilesToVisit--;
  tiles[0] = tiles[tilesToVisit];
  tiles[tilesToVisit] = null;

  while (queueLength > 0) {
    queueLength--;
    const current = queue[queueLength];
    let addedToQueue = 0;
    for (let i = 0; i < tilesToVisit - addedToQueue; i++) {
      // Add all tiles that are adjacent to this tile and have not been visited yet to the queue
      if (manhattan(current, tiles[i]) == 1) {
        // Add tile to queue
        queue[queueLength] = tiles[i];
        queueLength++;

        // Ignore this tile in future iterations
        tiles[i] = tiles[tilesToVisit - addedToQueue - 1];
        tiles[tilesToVisit - addedToQueue - 1] = null;
        addedToQueue++;

        // Check the index again that we've just moved a tile to
        i--;
      }
    }
    // Reduce list size, tiles in the end have been moved to the front
    tilesToVisit -= addedToQueue;
  }
  return tilesToVisit;
}

export const ActionTypeToContractActionType = {
  [ActionType.ClaimTile]: ContractActionType.CLAIM,
  [ActionType.MineTile]: ContractActionType.MINE,
  [ActionType.UpgradeTile]: ContractActionType.UPGRADE,
};
