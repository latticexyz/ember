import GameManager from "../../Backend/Game/GameManager";
import { CheckedTypeUtils } from "../../Backend/Utils/CheckedTypeUtils";
import {
  SPECIAL_REGION_PROOF_DEFAULT_AVERAGE_DELAY,
  TX_CONFIRM_DEFAULT_AVERAGE_DELAY,
  TX_SUBMIT_DEFAULT_AVERAGE_DELAY,
} from "../../Backend/Utils/Defaults";
import { DungeonEvent, GameManagerEvent, WorldCoord, GameScene, ExplorerEvent, Area } from "../../_types/GlobalTypes";
import { TerrainTilesetId, TILE_HEIGHT, TILE_WIDTH, GAME_MAP_TILEMAP_CHUNK_SIZE } from "../constants";
import Cursor from "../objects/initialize/cursor";
import UI from "../objects/initialize/ui";
import { getColorFromEthAddress } from "../utils/colors";
import { UIManager } from "../../Frontend/UIManager";
import { ChunkManager } from "../manager/ChunkManager";
import { xmur3, sfc32 } from "../../Utils/Utils";
import { coordToId } from "../../Backend/Utils/PackedCoords";
import { ViewportManager } from "../manager/ViewportManager";
import CenteredChunkedTilemap from "../primitives/CenteredChunkedTilemap";
import ChunkedTilemap from "../primitives/ChunkedTilemap";
import { forEachTile } from "../primitives/utils";
import { TilemapAnimator } from "../primitives/TilemapAnimator";

export const SCROLL_WITH_MOUSE = false;

export const SCROLL_SPEED = 4;
export const SCROLL_SPEED_DIAGONAL = Math.floor(Math.sqrt(SCROLL_SPEED ** 2 / 2));

export const SCROLL_REGION = 10;
export const SCROLL_REGION_CORNER = 20;

export const ZOOM_FACTOR_REGIONS = 4;
export const ZOOM_FACTOR_TILES_IN_REGIONS = 1 / 2;

const CHUNK_SIZE = 16;
const REGION_CHUNK_SIZE = 1;

export default class InitializeScene extends Phaser.Scene {
  status: "SELECTING" | "PROVING" | "SUBMITTING" | "CONFIRMING" | "WAITING";
  gm: GameManager;
  map: ChunkedTilemap;
  tilesets: {
    tilemap: Phaser.Tilemaps.Tileset;
  };
  smallMap: ChunkedTilemap;
  keys: any;
  cursor: Cursor;
  selectedRegion: WorldCoord | undefined;
  selectedRegionGraphic: Phaser.GameObjects.Graphics;
  leftButtonClicked: boolean;
  ui: UI;
  currentUITween: Phaser.Tweens.Tween;
  chunkManager: ChunkManager;
  smallChunkManager: ChunkManager;
  viewport: Area;
  smallViewport: Area;
  viewportManager: ViewportManager;
  smallViewportManager: ViewportManager;

  constructor() {
    super({ key: "InitializeScene" });
  }

  destroy() {
    // TODO: handle this properly
    this.gm.removeAllListeners(GameManagerEvent.InitializeStarted);
    this.gm.removeAllListeners(GameManagerEvent.InitializeProofDone);
    this.gm.removeAllListeners(GameManagerEvent.InitializeTXConfirmed);
    this.gm.removeAllListeners(GameManagerEvent.InitializeTXSubmitted);
    this.gm.extendedDungeon.removeAllListeners(DungeonEvent.PlayerInitialized);
    this.gm.extendedDungeon.explorer.removeAllListeners(ExplorerEvent.PerlinExplored);
  }

