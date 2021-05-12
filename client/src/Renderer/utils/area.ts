import { WorldCoord, Area, Rectangle } from "../../_types/GlobalTypes";
import { tileCoordToRegionCoord, regionCoordToTileCoord } from "../../Backend/Utils/Utils";
import { REGION_LENGTH } from "../../Backend/Utils/Defaults";
import { CoordMap } from "../../Utils/CoordMap";

export function areaEq(area1: Area, area2: Area) {
  return (
    area1.tileX === area2.tileX &&
    area1.tileY === area2.tileY &&
    area1.width === area2.width &&
    area1.height === area2.height
  );
}

export function isTileInArea(tileCoord: WorldCoord, area: Area) {
  return (
    tileCoord.x >= area.tileX &&
    tileCoord.x < area.tileX + area.width &&
    tileCoord.y >= area.tileY &&
    tileCoord.y < area.tileY + area.height
  );
}

export function areaToCornerCoords(area: Area): WorldCoord[] {
  return [
    { x: area.tileX, y: area.tileY },
    { x: area.tileX + area.width - 1, y: area.tileY },
    { x: area.tileX, y: area.tileY + area.height - 1 },
    { x: area.tileX + area.width + -1, y: area.tileY + area.height - 1 },
  ];
}

export function extendArea(area: Area, extension: number) {
  return {
    tileX: area.tileX - extension,
    tileY: area.tileY - extension,
    width: area.width + extension * 2,
    height: area.height + extension * 2,
  };
}

export function areAreasOverlapping(area1: Area, area2: Area) {
  const area1Points = areaToCornerCoords(area1);
  const area2Points = areaToCornerCoords(area2);

  const overlappingPoint =
    area1Points.find((point) => isTileInArea(point, area2)) || area2Points.find((point) => isTileInArea(point, area1));

  return !!overlappingPoint;
}

export function areaFromRect(rect: Rectangle) {
  return {
    tileX: rect.topLeft.x,
    tileY: rect.topLeft.y,
    width: rect.sideLength,
    height: rect.sideLength,
  };
}

export function areaFromRegion(regionCoord: WorldCoord) {
  const topLeft = regionCoordToTileCoord(regionCoord);
  return {
    tileX: topLeft.x,
    tileY: topLeft.y,
    width: REGION_LENGTH,
    height: REGION_LENGTH,
  };
}

export function getRegionsInAreaArray(area: Area): WorldCoord[] {
  return getRegionsInAreaMap(area).coords();
}

export function getRegionsInAreaMap(area: Area): CoordMap<boolean> {
  const topLeft = { x: area.tileX, y: area.tileY };
  const bottomRight = { x: area.tileX + area.width, y: area.tileY + area.height };

  const topLeftRegion = tileCoordToRegionCoord(topLeft);
  const bottomRightRegion = tileCoordToRegionCoord(bottomRight);

  const numRegionsX = bottomRightRegion.x - topLeftRegion.x + 1;
  const numRegionsY = bottomRightRegion.y - topLeftRegion.y + 1;

  const regionsInArea = new CoordMap<boolean>();

  for (let x = 0; x < numRegionsX; x++) {
    for (let y = 0; y < numRegionsY; y++) {
      regionsInArea.set(
        {
          x: topLeftRegion.x + x,
          y: topLeftRegion.y + y,
        },
        true
      );
    }
  }

  return regionsInArea;
}
