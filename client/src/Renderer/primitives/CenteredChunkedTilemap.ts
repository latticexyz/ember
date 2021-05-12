import { WorldCoord, Area } from "../../_types/GlobalTypes";
import ChunkedTilemap from "./ChunkedTilemap";
import { cornerTileCoordsFromRegionCoords } from "../utils/polygon";

export default class CenteredChunkedTilemap extends ChunkedTilemap {
  private centeredToNatural(coord: number): number {
    return coord + this.width / 2;
  }

  private naturalToCentered(coord: number): number {
    return coord - this.width / 2;
  }

  private naturalToCenteredCoord(coord: WorldCoord): WorldCoord {
    return { x: this.naturalToCentered(coord.x), y: this.naturalToCentered(coord.y) };
  }

  private centeredToNaturalCoord(coord: WorldCoord): WorldCoord {
    return { x: this.centeredToNatural(coord.x), y: this.centeredToNatural(coord.y) };
  }

  protected isChunkInViewport(chunkCoord: WorldCoord): boolean {
    const topLeft = super.chunkCoordToTileCoord(chunkCoord);
    const chunkArea: Area = {
      tileX: this.naturalToCentered(topLeft.x),
      tileY: this.naturalToCentered(topLeft.y),
      width: this.data.chunkWidth,
      height: this.data.chunkHeight,
    };
    return this.viewportManager.isAreaInViewport(chunkArea, 20);
  }

  public touchRegion(regionCoord: WorldCoord) {
    const corners = cornerTileCoordsFromRegionCoords([regionCoord]);
    for (const corner of corners) {
      const naturalCoord = this.centeredToNaturalCoord(corner);
      const chunk = super.tileCoordToChunkCoord(naturalCoord);
      this.touchChunk(chunk);
    }
  }

  protected handleChunkDestroyed(chunkCoord: WorldCoord) {
    if (!this.onChunkDestroyed) return;

    const topLeft = this.naturalToCenteredCoord(super.chunkCoordToTileCoord(chunkCoord));
    const area: Area = {
      tileX: topLeft.x,
      tileY: topLeft.y,
      width: this.data.chunkWidth,
      height: this.data.chunkHeight,
    };

    return this.onChunkDestroyed(area);
  }
  addTileToAnimationRequests(tileX: number, tileY: number, layer: string | number) {
    return super.addTileToAnimationRequests(this.centeredToNatural(tileX), this.centeredToNatural(tileY), layer);
  }

  clearAnimationRequestsInArea(tileX: number, tileY: number, width: number, height: number) {
    return super.clearAnimationRequestsInArea(
      this.centeredToNatural(tileX),
      this.centeredToNatural(tileY),
      width,
      height
    );
  }

  putTileAt(
    tile: number | Phaser.Tilemaps.Tile,
    tileX: number,
    tileY: number,
    recalculateFaces?: boolean | undefined,
    layer?: string | number | Phaser.Tilemaps.TilemapLayer | undefined
  ): Phaser.Tilemaps.Tile {
    return super.putTileAt(tile, this.centeredToNatural(tileX), this.centeredToNatural(tileY), recalculateFaces, layer);
  }

  getTileAt(
    tileX: number,
    tileY: number,
    nonNull?: boolean | undefined,
    layer?: string | number | Phaser.Tilemaps.TilemapLayer | undefined
  ): Phaser.Tilemaps.Tile {
    return super.getTileAt(this.centeredToNatural(tileX), this.centeredToNatural(tileY), nonNull, layer);
  }

  worldToTileXY(
    worldX: number,
    worldY: number,
    snapToFloor?: boolean | undefined,
    vec2?: Phaser.Math.Vector2 | undefined,
    camera?: Phaser.Cameras.Scene2D.Camera | undefined,
    layer?: string | number | Phaser.Tilemaps.TilemapLayer | undefined
  ): Phaser.Math.Vector2 {
    const tileXY = super.worldToTileXY(worldX, worldY, snapToFloor, vec2, camera, layer);
    tileXY.x = this.naturalToCentered(tileXY.x);
    tileXY.y = this.naturalToCentered(tileXY.y);
    return tileXY;
  }

  tileToWorldXY(
    tileX: number,
    tileY: number,
    vec2?: Phaser.Math.Vector2 | undefined,
    camera?: Phaser.Cameras.Scene2D.Camera | undefined,
    layer?: string | number | Phaser.Tilemaps.TilemapLayer | undefined
  ): Phaser.Math.Vector2 {
    return super.tileToWorldXY(this.centeredToNatural(tileX), this.centeredToNatural(tileY), vec2, camera, layer);
  }

  addSkipCoord(coord: WorldCoord) {
    super.addSkipCoord(this.centeredToNaturalCoord(coord));
  }

  removeSkipCoord(coord: WorldCoord) {
    super.removeSkipCoord(this.centeredToNaturalCoord(coord));
  }

  forEachTile(
    callback: (tile: Phaser.Tilemaps.Tile, coord: WorldCoord) => void,
    context?: object | undefined,
    tileX?: number | undefined,
    tileY?: number | undefined,
    width?: number | undefined,
    height?: number | undefined,
    filteringOptions?: Phaser.Types.Tilemaps.FilteringOptions | undefined,
    layer?: string | number | Phaser.Tilemaps.TilemapLayer | undefined
  ): Phaser.Tilemaps.Tilemap {
    const translatedCallback: Parameters<ChunkedTilemap["forEachTile"]>[0] = (
      tile: Phaser.Tilemaps.Tile,
      coord: WorldCoord
    ) => {
      const translatedCoord = {
        x: this.naturalToCentered(coord.x),
        y: this.naturalToCentered(coord.y),
      };
      callback(tile, translatedCoord);
    };

    return super.forEachTile(
      translatedCallback,
      context,
      this.centeredToNatural(tileX!),
      this.centeredToNatural(tileY!),
      width,
      height,
      filteringOptions,
      layer
    );
  }
}
