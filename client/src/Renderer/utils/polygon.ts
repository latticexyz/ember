import { WorldCoord, Rectangle } from "../../_types/GlobalTypes";
import { CoordMap } from "../../Utils/CoordMap";
import { DIRECTIONS, mod } from "../../Utils/Utils";
import { worldCoordsEq } from "./worldCoords";
import { regionCoordToTileCoord, range } from "../../Backend/Utils/Utils";
import { REGION_LENGTH } from "../../Backend/Utils/Defaults";

export interface PixelCoords {
  x: number;
  y: number;
}

export function getCornerCoordsFromTile(tile: WorldCoord, width: number, height: number) {
  const topLeftCorner = { x: tile.x * width, y: tile.y * height };
  return [
    topLeftCorner,
    { x: topLeftCorner.x + width, y: topLeftCorner.y },
    { x: topLeftCorner.x + width, y: topLeftCorner.y + height },
    { x: topLeftCorner.x, y: topLeftCorner.y + height },
  ];
}

export function getCenterCoordFromTile(tileCoord: WorldCoord, tileWidth: number, tileHeight: number) {
  return { x: tileCoord.x * tileWidth + 0.5 * tileWidth, y: tileCoord.y * tileHeight + 0.5 * tileHeight };
}

export function getPolygonCornersFromTiles(tiles: WorldCoord[], width: number, height: number) {
  if (tiles.length === 0) {
    return [];
  }

  if (tiles.length === 1) {
    return getCornerCoordsFromTile(tiles[0], width, height);
  }

  const cornerGrid = new CoordMap<boolean>();
  let topLeftTile = tiles[0];
  let topLeftCorner: PixelCoords;

  tiles.forEach((tile) => {
    // Add all corners to cornerGrid
    const corners = getCornerCoordsFromTile(tile, width, height);
    corners.forEach((corner) => cornerGrid.set(corner, true));

    // Get top left corner
    if (tile.x <= topLeftTile.x && tile.y <= topLeftTile.y) {
      topLeftTile = tile;
      topLeftCorner = corners[0];
    }
  });

  const corners: PixelCoords[] = [topLeftCorner!];

  // Walk around the border and save corner points
  enum Turn {
    Left = -1,
    Straight = 0,
    Right = 1,
  }

  // We can be sure this exists because it's assigned in the
  // of the loop above first interation
  let currentCoord = topLeftCorner!;

  let currentDirectionIndex = 0;

  const getDirection = (turn: Turn) => {
    return DIRECTIONS[mod(currentDirectionIndex + turn, DIRECTIONS.length)];
  };

  const step = (turn: Turn) => {
    // If the current step turns left or right, the current pos is a corner
    if (turn !== Turn.Straight) {
      corners.push(currentCoord);
    }

    // Get the direction in which to step
    const direction = getDirection(turn);

    // Do the step
    currentCoord = {
      x: currentCoord.x + direction.x * width,
      y: currentCoord.y + direction.y * height,
    };

    // Update the current direction
    currentDirectionIndex += turn;
  };

  const checkNextStep = (turn: Turn): boolean => {
    // Get the direction in which to step
    const direction = getDirection(turn);

    const nextStep = {
      x: currentCoord.x + direction.x * width,
      y: currentCoord.y + direction.y * height,
    };

    return Boolean(cornerGrid.get(nextStep));
  };

  // Do ... while -> because in the first step currendCoord === topLeftCorner
  do {
    // For each direction, check if the next coord exists
    // Can't do in a loop because enums are weird
    // Try left first
    if (checkNextStep(Turn.Left)) {
      step(Turn.Left);
      continue;
    }

    // Then try straight
    if (checkNextStep(Turn.Straight)) {
      step(Turn.Straight);
      continue;
    }

    // Then try right
    if (checkNextStep(Turn.Right)) {
      step(Turn.Right);
      continue;
    }

    throw new Error("Can't move forward");
  } while (!worldCoordsEq(currentCoord, topLeftCorner!));

  // Finally return the corner coords
  return corners;
}

export function getRectangleCoordsFromDiagonal(start: WorldCoord, end: WorldCoord) {
  const minX = Math.min(start.x, end.x);
  const maxX = Math.max(start.x, end.x);
  const minY = Math.min(start.y, end.y);
  const maxY = Math.max(start.y, end.y);

  const coords: WorldCoord[] = [];
  for (let x = minX; x <= maxX; x++) {
    for (let y = minY; y <= maxY; y++) {
      coords.push({ x, y });
    }
  }

  return coords;
}

export function cornerTileCoordsFromRegionCoords(regionCoords: WorldCoord[]) {
  const tileCoords: WorldCoord[] = [];

  regionCoords.forEach((regionCoord) => {
    const topLeft = { x: regionCoord.x * REGION_LENGTH, y: regionCoord.y * REGION_LENGTH };
    const topRight = { x: (regionCoord.x + 1) * REGION_LENGTH - 1, y: regionCoord.y * REGION_LENGTH };
    const bottomLeft = { x: regionCoord.x * REGION_LENGTH, y: (regionCoord.y + 1) * REGION_LENGTH - 1 };
    const bottomRight = { x: (regionCoord.x + 1) * REGION_LENGTH - 1, y: (regionCoord.y + 1) * REGION_LENGTH - 1 };
    tileCoords.push(topLeft, topRight, bottomLeft, bottomRight);
  });

  return tileCoords;
}

export function tileCoordsFromRegionCoords(regionCoords: WorldCoord[]) {
  const tileCoords: WorldCoord[] = [];

  regionCoords.forEach((regionCoord) => {
    for (let x = 0; x < REGION_LENGTH; x++) {
      for (let y = 0; y < REGION_LENGTH; y++) {
        const tile = { x: regionCoord.x * REGION_LENGTH + Number(x), y: regionCoord.y * REGION_LENGTH + Number(y) };
        tileCoords.push(tile);
      }
    }
  });

  return tileCoords;
}

export function getCornerPointsFromRect(rect: Phaser.Geom.Rectangle) {
  const { x, y, width, height } = rect;
  return [
    { x, y },
    { x: x + width, y },
    { x, y: y + height },
    { x: x + width, y: y + height },
  ];
}