  create() {
    this.viewport = { tileX: 0, tileY: 0, width: 0, height: 0 };
    this.smallViewport = { tileX: 0, tileY: 0, width: 0, height: 0 };

    this.viewportManager = new ViewportManager();
    this.smallViewportManager = new ViewportManager();

    this.events.on("destroy", () => this.destroy());
    this.gm = GameManager.getInstance();
    this.gm.extendedDungeon.on(DungeonEvent.TileMined, (tile, tileCoord) => {
      this.chunkManager.setTileStale(tileCoord);
      this.smallChunkManager.setTileStale(tileCoord);
    });
    this.gm.extendedDungeon.on(DungeonEvent.TileClaimed, (tile, tileCoord) => {
      this.chunkManager.setTileStale(tileCoord);
      this.smallChunkManager.setTileStale(tileCoord);
    });

    const tilesetMap = new Phaser.Tilemaps.Tilemap(this, new Phaser.Tilemaps.MapData());
    this.tilesets = {
      tilemap: tilesetMap.addTilesetImage("tilemap", undefined, TILE_WIDTH, TILE_HEIGHT, 0, 0, 0),
    };
    const tilemapAnimator = new TilemapAnimator(0, []);

    this.map = new CenteredChunkedTilemap(
      this,
      {
        width: this.gm.constants.REGIONS_X,
        height: this.gm.constants.REGIONS_Y,
        tileWidth: TILE_WIDTH * ZOOM_FACTOR_REGIONS,
        tileHeight: TILE_HEIGHT * ZOOM_FACTOR_REGIONS,
        chunkWidth: GAME_MAP_TILEMAP_CHUNK_SIZE,
        chunkHeight: GAME_MAP_TILEMAP_CHUNK_SIZE,
        offloadDelay: 10000,
      },
      tilemapAnimator,
      this.viewportManager
    );

    this.map.init(({ map, x, y, width, height }) => {
      const layers = {
        terrain: map.createBlankLayer("terrain", [this.tilesets.tilemap], x, y, width, height),
        default: map.createBlankLayer("default", [this.tilesets.tilemap], x, y, width, height),
      };
      return { layers: Object.values(layers), defaultLayer: layers.default };
    });

    this.smallMap = new CenteredChunkedTilemap(
      this,
      {
        width: this.gm.constants.TILES_X,
        height: this.gm.constants.TILES_Y,
        tileWidth: Math.floor(TILE_WIDTH * ZOOM_FACTOR_TILES_IN_REGIONS),
        tileHeight: Math.floor(TILE_HEIGHT * ZOOM_FACTOR_TILES_IN_REGIONS),
        chunkWidth: GAME_MAP_TILEMAP_CHUNK_SIZE,
        chunkHeight: GAME_MAP_TILEMAP_CHUNK_SIZE,
        offloadDelay: 10000,
      },
      tilemapAnimator,
      this.smallViewportManager
    );

    this.smallMap.init(({ map, x, y, width, height }) => {
      const layers = {
        default: map.createBlankLayer("default", [this.tilesets.tilemap], x, y, width, height),
      };

      return { layers: Object.values(layers), defaultLayer: layers.default };
    });

    this.viewportManager.setViewport(this.getBigViewport());
    this.smallViewportManager.setViewport(this.getSmallViewport());

    this.cameras.main.setBounds(
      0,
      0,
      this.gm.constants.REGIONS_X * TILE_WIDTH * ZOOM_FACTOR_REGIONS,
      this.gm.constants.REGIONS_Y * TILE_HEIGHT * ZOOM_FACTOR_REGIONS
    );

    const { LEFT, RIGHT, UP, DOWN, W, A, S, D, ENTER } = Phaser.Input.Keyboard.KeyCodes;
    this.keys = this.input.keyboard.addKeys({
      left: LEFT,
      right: RIGHT,
      up: UP,
      down: DOWN,
      w: W,
      a: A,
      d: D,
      s: S,
      enter: ENTER,
    });
    this.leftButtonClicked = false;
    this.cursor = new Cursor(this, this.map);
    this.selectedRegion = undefined;
    this.selectedRegionGraphic = this.add.graphics();
    this.selectedRegionGraphic.setDepth(10);
    this.selectedRegionGraphic.lineStyle(2, 0xf8d380, 1);
    this.selectedRegionGraphic.strokeRect(0, 0, this.map.tileWidth, this.map.tileHeight);
    this.selectedRegionGraphic.visible = false;
    this.ui = new UI(this);
    this.status = "SELECTING";
    this.gm.on(GameManagerEvent.InitializeStarted, (player, regionCoords) => {
      this.status = "PROVING";
      this.ui.setStatus(this.status);
      this.ui.progress = 0;
      this.currentUITween = this.tweens.add({
        targets: this.ui,
        progress: 100,
        duration: SPECIAL_REGION_PROOF_DEFAULT_AVERAGE_DELAY,
      });
    });
    this.gm.on(GameManagerEvent.InitializeProofDone, (player, regionCoords) => {
      this.status = "SUBMITTING";
      this.ui.needToFinishCurrentLoadingStage = true;
      this.ui.progress = 0;
      this.ui.setStatus(this.status);
      this.ui.progress = 0;
      this.currentUITween.complete();
      this.currentUITween = this.tweens.add({
        targets: this.ui,
        progress: 100,
        duration: TX_SUBMIT_DEFAULT_AVERAGE_DELAY,
      });
    });
    this.gm.on(GameManagerEvent.InitializeTXSubmitted, (player, regionCoords) => {
      this.status = "CONFIRMING";
      this.ui.needToFinishCurrentLoadingStage = true;
      this.ui.setStatus(this.status);
      this.ui.progress = 0;
      this.currentUITween.complete();
      this.currentUITween = this.tweens.add({
        targets: this.ui,
        progress: 100,
        duration: TX_CONFIRM_DEFAULT_AVERAGE_DELAY,
      });
    });
    this.gm.on(GameManagerEvent.InitializeTXConfirmed, (player, regionCoords) => {
      this.status = "WAITING";
      this.ui.needToFinishCurrentLoadingStage = true;
      this.ui.setStatus(this.status);
      this.ui.progress = 0;
      this.currentUITween.complete();
      this.tweens.add({
        targets: this.ui,
        progress: 100,
        duration: 3000,
      });
    });
    this.gm.on(GameManagerEvent.InitializeError, (_) => {
      this.status = "SELECTING";
      this.ui.setStatus(this.status);
      this.ui.progress = 0;
      this.currentUITween.complete();
    });
    this.gm.extendedDungeon.on(DungeonEvent.PlayerInitialized, (player, regionCoords) => {
      if (player.player === this.gm.address) {
        const ui = UIManager.getInstance();
        // we delay moving to the other scene to make sure the state is fully synced
        setTimeout(() => {
          this.scene.start("MainScene");
          ui.state.setGameScene(GameScene.Main);
        }, 2000);
      }
    });
    this.gm.extendedDungeon.explorer.on(ExplorerEvent.PerlinExplored, (region) => {
      this.chunkManager.setRegionStale(region);
      this.smallChunkManager.setRegionStale(region);
    });
    const coord = this.map.tileToWorldXY(0, 0);
    console.log("Center on", coord);
    this.cameras.main.centerOn(coord.x, coord.y);

    this.chunkManager = new ChunkManager({
      chunkWidth: REGION_CHUNK_SIZE,
      chunkHeight: REGION_CHUNK_SIZE,
      name: "region",
      viewportManager: this.viewportManager,
    });

    this.smallChunkManager = new ChunkManager({
      chunkWidth: CHUNK_SIZE,
      chunkHeight: CHUNK_SIZE,
      viewportManager: this.smallViewportManager,
    });
  }

