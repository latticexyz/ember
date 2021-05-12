import { WorldCoord, Area } from "../../_types/GlobalTypes";
import { CoordMap } from "../../Utils/CoordMap";
import { mod } from "../../Utils/Utils";
import { NotImplementedTilemap } from "./NotImplementedTilemap";
import { ViewportManager } from "../manager/ViewportManager";
import { REGION_LENGTH } from "../../Backend/Utils/Defaults";
import { cornerTileCoordsFromRegionCoords } from "../utils/polygon";
import { TerrainTilesetId } from "../constants";
import { TilemapAnimator } from "./TilemapAnimator";

export default class ChunkedTilemap extends NotImplementedTilemap {
  private initialized = false;
  private maps: CoordMap<Phaser.Tilemaps.Tilemap>;
  private lastTouched: CoordMap<number>;
  private tilemapAnimator: TilemapAnimator;
  private skipCoords: CoordMap<boolean>;
  protected data: {
    tileWidth: number;
    tileHeight: number;
    width: number;
    height: number;
    chunkWidth: number;
    chunkHeight: number;
    offloadDelay: number;
  };
  private createLayers: (props: {
    map: Phaser.Tilemaps.Tilemap;
    x: number;
    y: number;
    width: number;
    height: number;
  }) => {
    layers: Phaser.Tilemaps.TilemapLayer[];
    defaultLayer: Phaser.Tilemaps.TilemapLayer;
  };
  public onCreateLayers?: (layer: Phaser.Tilemaps.TilemapLayer[]) => void;
  protected onChunkDestroyed?: (area: Area) => void;
  protected viewportManager: ViewportManager;

  public tileWidth: number;
  public tileHeight: number;
  public width: number;
  public height: number;
  public offsetX: number;
  public offsetY: number;

  constructor(
    scene: Phaser.Scene,
    data: {
      tileWidth: number;
      tileHeight: number;
      width: number;
      height: number;
      chunkWidth: number;
      chunkHeight: number;
      offloadDelay: number;
    },
    tilemapAnimator: TilemapAnimator,
    viewportManager: ViewportManager,
    onChunkDestroyed?: (area: Area) => void,
    onCreateLayers?: (layer: Phaser.Tilemaps.TilemapLayer[]) => void
  ) {
    super();
    this.scene = scene;
    this.data = data;
    this.tilemapAnimator = tilemapAnimator;
    this.maps = new CoordMap<Phaser.Tilemaps.Tilemap>();
    this.lastTouched = new CoordMap<number>();
    this.tileWidth = data.tileWidth;
    this.tileHeight = data.tileHeight;
    this.width = data.width;
    this.height = data.height;
    this.viewportManager = viewportManager;
    this.onChunkDestroyed = onChunkDestroyed;
    this.onCreateLayers = onCreateLayers;
    this.offsetX = 0;
    this.offsetY = 0;
    this.skipCoords = new CoordMap<boolean>();

    if (data.chunkHeight < REGION_LENGTH || data.chunkHeight < REGION_LENGTH) {
      throw new Error("Chunk size must be at least size of a region");
    }

    this.viewportManager.setOnViewportChange((viewport, currentRegions, addedRegions, removedRegions) => {
      for (const region of addedRegions) {
        this.touchRegion(region);
      }
    });

    setInterval(() => this.offloadIdleMaps(), this.data.offloadDelay);
  }

  public init(
    createLayers: (props: { map: Phaser.Tilemaps.Tilemap; x: number; y: number; width: number; height: number }) => {
      layers: Phaser.Tilemaps.TilemapLayer[];
      defaultLayer: Phaser.Tilemaps.TilemapLayer;
    }
  ) {
    this.createLayers = createLayers;
    this.initialized = true;
  }

  public setOffset(x: number, y: number) {
    const maps = this.maps.values();
    for (const map of maps) {
      for (const layer of map.layers) {
        layer.x -= this.offsetX;
        layer.x += x;
        layer.y -= this.offsetY;
        layer.y += y;
      }
    }
    this.offsetX = x;
    this.offsetY = y;
  }

  public addSkipCoord(coord: WorldCoord) {
    this.skipCoords.set(coord, true);
  }

  public removeSkipCoord(coord: WorldCoord) {
    this.skipCoords.delete(coord);
  }

