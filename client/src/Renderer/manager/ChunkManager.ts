import { CoordMap } from "../../Utils/CoordMap";
import { Area, WorldCoord, Rectangle } from "../../_types/GlobalTypes";
import { areAreasOverlapping, areaEq, getRegionsInAreaMap } from "../utils/area";
import { regionCoordToTileCoord } from "../../Backend/Utils/Utils";
import { REGION_LENGTH } from "../../Backend/Utils/Defaults";
import { ViewportManager } from "./ViewportManager";
import { Service } from "../game";

export class ChunkManager implements Service {
  private viewportManager: ViewportManager;
  private staleChunks: CoordMap<boolean>;
  private chunkWidth: number;
  private chunkHeight: number;
  private name?: string;

  // Computed when viewport or stale chunks change
  // To prevent recomputing at 60 FPS
  private staleChunksInViewport: WorldCoord[];

  constructor(props: { chunkWidth: number; chunkHeight: number; name?: string; viewportManager: ViewportManager }) {
    this.staleChunks = new CoordMap<boolean>({ defaultValue: true });
    this.chunkWidth = props.chunkWidth;
    this.chunkHeight = props.chunkHeight;
    this.staleChunksInViewport = [];
    this.name = props.name;
    this.viewportManager = props.viewportManager;
    this.viewportManager.setOnViewportChange(() => this.recomputeStaleChunksInViewport());
  }

  bootService(_: Phaser.Scene) { }

  destroyService() {
    this.staleChunks.map.clear();
    this.staleChunksInViewport = [];
  }

  private tileCoordToChunkCoord(tileCoord: WorldCoord): WorldCoord {
    return {
      x: Math.floor(tileCoord.x / this.chunkWidth),
      y: Math.floor(tileCoord.y / this.chunkHeight),
    };
  }

  private chunkCoordToTileCoord(chunkCoord: WorldCoord): WorldCoord {
    return {
      x: chunkCoord.x * this.chunkWidth,
      y: chunkCoord.y * this.chunkHeight,
    };
  }

  public chunkCoordToArea(chunkCoord: WorldCoord): Area {
    const chunkTileCoord = this.chunkCoordToTileCoord(chunkCoord);
    return {
      tileX: chunkTileCoord.x,
      tileY: chunkTileCoord.y,
      width: this.chunkWidth,
      height: this.chunkHeight,
    };
  }

  private isChunkInArea(chunkCoord: WorldCoord, area: Area): boolean {
    const chunkArea = this.chunkCoordToArea(chunkCoord);
    return areAreasOverlapping(chunkArea, area);
  }

  private getChunksInArea(area: Area): WorldCoord[] {
    if (!area) return [];

    const topLeftChunk = this.tileCoordToChunkCoord({ x: area.tileX, y: area.tileY });
    const chunks: WorldCoord[] = [];

    const maxChunksX = Math.ceil(area.width / this.chunkWidth) + 1;
    const maxChunksY = Math.ceil(area.height / this.chunkHeight) + 1;

    for (let x = 0; x < maxChunksX; x++) {
      for (let y = 0; y < maxChunksY; y++) {
        const chunk = { x: topLeftChunk.x + x, y: topLeftChunk.y + y };
        if (this.isChunkInArea(chunk, area)) {
          chunks.push(chunk);
        }
      }
    }

    return chunks;
  }

  private recomputeStaleChunksInViewport() {
    const chunksInViewport = this.getChunksInViewport();
    const staleChunksInViewport = chunksInViewport.filter((chunk) => this.staleChunks.get(chunk));
    this.staleChunksInViewport = staleChunksInViewport;
  }

  private getChunksInViewport(): WorldCoord[] {
    return this.getChunksInArea(this.viewportManager.getViewport());
  }

  public getStaleChunksInViewport(): WorldCoord[] {
    return this.staleChunksInViewport;
  }

  public setChunksUnstale(chunks: WorldCoord[]) {
    for (const chunk of chunks) {
      this.staleChunks.set(chunk, false);
    }
    if (chunks.length > 0) this.recomputeStaleChunksInViewport();
  }

  // Call this every time an event is happening anywhere
  // Only stale chunks in the viewport are rerendered
  public setTileStale(tileCoord: WorldCoord) {
    const chunk = this.tileCoordToChunkCoord(tileCoord);
    this.staleChunks.set(chunk, true);
    this.recomputeStaleChunksInViewport();
  }

  public setRegionStale(regionCoord: WorldCoord) {
    const topLeftCorner = regionCoordToTileCoord(regionCoord);

    const area = {
      tileX: topLeftCorner.x,
      tileY: topLeftCorner.y,
      width: REGION_LENGTH,
      height: REGION_LENGTH,
    };

    this.setAreaStale(area);
  }

  public setRectangleStale(rect: Rectangle) {
    const area: Area = {
      tileX: rect.topLeft.x,
      tileY: rect.topLeft.y,
      width: rect.sideLength,
      height: rect.sideLength,
    };

    this.setAreaStale(area);
  }

  public setAreaStale(area: Area) {
    const chunksInArea = this.getChunksInArea(area);

    for (const chunk of chunksInArea) {
      this.staleChunks.set(chunk, true);
    }

    this.recomputeStaleChunksInViewport();
  }
}