  updateViewport() {
    this.viewportManager.setViewport(this.getBigViewport());
    this.smallViewportManager.setViewport(this.getSmallViewport());
  }

  getSmallViewport(): Area {
    const worldView = this.cameras.main.worldView;
    const topLeft = this.smallMap.worldToTileXY(worldView.x, worldView.y);
    this.smallViewport.tileX = topLeft.x;
    this.smallViewport.tileY = topLeft.y;
    this.smallViewport.height = Math.ceil(worldView.height / this.smallMap.tileHeight);
    this.smallViewport.width = Math.ceil(worldView.width / this.smallMap.tileWidth);
    return this.smallViewport;
  }

  getBigViewport(): Area {
    const worldView = this.cameras.main.worldView;
    const topLeft = this.map.worldToTileXY(worldView.x, worldView.y);
    this.viewport.tileX = topLeft.x;
    this.viewport.tileY = topLeft.y;
    this.viewport.height = Math.ceil(worldView.height / this.map.tileHeight);
    this.viewport.width = Math.ceil(worldView.width / this.map.tileWidth);
    return this.viewport;
  }

  canInitializeAtRegion(coord: WorldCoord): boolean {
    const regionTileIndexUnderCursors = this.map.getTileAt(coord.x, coord.y, true, "default")?.index;
    return !!regionTileIndexUnderCursors && (regionTileIndexUnderCursors === TerrainTilesetId.Empty ? true : false);
  }

