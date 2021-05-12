import { WorldCoord } from "../../../_types/GlobalTypes";
import { PixelCoords, getPolygonCornersFromTiles, tileCoordsFromRegionCoords } from "../../utils/polygon";
import { worldCoordsToPhaserTileCoords } from "../../utils/worldCoords";

export enum PolygonStyle {
  FILLED,
  BORDER,
  FILLEDBORDER,
}

interface PolygonOptions {
  style?: PolygonStyle;
  color?: number;
  alpha?: number;
  borderAlpha?: number;
  thickness?: number;
  depth?: number;
  borderColor?: number;
}

export class Polygon extends Phaser.GameObjects.Graphics {
  shape: Phaser.Geom.Polygon;
  map: Phaser.Tilemaps.Tilemap;
  options: PolygonOptions;

  constructor(scene: Phaser.Scene) {
    super(scene);
    this.shape = new Phaser.Geom.Polygon();
  }

  init(map: Phaser.Tilemaps.Tilemap, options: PolygonOptions = {}) {
    this.map = map;
    this.options = options;
    this.depth = options?.depth ?? 0;
    this.setActive(true);
    this.setVisible(true);
  }

  setTiles(tiles: WorldCoord[]) {
    if (tiles.length === 0) {
      this.clear();
      return;
    }
    const width = this.map.tileWidth;
    const height = this.map.tileHeight;
    const tilesInPhaserCoords = tiles.map((tile) =>
      worldCoordsToPhaserTileCoords(tile, this.map.width, this.map.height)
    );
    const cornerPoints = getPolygonCornersFromTiles(tilesInPhaserCoords, width, height);
    this.setCornerPoints(cornerPoints);
  }

  setRegions(regions: WorldCoord[]) {
    if (regions.length == 0) {
      this.clear();
      return;
    }

    // TODO: create util method that computes polygon coords directly from region coords
    const tiles: WorldCoord[] = tileCoordsFromRegionCoords(regions);
    this.setTiles(tiles);
  }

  setCornerPoints(cornerPoints: PixelCoords[]) {
    this.clear();
    this.shape.points = cornerPoints as Phaser.Geom.Point[];
    if (this.options.style === PolygonStyle.BORDER) {
      this.lineStyle(this.options.thickness ?? 2, this.options.color ?? 0x000000, this.options.alpha ?? 0.4);
      this.strokePoints(this.shape.points, true, true);
    } else if (this.options.style === PolygonStyle.FILLEDBORDER) {
      this.lineStyle(this.options.thickness ?? 2, this.options.borderColor ?? 0x000000, this.options.borderAlpha ?? 1);
      this.strokePoints(this.shape.points, true, true);
      this.fillStyle(this.options.color ?? 0x000000, this.options.alpha ?? 0.4);
      this.fillPoints(this.shape.points, true);
    } else {
      this.fillStyle(this.options.color ?? 0x000000, this.options.alpha ?? 0.4);
      this.fillPoints(this.shape.points, true);
    }
  }

  setDiagonalPoints(start: WorldCoord, end: WorldCoord) {
    const s = worldCoordsToPhaserTileCoords(start, this.map.width, this.map.height);
    const e = worldCoordsToPhaserTileCoords(end, this.map.width, this.map.height);

    const minX = Math.min(s.x, e.x);
    const maxX = Math.max(s.x, e.x);
    const minY = Math.min(s.y, e.y);
    const maxY = Math.max(s.y, e.y);

    const topLeft = { x: minX, y: minY };
    const topRight = { x: maxX, y: minY };
    const bottomLeft = { x: minX, y: maxY };
    const bottomRight = { x: maxX, y: maxY };

    const width = this.map.tileWidth;
    const height = this.map.tileHeight;

    this.setCornerPoints([
      getPolygonCornersFromTiles([topLeft], width, height)[0],
      getPolygonCornersFromTiles([topRight], width, height)[1],
      getPolygonCornersFromTiles([bottomRight], width, height)[2],
      getPolygonCornersFromTiles([bottomLeft], width, height)[3],
    ]);
  }
}