  protected tileCoordToChunkCoord(tileCoord: WorldCoord): WorldCoord {
    return {
      x: Math.floor(tileCoord.x / this.data.chunkWidth),
      y: Math.floor(tileCoord.y / this.data.chunkHeight),
    };
  }

  protected chunkCoordToTileCoord(chunkCoord: WorldCoord): WorldCoord {
    return {
      x: chunkCoord.x * this.data.chunkWidth,
      y: chunkCoord.y * this.data.chunkHeight,
    };
  }

  private pixelCoordToTileCoord(coord: WorldCoord): WorldCoord {
    return {
      x: Math.floor(coord.x / this.tileWidth),
      y: Math.floor(coord.y / this.tileHeight),
    };
  }

  private tileCoordToPixelCoord(coord: WorldCoord): WorldCoord {
    return {
      x: Math.floor(coord.x * this.tileWidth),
      y: Math.floor(coord.y * this.tileHeight),
    };
  }

  private createMap(chunkCoord: WorldCoord): Phaser.Tilemaps.Tilemap {
    const data: Phaser.Tilemaps.MapData = new Phaser.Tilemaps.MapData({
      ...this.data,
      width: this.data.chunkWidth,
      height: this.data.chunkHeight,
    });
    if (!this.initialized) {
      throw new Error("ChunkedTilemap: missing call to .init");
    }
    const map = new Phaser.Tilemaps.Tilemap(this.scene, data);
    const topLeft = this.tileCoordToPixelCoord(this.chunkCoordToTileCoord(chunkCoord));
    const { defaultLayer, layers } = this.createLayers({
      map,
      x: topLeft.x + this.offsetX,
      y: topLeft.y + this.offsetY,
      width: this.data.chunkWidth,
      height: this.data.chunkHeight,
    });
    this.onCreateLayers && this.onCreateLayers(layers);
    for (const l of layers) {
      map.fill(TerrainTilesetId.Empty, undefined, undefined, undefined, undefined, false, l);
    }
    map.setLayer(defaultLayer);
    this.maps.set(chunkCoord, map);
    const id = CoordMap.constructKey(chunkCoord);
    this.tilemapAnimator.addMap(id, map);
    return map;
  }

  private getMapAtTileCoord(tileCoord: WorldCoord): Phaser.Tilemaps.Tilemap {
    const chunkCoord = this.tileCoordToChunkCoord(tileCoord);
    return this.getMapAtChunkCoord(chunkCoord);
  }

  private getMapAtChunkCoord(chunkCoord: WorldCoord): Phaser.Tilemaps.Tilemap {
    this.touchChunk(chunkCoord);
    return this.maps.get(chunkCoord) || this.createMap(chunkCoord);
  }

  protected isChunkInViewport(chunkCoord: WorldCoord) {
    const topLeft = this.chunkCoordToTileCoord(chunkCoord);
    const chunkArea: Area = {
      tileX: topLeft.x,
      tileY: topLeft.y,
      width: this.data.chunkWidth,
      height: this.data.chunkHeight,
    };
    return this.viewportManager.isAreaInViewport(chunkArea, 20);
  }

  // This assumes that chunks are larger than regions
  public touchRegion(regionCoord: WorldCoord) {
    const corners = cornerTileCoordsFromRegionCoords([regionCoord]);
    for (const corner of corners) {
      const chunk = this.tileCoordToChunkCoord(corner);
      this.touchChunk(chunk);
    }
  }

  protected touchChunk(chunkCoord: WorldCoord) {
    this.lastTouched.set(chunkCoord, Date.now());
  }

  private offloadIdleMaps() {
    if (this.size === 0) return;

    for (const chunkCoord of this.maps.coords()) {
      const lastTouched = this.lastTouched.get(chunkCoord)!;
      // Don't offload recently touched chunks
      const timeSinceLastTouched = Date.now() - lastTouched;
      if (timeSinceLastTouched <= this.data.offloadDelay) continue;

      // Don't offload chunks in the viewport
      if (this.isChunkInViewport(chunkCoord)) continue;

      this.destroyMap(chunkCoord);
    }
  }

  private destroyMap(chunkCoord: WorldCoord) {
    const map = this.getMapAtChunkCoord(chunkCoord);
    map.destroy();
    this.maps.delete(chunkCoord);
    this.lastTouched.delete(chunkCoord);
    this.handleChunkDestroyed(chunkCoord);
    this.tilemapAnimator.removeMap(CoordMap.constructKey(chunkCoord));
  }