  recenterStrategicMap() {
    if (this.map.width < this.scale.width) {
      const padding = (this.scale.width - this.map.width) / 2;
      // this.map.setOffset(padding, 0);
      // this.smallMap.setOffset(padding, 0);
    }
  }

  renderMap(area: Area) {
    const { tileX, tileY, width, height } = area;

    // we don't really render regions that are un-initializable yet.

    forEachTile({
      map: this.map,
      layer: "default",
      tileX,
      tileY,
      width,
      height,
      callback: (tile, regionCoord) => {
        const region = this.gm.extendedDungeon.regions.get(regionCoord);
        if (!region) return;

        // Put an empty region tile if there are tiles in this region
        // This is later used to determine whether the player can init here
        if (region.tiles.length > 0) {
          tile.index = 85;
        }
      },
    });

    forEachTile({
      map: this.map,
      layer: "terrain",
      tileX,
      tileY,
      width,
      height,
      callback: (tile, regionCoord) => {
        const regionId = coordToId(regionCoord).toHexString();
        var seed = xmur3(regionId || "0");
        // Output four 32-bit hashes to provide the seed for sfc32.
        var rand = sfc32(seed(), seed(), seed(), seed());
        const index = Math.floor(rand() * 4);
        // Set terrain layer
        tile.index = [TerrainTilesetId.RockB, TerrainTilesetId.RockC, TerrainTilesetId.RockA, TerrainTilesetId.RockA][
          index
        ];
      },
    });
  }

  renderSmallMap(area: Area) {
    const { tileX, tileY, width, height } = area;

    forEachTile({
      map: this.smallMap,
      layer: "default",
      tileX,
      tileY,
      width,
      height,
      callback: (groundTile, coord) => {
        groundTile.index = -1;

        const tile = this.gm.extendedDungeon.tiles.get(coord);
        if (!tile) return;

        groundTile.index = TerrainTilesetId.Full;

        if (tile.owner === CheckedTypeUtils.EMPTY_ADDRESS) {
          groundTile.tint = 0x454248;
          groundTile.alpha = 1.0;
        } else {
          groundTile.tint = getColorFromEthAddress(tile.owner).color;
          groundTile.alpha = 1.0;
        }
      },
    });
  }

  renderAreas(areas: Area[]) {
    for (const area of areas) {
      this.renderMap(area);
    }
  }

  renderSmallAreas(areas: Area[]) {
    for (const area of areas) {
      this.renderSmallMap(area);
    }
  }

  update() {
    const shouldRenderCursor = this.moveCamera();
    const pointer = this.input.activePointer;
    const worldPoint = pointer.positionToCamera(this.cameras.main) as Phaser.Math.Vector2;
    const pointerTileXY = this.map.worldToTileXY(worldPoint.x, worldPoint.y);
    const canInitializeUnderCursor = this.canInitializeAtRegion(pointerTileXY);
    this.cursor.update(shouldRenderCursor, canInitializeUnderCursor);
    this.recenterStrategicMap();
    // register inputs
    if (pointer.leftButtonDown() && !pointer.leftButtonReleased()) {
      this.leftButtonClicked = true;
    }
    // Add a colliding tile at the mouse position
    if (this.leftButtonClicked && pointer.leftButtonReleased() && !pointer.leftButtonDown()) {
      this.leftButtonClicked = false;
      if (shouldRenderCursor && canInitializeUnderCursor && this.status === "SELECTING") {
        this.selectedRegion = pointerTileXY;
        this.selectedRegionGraphic.visible = true;
        const snappedWorldPoint = this.map.tileToWorldXY(pointerTileXY.x, pointerTileXY.y);
        this.selectedRegionGraphic.setPosition(snappedWorldPoint.x, snappedWorldPoint.y);
        this.ui.setSelectedRegion(this.selectedRegion);
      }
    }
    if (this.keys.enter.isDown && this.selectedRegion && this.status === "SELECTING") {
      this.gm.initializePlayer(this.selectedRegion);
      this.status = "PROVING";
    }
    this.ui.update();
    this.updateViewport();

    const staleChunks = this.chunkManager.getStaleChunksInViewport();
    const staleAreas = staleChunks.map((chunk) => {
      const tileArea = this.chunkManager.chunkCoordToArea(chunk);
      return tileArea;
      // const regionLeftCorner = tileCoordToRegionCoord({ x: tileArea.tileY, y: tileArea.tileY });
      // return regionLeftCorner;
      // return {
      //   tileX: regionLeftCorner.x,
      //   tileY: regionLeftCorner.y,
      //   width: tileArea.width / REGION_LENGTH,
      //   height: tileArea.height / REGION_LENGTH,
      // };
    });
    this.renderAreas(staleAreas);
    this.chunkManager.setChunksUnstale(staleChunks);

    const staleSmallChunks = this.smallChunkManager.getStaleChunksInViewport();
    const staleSmallAreas = staleSmallChunks.map((chunk) => this.smallChunkManager.chunkCoordToArea(chunk));
    this.renderSmallAreas(staleSmallAreas);
    this.smallChunkManager.setChunksUnstale(staleSmallChunks);
  }

