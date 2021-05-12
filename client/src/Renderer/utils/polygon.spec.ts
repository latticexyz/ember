import { getCornerCoordsFromTile, getPolygonCornersFromTiles } from "./polygon";

describe("getCornerCoordsFromTile", () => {
  it("should return the correct corner coordinates", () => {
    const width = 32;
    const height = 32;
    const tile = { x: 0, y: 0 };
    expect(getCornerCoordsFromTile(tile, width, height)).toStrictEqual([
      { x: 0, y: 0 },
      { x: 32, y: 0 },
      { x: 32, y: 32 },
      { x: 0, y: 32 },
    ]);
  });
});

describe("getPolygonCornersFromTiles", () => {
  const width = 100;
  const height = 100;

  it("should return the corner coords of the tile if only one tile is given", () => {
    const tiles = [{ x: 0, y: 0 }];

    const polygonCorners = getPolygonCornersFromTiles(tiles, width, height);
    const tileCorners = getCornerCoordsFromTile(tiles[0], width, height);

    expect(polygonCorners).toEqual(tileCorners);
  });

  it("should return the correct polygon corner coords of a rectangle with two tiles", () => {
    const tiles = [
      { x: 0, y: 0 },
      { x: 0, y: 1 },
    ];

    const polygonCorners = getPolygonCornersFromTiles(tiles, width, height);
    expect(polygonCorners).toEqual([
      { x: 0, y: 0 },
      { x: 0, y: 200 },
      { x: 100, y: 200 },
      { x: 100, y: 0 },
    ]);
  });

  it("should work with three tiles that are not in a line", () => {
    const tiles = [
      { x: 0, y: 0 },
      { x: 0, y: 1 },
      { x: 1, y: 0 },
    ];

    const polygonCorners = getPolygonCornersFromTiles(tiles, width, height);
    expect(polygonCorners).toEqual([
      { x: 0, y: 0 },
      { x: 0, y: 200 },
      { x: 100, y: 200 },
      { x: 100, y: 100 },
      { x: 200, y: 100 },
      { x: 200, y: 0 },
    ]);
  });
});