  protected handleChunkDestroyed(chunkCoord: WorldCoord) {
    if (!this.onChunkDestroyed) return;

    const topLeft = this.chunkCoordToTileCoord(chunkCoord);
    const area: Area = {
      tileX: topLeft.x,
      tileY: topLeft.y,
      width: this.data.chunkWidth,
      height: this.data.chunkHeight,
    };

    return this.onChunkDestroyed(area);
  }

  public get size() {
    return this.maps.coords().length;
  }

  public addTileToAnimationRequests(tileX: number, tileY: number, layer: string | number) {
    if (tileX == null || tileY == null) {
      throw new Error(`Invalid call of addTileToAnimationRequests ${tileX}, ${tileY}, ${layer}`);
    }
    const tileCoord = { x: tileX, y: tileY };
    const chunkCoord = this.tileCoordToChunkCoord(tileCoord);
    const id = CoordMap.constructKey(chunkCoord);
    const tileCoordInMap = {
      x: mod(tileX, this.data.chunkWidth),
      y: mod(tileY, this.data.chunkHeight),
    };
    this.tilemapAnimator.addAnimationRequest(id, tileCoordInMap, layer);
  }

  clearAnimationRequestsInArea(tileX: number, tileY: number, width: number, height: number) {
    const topLeftChunk = this.tileCoordToChunkCoord({ x: tileX, y: tileY });
    const bottomRightChunk = this.tileCoordToChunkCoord({ x: tileX + width - 1, y: tileY + height - 1 });

    const chunkWidth = bottomRightChunk.x - topLeftChunk.x + 1;
    const chunkHeight = bottomRightChunk.y - topLeftChunk.y + 1;

    for (let offsetX = 0; offsetX < chunkWidth; offsetX++) {
      for (let offsetY = 0; offsetY < chunkHeight; offsetY++) {
        const chunkCoord = { x: topLeftChunk.x + offsetX, y: topLeftChunk.y + offsetY };
        const id = CoordMap.constructKey(chunkCoord);
        const offsetLeft = mod(tileX, this.data.chunkWidth);
        const offsetTop = mod(tileY, this.data.chunkHeight);
        const offsetRight = mod(width + offsetLeft, this.data.chunkWidth) || this.data.chunkWidth;
        const offsetBottom = mod(height + offsetTop, this.data.chunkHeight) || this.data.chunkHeight;

        const innerChunkX = chunkCoord.x === topLeftChunk.x ? offsetLeft : 0;
        const innerChunkY = chunkCoord.y === topLeftChunk.y ? offsetTop : 0;
        const innerChunkWidth = chunkCoord.x === bottomRightChunk.x ? offsetRight : 0;
        const innerChunkHeight = chunkCoord.y === bottomRightChunk.y ? offsetBottom : 0;
        this.tilemapAnimator.clearAnimationRequests(id, innerChunkX, innerChunkY, innerChunkWidth, innerChunkHeight);
      }
    }
  }

  putTileAt(
    tile: number | Phaser.Tilemaps.Tile,
    tileX: number,
    tileY: number,
    recalculateFaces?: boolean | undefined,
    layer?: string | number | Phaser.Tilemaps.TilemapLayer | undefined
  ): Phaser.Tilemaps.Tile {
    if (tileX == null || tileY == null) {
      throw new Error(`Invalid call of putTileAt ${tile}, ${tileX}, ${tileY}, ${recalculateFaces}, ${layer}`);
    }
    const tileCoord = { x: tileX, y: tileY };
    const map = this.getMapAtTileCoord(tileCoord);
    const putTile = map.putTileAt(
      tile,
      mod(tileX, this.data.chunkWidth),
      mod(tileY, this.data.chunkHeight),
      recalculateFaces,
      layer
    );
    if (putTile == null) {
      console.error(tile, tileX, tileY, recalculateFaces, layer, tileCoord, map, layer);
      throw new Error("Put tile at failed");
    }
    return putTile;
  }

  getTileAt(
    tileX: number,
    tileY: number,
    nonNull?: boolean | undefined,
    layer?: string | number | Phaser.Tilemaps.TilemapLayer | undefined
  ): Phaser.Tilemaps.Tile {
    const tileCoord = { x: tileX, y: tileY };
    const map = this.getMapAtTileCoord(tileCoord);
    return map.getTileAt(mod(tileX, this.data.chunkWidth), mod(tileY, this.data.chunkHeight), nonNull, layer);
  }