  moveCamera(): boolean {
    const pointer = this.input.activePointer;
    // update camera
    const pointerPositionX = pointer.x;
    const pointerPositionY = pointer.y;
    let currentScrollX = this.cameras.main.scrollX;
    let currentScrollY = this.cameras.main.scrollY;
    // keyboard movement
    if (this.keys.left.isDown || this.keys.a.isDown) {
      currentScrollX -= SCROLL_SPEED;
    }
    if (this.keys.right.isDown || this.keys.d.isDown) {
      currentScrollX += SCROLL_SPEED;
    }
    if (this.keys.up.isDown || this.keys.w.isDown) {
      currentScrollY -= SCROLL_SPEED;
    }
    if (this.keys.down.isDown || this.keys.s.isDown) {
      currentScrollY += SCROLL_SPEED;
    }
    if (SCROLL_WITH_MOUSE) {
      // corner scrolling first
      if (pointerPositionX < SCROLL_REGION && pointerPositionY < SCROLL_REGION_CORNER) {
        // scroll top left
        currentScrollX -= SCROLL_SPEED_DIAGONAL;
        currentScrollY -= SCROLL_SPEED_DIAGONAL;
      } else if (pointerPositionX > this.scale.width - SCROLL_REGION && pointerPositionY < SCROLL_REGION_CORNER) {
        // scroll top right
        currentScrollX += SCROLL_SPEED_DIAGONAL;
        currentScrollY -= SCROLL_SPEED_DIAGONAL;
      } else if (pointerPositionX < SCROLL_REGION && pointerPositionY > this.scale.height - SCROLL_REGION_CORNER) {
        // scroll bottom left
        currentScrollX -= SCROLL_SPEED_DIAGONAL;
        currentScrollY += SCROLL_SPEED_DIAGONAL;
      } else if (
        pointerPositionX > this.scale.width - SCROLL_REGION &&
        pointerPositionY > this.scale.height - SCROLL_REGION_CORNER
      ) {
        // scroll bottom right
        currentScrollX += SCROLL_SPEED_DIAGONAL;
        currentScrollY += SCROLL_SPEED_DIAGONAL;
      } else if (pointerPositionX < 10) {
        // scroll left
        currentScrollX -= SCROLL_SPEED;
      }
      if (pointerPositionX > this.scale.width - 10) {
        // scroll right
        currentScrollX += SCROLL_SPEED;
      }
      if (pointerPositionY < 10) {
        // scroll up
        currentScrollY -= SCROLL_SPEED;
      }
      if (pointerPositionY > this.scale.height - 10) {
        // scroll down
        currentScrollY += SCROLL_SPEED;
      }
    }
    if (currentScrollX !== this.cameras.main.scrollX || currentScrollY !== this.cameras.main.scrollY) {
      this.cameras.main.setScroll(currentScrollX, currentScrollY);
      return false;
    }
    return true;
  }
}
