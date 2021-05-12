import {
  TILE_WIDTH,
  TILE_HEIGHT,
  TerrainTilesetId,
  colors,
  ColorKey,
  STRATEGIC_MAP_TILEMAP_CHUNK_SIZE,
} from "../../constants";
import GameManager from "../../../Backend/Game/GameManager";
import { WorldCoord, EthAddress, Area } from "../../../_types/GlobalTypes";
import { CheckedTypeUtils } from "../../../Backend/Utils/CheckedTypeUtils";
import { getColorFromEthAddress } from "../../utils/colors";
import StrategicCursor from "./strategicCursor";
import { GameMap } from "./map";
import CenteredChunkedTilemap from "../../primitives/CenteredChunkedTilemap";
import { ViewportManager } from "../../manager/ViewportManager";
import { forEachTile } from "../../primitives/utils";
import { hexColors } from "../../../theme";
import MainScene from "../../scenes/mainScene";
import { ManagedObjects, PhaserManagerServices } from "../../game";

export const MOVEMENT_SPEED_MODIFIER = 5;
export const ZOOM_FACTOR = 1 / 2;
const Y_PADDING = 100;
const X_PADDING = 100;

export class StrategicMap implements ManagedObjects {
  gm: GameManager = GameManager.getInstance();
  scene: MainScene;
  gameMap: GameMap; // Reference to the 'regular' game map.

  map: CenteredChunkedTilemap;
  camera: Phaser.Cameras.Scene2D.Camera;
  graphics: Phaser.GameObjects.Graphics;

  cursor: StrategicCursor;

  private viewport: Area;
  private player: EthAddress;

  constructor(
    private viewportManager: ViewportManager
  ) {
    this.viewport = { tileX: 0, tileY: 0, height: 0, width: 0 };
  }

  bootObject(scene: MainScene, services: PhaserManagerServices) {
    this.scene = scene;
    this.gameMap = scene.gameMap;

    const onChunkDestroyed = (area: Area) => services.strategicMapChunkManager.setAreaStale(area);
    const onCreateLayers = (layers: Phaser.Tilemaps.TilemapLayer[]) => this.gameMap.camera.ignore(layers);

    this.map = new CenteredChunkedTilemap(
      this.scene,
      {
        tileWidth: Math.floor(TILE_WIDTH * ZOOM_FACTOR),
        tileHeight: Math.floor(TILE_HEIGHT * ZOOM_FACTOR),
        width: this.gm.constants.TILES_X,
        height: this.gm.constants.TILES_Y,
        chunkWidth: STRATEGIC_MAP_TILEMAP_CHUNK_SIZE,
        chunkHeight: STRATEGIC_MAP_TILEMAP_CHUNK_SIZE,
        offloadDelay: 10000,
      },
      this.scene.tilemapAnimator,
      this.viewportManager,
      onChunkDestroyed,
      onCreateLayers
    );

    const tilesets = [this.gameMap.tilesets.tilemap];
    this.map.init(({ map, x, y, width, height }) => {
      const layers = {
        default: map.createBlankLayer("default", tilesets, x, y, width, height),
      };
      return { layers: Object.values(layers), defaultLayer: layers.default };
    });

    this.player = this.gm.address;

    this.camera = this.scene.cameras.add();
    this.camera.setBounds(
      0,
      0,
      this.gm.constants.TILES_X * TILE_WIDTH * ZOOM_FACTOR + X_PADDING * 2,
      this.gm.constants.TILES_Y * TILE_HEIGHT * ZOOM_FACTOR + Y_PADDING * 2
    );

    this.cursor = new StrategicCursor(this.scene, this.map, this.camera);

    this.graphics = this.scene.add.graphics({});
    this.graphics.lineStyle(2, 0xffffff, 1);
    this.graphics.strokeRect(0, 0, this.map.width * this.map.tileWidth, this.map.height * this.map.tileHeight);
    this.graphics.visible = true;
    this.graphics.setDepth(2);
  }

  destroyObject() {
    this.map.destroy();
    this.camera.destroy();
    this.graphics.destroy();
    this.cursor.destroy();
  }

  getViewport(): Area {
    const worldView = this.camera.worldView;
    const topLeft = this.map.worldToTileXY(worldView.x, worldView.y);
    this.viewport.tileX = topLeft.x;
    this.viewport.tileY = topLeft.y;
    this.viewport.height = Math.ceil(worldView.height / this.map.tileHeight);
    this.viewport.width = Math.ceil(worldView.width / this.map.tileWidth);
    return this.viewport;
  }

  centerMap(worldCoord: WorldCoord) {
    const coord = this.map.tileToWorldXY(worldCoord.x, worldCoord.y);
    this.camera.centerOn(coord.x, coord.y);
  }

  render(area: Area) {
    forEachTile({
      map: this.map,
      layer: "default",
      tileX: area.tileX,
      tileY: area.tileY,
      height: area.height,
      width: area.width,
      callback: (groundTile, coord) => {
        const tile = this.gm.extendedDungeon.tiles.get(coord);
        if (!tile || !tile.isMined) {
          const resources = this.gm.extendedDungeon.isResource(coord);
          if (resources?.gold || resources?.soul || resources?.soulGround) {
            groundTile.index = TerrainTilesetId.Full;
            groundTile.alpha = 0.5;
            if (resources.soulGround) groundTile.tint = hexColors.soulGround;
            else if (resources.soul) groundTile.tint = hexColors.soul;
            else if (resources.gold) groundTile.tint = hexColors.gold;
          }
          return;
        }

        groundTile.index = TerrainTilesetId.Full;
        groundTile.alpha = tile.isWalled ? 0.4 : 1;

        if (tile.owner === CheckedTypeUtils.EMPTY_ADDRESS) {
          groundTile.tint = 0x686868;
          const resources = this.gm.extendedDungeon.isResource(coord);
        } else {
          if (tile.owner === this.player) {
            groundTile.tint = colors[ColorKey.Player] as number;
          } else {
            groundTile.tint = getColorFromEthAddress(tile.owner).color;
          }
        }
      },
    });
  }

  renderAreas(areas: Area[]) {
    for (const area of areas) {
      this.render(area);
    }
  }

  updateCursor(shouldRender: boolean) {
    const tileToCenterOn = this.cursor.update(shouldRender);
    if (shouldRender) {
      if (tileToCenterOn) {
        const coord = this.gameMap.map.tileToWorldXY(tileToCenterOn.x, tileToCenterOn.y);
        this.gameMap.camera.centerOn(coord.x, coord.y);
      }
    }
  }
}