  worldToTileXY(
    worldX: number,
    worldY: number,
    snapToFloor?: boolean | undefined,
    vec2?: Phaser.Math.Vector2 | undefined,
    camera?: Phaser.Cameras.Scene2D.Camera | undefined,
    layer?: string | number | Phaser.Tilemaps.TilemapLayer | undefined
  ): Phaser.Math.Vector2 {
    return new Phaser.Math.Vector2(this.pixelCoordToTileCoord({ x: worldX - this.offsetX, y: worldY - this.offsetY }));
  }

  tileToWorldXY(
    tileX: number,
    tileY: number,
    vec2?: Phaser.Math.Vector2 | undefined,
    camera?: Phaser.Cameras.Scene2D.Camera | undefined,
    layer?: string | number | Phaser.Tilemaps.TilemapLayer | undefined
  ): Phaser.Math.Vector2 {
    const worldXY = new Phaser.Math.Vector2(this.tileCoordToPixelCoord({ x: tileX, y: tileY }));
    worldXY.x += this.offsetX;
    worldXY.y += this.offsetY;
    return worldXY;
  }

  forEachTile(
    callback: ((tile: Phaser.Tilemaps.Tile, coord: WorldCoord) => void) | ((...args: any[]) => void),
    context?: object | undefined,
    tileX?: number | undefined,
    tileY?: number | undefined,
    width?: number | undefined,
    height?: number | undefined,
    filteringOptions?: Phaser.Types.Tilemaps.FilteringOptions | undefined,
    layer?: string | number | Phaser.Tilemaps.TilemapLayer | undefined
  ): Phaser.Tilemaps.Tilemap {
    if (tileX == null || tileY == null || width == null || height == null) {
      throw new Error("Never iterate over entire map");
    }
    const topLeftChunk = this.tileCoordToChunkCoord({ x: tileX, y: tileY });
    const bottomRightChunk = this.tileCoordToChunkCoord({ x: tileX + width - 1, y: tileY + height - 1 });

    const chunkWidth = bottomRightChunk.x - topLeftChunk.x + 1;
    const chunkHeight = bottomRightChunk.y - topLeftChunk.y + 1;

    for (let offsetX = 0; offsetX < chunkWidth; offsetX++) {
      for (let offsetY = 0; offsetY < chunkHeight; offsetY++) {
        const chunkCoord = { x: topLeftChunk.x + offsetX, y: topLeftChunk.y + offsetY };
        const topLeftTile = this.chunkCoordToTileCoord(chunkCoord);
        const map = this.getMapAtChunkCoord(chunkCoord);

        const offsetLeft = mod(tileX, this.data.chunkWidth);
        const offsetTop = mod(tileY, this.data.chunkHeight);
        const offsetRight = mod(width + offsetLeft, this.data.chunkWidth) || this.data.chunkWidth;
        const offsetBottom = mod(height + offsetTop, this.data.chunkHeight) || this.data.chunkHeight;

        const innerChunkX = chunkCoord.x === topLeftChunk.x ? offsetLeft : 0;
        const innerChunkY = chunkCoord.y === topLeftChunk.y ? offsetTop : 0;
        const innerChunkWidth = chunkCoord.x === bottomRightChunk.x ? offsetRight : undefined;
        const innerChunkHeight = chunkCoord.y === bottomRightChunk.y ? offsetBottom : undefined;

        const patchedCallback: EachTileCallback = (
          tile: Phaser.Tilemaps.Tile,
          index: number,
          array: Phaser.Tilemaps.Tile[]
        ): void => {
          const tileCoord = { x: topLeftTile.x + tile.x, y: topLeftTile.y + tile.y };
          if (this.skipCoords.get(tileCoord)) return;
          callback(tile, tileCoord);
        };

        map.forEachTile(
          patchedCallback,
          context,
          innerChunkX,
          innerChunkY,
          innerChunkWidth,
          innerChunkHeight,
          filteringOptions,
          layer
        );
      }
    }

    return this;
  }

  destroy() {
    for (const map of this.maps.values()) {
      map.destroy();
    }
  }
}
