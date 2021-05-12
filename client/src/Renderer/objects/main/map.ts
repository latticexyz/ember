import { REGION_LENGTH } from "../../../Backend/Utils/Defaults";
import {
  TILE_WIDTH,
  TILE_HEIGHT,
  ColorKey,
  colors,
  TerrainTilesetId,
  getDefaultColorFromTerrainTilesetId,
  ObjectTilesetId,
  GAME_MAP_TILEMAP_CHUNK_SIZE,
  ObjectTilesetAnimations,
} from "../../constants";
import { checkInRange, range, regionCoordToTileCoord, tileCoordToRegionCoord } from "../../../Backend/Utils/Utils";
import GameManager from "../../../Backend/Game/GameManager";
import { getColorFromEthAddress } from "../../utils/colors";
import { EthAddress, WorldCoord, Area } from "../../../_types/GlobalTypes";
import { CheckedTypeUtils } from "../../../Backend/Utils/CheckedTypeUtils";
import { TileUpgrade } from "../../../_types/ContractTypes";
import { isTileWall } from "../../utils/tiles";
import Cursor from "./cursor";
import { sfc32, xmur3, CIRCULAR_DIRECTIONS } from "../../../Utils/Utils";
import { extendArea, getRegionsInAreaArray, getRegionsInAreaMap } from "../../utils/area";
import { hexColors } from "../../../theme";
import { PolygonStyle } from "./polygon";
import { CoordMap } from "../../../Utils/CoordMap";
import { getSurroundingRegionsOfSameType } from "../../../Backend/Utils/Regions";
import { coordToId } from "../../../Backend/Utils/PackedCoords";
import ChunkedTilemap from "../../primitives/ChunkedTilemap";
import CenteredChunkedTilemap from "../../primitives/CenteredChunkedTilemap";
import { ViewportManager } from "../../manager/ViewportManager";
import { forEachTile } from "../../primitives/utils";
import { GroupRegistry } from "../../utils/groupRegistry";
import { WallConnector } from "./wallConnector";
import { WallDepthPass } from "./wallDepthPass";
import MainScene from "../../scenes/mainScene";
import RegionResources from "./regionResources";
import { SoundManager, SoundType, SoundLayer } from "../../manager/SoundManager";
import { MultiHueTintPipeline } from "../../pipelines/multiHueTintPipeline";
import { ethers } from "ethers";
import { getSurroundingTilesOfSameType } from "../../../Backend/Utils/Tiles";
import { worldCoordsEq } from "../../utils/worldCoords";
import { ManagedObjects, PhaserManagerServices } from "../../game";

//const Y_PADDING = 100;
//const X_PADDING = 100;

const TILE_PADDING = 20;

enum TileType {
  Empty = "Empty",
  Background = "Background",
  TintedBackground = "TintedBackground",
  OutsideMap = "OutsideMap",
  Bedrock = "Bedrock",
  GoldResource = "GoldResource",
  SoulResource = "SoulResource",
  SoulGroundResource = "SoulGroundResource",
  SoulGroundResourceModification = "SoulGroundResourceModification",
  Rock = "Rock",
  Ground = "Ground",
  Wall = "Wall",
  InnerWall = "InnerWall",
  OwnedGround = "OwnedGround",
}

export class GameMap implements ManagedObjects {
  gm: GameManager = GameManager.getInstance();
  scene: MainScene;

  map: ChunkedTilemap;
  regionBoundaryGroup: Phaser.GameObjects.Group;
  influenceGroup: Phaser.GameObjects.Group;
  regionResourcesGroup: Phaser.GameObjects.Group;
  tilesets: {
    tilemap: Phaser.Tilemaps.Tileset;
  };
  camera: Phaser.Cameras.Scene2D.Camera;

  cursor: Cursor;
  viewport: Area;
  initialized: boolean;
  regionsInViewport: CoordMap<boolean>;
  regionAndEmpireBoundariesVisible: boolean;

  wallConnector: WallConnector;
  wallDepthPass: WallDepthPass;

  player: EthAddress;

  constructor(
    private viewportManager: ViewportManager,
    private groupRegistry: GroupRegistry
  ) {
    this.initialized = false;
    this.viewport = { tileX: 0, tileY: 0, height: 0, width: 0 };
  }

  bootObject(scene: MainScene, services: PhaserManagerServices) {
    this.scene = scene;

    this.influenceGroup = this.groupRegistry.groups.influence;
    this.regionResourcesGroup = this.groupRegistry.groups.regionResource;
    this.regionBoundaryGroup = this.groupRegistry.groups.regionAndEmpireBoundary;

    const tilesetMap = new Phaser.Tilemaps.Tilemap(this.scene, new Phaser.Tilemaps.MapData());

    this.player = this.gm.address;

    this.tilesets = {
      tilemap: tilesetMap.addTilesetImage("tilemap", "tilemap", TILE_WIDTH, TILE_HEIGHT),
    };

    const onChunkDestroyed = (area) => services.chunkManager.setAreaStale(area);
    const onCreateLayers = (layers) => scene.strategicMap.camera.ignore(layers);

    this.map = new CenteredChunkedTilemap(
      this.scene,
      {
        tileWidth: TILE_WIDTH,
        tileHeight: TILE_HEIGHT,
        width: this.gm.constants.TILES_X + TILE_PADDING,
        height: this.gm.constants.TILES_Y + TILE_PADDING,
        chunkWidth: GAME_MAP_TILEMAP_CHUNK_SIZE,
        chunkHeight: GAME_MAP_TILEMAP_CHUNK_SIZE,
        offloadDelay: 10000,
      },
      this.scene.tilemapAnimator,
      this.viewportManager,
      onChunkDestroyed,
      onCreateLayers
    );

    // TODO: Decide if we actually want this
    // this.gm.extendedDungeon.getPlayerDungeonHeart(this.gm.address).then((dh) => {
    //   const xx = this.map.tileToWorldXY(dh.x, dh.y);
    //   this.scene.lights.addPointLight(xx.x, xx.y, 0xffa500, 70, 0.5, 0.03);
    //   // this.scene.lights.addLight(xx.x, xx.y, 128, 0xffa500, 0.5);
    // });
    // this.scene.lights.enable().setAmbientColor(0xffffff);

    this.map.init(({ map, x, y, width, height }) => {
      const layers = {
        background: map.createBlankLayer(`background`, [this.tilesets.tilemap], x, y, width, height),
        terrain: map.createBlankLayer(`terrain`, [this.tilesets.tilemap], x, y, width, height),
        terrainModification: map.createBlankLayer(`terrainModification`, [this.tilesets.tilemap], x, y, width, height),
        resource: map.createBlankLayer(`resource`, [this.tilesets.tilemap], x, y, width, height),
        object: map.createBlankLayer(`objects`, [this.tilesets.tilemap], x, y, width, height),
      };
      layers.object.pipeline = (this.scene.game.renderer as Phaser.Renderer.WebGL.WebGLRenderer).pipelines.get(
        MultiHueTintPipeline.KEY
      );
      layers.terrain.pipeline = (this.scene.game.renderer as Phaser.Renderer.WebGL.WebGLRenderer).pipelines.get(
        MultiHueTintPipeline.KEY
      );
      return { layers: Object.values(layers), defaultLayer: layers.terrain };
    });

    this.wallConnector = new WallConnector(this.map);
    this.wallDepthPass = new WallDepthPass(this.map);

    this.player = this.gm.address;

    this.camera = this.scene.cameras.main;
    this.camera.setBounds(
      0,
      0,
      (this.gm.constants.TILES_X + TILE_PADDING) * TILE_WIDTH,
      (this.gm.constants.TILES_Y + TILE_PADDING) * TILE_HEIGHT
    );
    this.camera.setViewport(0, 0, this.scene.scale.width, this.scene.scale.height);

    this.cursor = new Cursor(this.scene, this.map, this.player);

    this.setRegionsInViewport();
    this.regionAndEmpireBoundariesVisible = false;
  }

  destroyObject() {
    this.map.destroy();
    this.regionBoundaryGroup.destroy();
    this.influenceGroup.destroy();
    this.regionResourcesGroup.destroy();
    this.cursor.destroy();
    this.camera.destroy();
  }

  centerMap(worldCoord: WorldCoord) {
    const coord = this.map.tileToWorldXY(worldCoord.x, worldCoord.y);
    this.camera.centerOn(coord.x, coord.y);
  }

  setRegionsInViewport() {
    this.regionsInViewport = new CoordMap<boolean>();
    const viewport = this.getViewport();
    this.regionsInViewport = getRegionsInAreaMap(viewport);
  }

  getRegionsInViewport(): CoordMap<boolean> {
    return this.regionsInViewport;
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

  private drawTile(tile: Phaser.Tilemaps.Tile, type: TileType, worldCoord?: WorldCoord) {
    if (!tile) {
      console.error(tile, type, worldCoord);
      throw new Error("Tile should not be null");
    }

    const dungeonTile = worldCoord && this.gm.extendedDungeon.tiles.get(worldCoord);

    if (type === TileType.Empty) {
      tile.index = TerrainTilesetId.Empty;
      return;
    }

    if (type === TileType.Background) {
      tile.index = TerrainTilesetId.Full;
      tile.tint = colors[ColorKey.Background] as number;
      return;
    }

    if (type === TileType.OutsideMap) {
      tile.index = TerrainTilesetId.Full;
      tile.tint = 0x121212;
      return;
    }

    if (type === TileType.Bedrock) {
      tile.index = TerrainTilesetId.BedRock;
    }

    if (type === TileType.GoldResource) {
      tile.index = TerrainTilesetId.Gold;
      return;
    }

    if (type === TileType.SoulGroundResource) {
      // tile.tint = hexColors.soulGround;
      tile.index = TerrainTilesetId.SoulPit;
      return;
    }

    if (type === TileType.SoulGroundResourceModification) {
      tile.index = TerrainTilesetId.SoulGroundResource;
      return;
    }

    if (type === TileType.SoulResource) {
      tile.index = TerrainTilesetId.Soul;
      return;
    }

    if (type === TileType.Rock) {
      const seed = xmur3(worldCoord ? coordToId(worldCoord).toHexString() : "0");
      // Output four 32-bit hashes to provide the seed for sfc32.
      const rand = sfc32(seed(), seed(), seed(), seed());
      const index = Math.floor(rand() * 6);
      tile.index = [
        TerrainTilesetId.RockB,
        TerrainTilesetId.RockC,
        TerrainTilesetId.RockD,
        TerrainTilesetId.RockA,
        TerrainTilesetId.RockA,
        TerrainTilesetId.RockA,
      ][index];
      tile.tint = getDefaultColorFromTerrainTilesetId(TerrainTilesetId.RockA);
      return;
    }

    if (type === TileType.Ground) {
      tile.index = TerrainTilesetId.Ground;
      tile.tint = getDefaultColorFromTerrainTilesetId(TerrainTilesetId.Ground);
      return;
    }

    if (type === TileType.Wall) {
      tile.index = TerrainTilesetId.Wall;
      return;
    }

    if (type === TileType.InnerWall) {
      tile.index = TerrainTilesetId.InnerWall;
      return;
    }

    if (type === TileType.OwnedGround) {
      if (!worldCoord || !dungeonTile) return;
      const { settlement } = this.gm.extendedDungeon.getSettlement(tileCoordToRegionCoord(worldCoord));
      if (settlement.level === 0) {
        tile.index = TerrainTilesetId.OwnedGroundLvl1;
      } else if (settlement.level === 1) {
        tile.index = TerrainTilesetId.OwnedGroundLvl2;
      } else {
        tile.index = TerrainTilesetId.OwnedGroundLvl3;
      }
      if (dungeonTile.owner === this.gm.address) {
        tile.tint = colors[ColorKey.Player] as number;
      } else {
        tile.tint = getColorFromEthAddress(dungeonTile.owner).color;
      }
      return;
    }
  }

  private getTileIdFromStage(coord: WorldCoord, objectTilesetId: ObjectTilesetId): number {
    const tile = this.gm.extendedDungeon.getTileAt(coord);
    const region = tileCoordToRegionCoord(coord);
    const tilesOfSameType = getSurroundingTilesOfSameType(
      coord,
      (t, coord) => {
        const exploredRegion = tileCoordToRegionCoord(coord);
        const sameRegion = worldCoordsEq(region, exploredRegion);
        const sameOwner = t.owner === tile.owner;
        return tile.upgrade === t.upgrade && sameRegion && sameOwner;
      },
      this.gm.extendedDungeon
    );
    const harvestableInGroup = this.gm.extendedDungeon.getHarvestableAmount(tilesOfSameType, tile.upgrade);
    const { individual, boost } = harvestableInGroup.get(coord)!;
    const generated = individual + boost;
    let cap: number;
    if (tile.upgrade === TileUpgrade.SOUL_GENERATOR) {
      const groundResources = this.gm.extendedDungeon.hasGroundResources(coord);
      if (!groundResources) {
        cap = this.gm.constants.gameConstants.TILE_UPGRADE_MAX_HARVEST[tile.upgrade];
      } else {
        cap = groundResources.souls;
      }
    } else {
      cap = this.gm.constants.gameConstants.TILE_UPGRADE_MAX_HARVEST[tile.upgrade];
    }
    const animationArray = ObjectTilesetAnimations[objectTilesetId]!;
    const filledUp = generated / cap;
    if (filledUp > 0.99) {
      return animationArray[4][0];
    } else if (filledUp > 0.75) {
      return animationArray[3][0];
    } else if (filledUp > 0.5) {
      return animationArray[2][0];
    } else if (filledUp > 0.25) {
      return animationArray[1][0];
    } else {
      return animationArray[0][0];
    }
  }

  // Only called once on init
  private renderRegionBoundaries() {
    // first render of the map: add the boundaries (lines)
    if (this.regionBoundaryGroup.getLength() === 0) {
      for (const x of range(this.gm.constants.REGIONS_X - 1)) {
        const x1 = (x + 1) * (TILE_WIDTH * REGION_LENGTH) + (TILE_PADDING / 2) * TILE_WIDTH;
        const x2 = x1;
        const y1 = 0 + (TILE_PADDING / 2) * TILE_HEIGHT;
        const y2 = this.map.height * TILE_HEIGHT - (TILE_PADDING / 2) * TILE_HEIGHT;
        const g = this.scene.add.graphics();
        g.lineStyle(2, 0x000000, 0.3);
        g.strokeLineShape(new Phaser.Geom.Line(x1, y1, x2, y2));
        this.regionBoundaryGroup.add(g);
      }
      for (const y of range(this.gm.constants.REGIONS_Y - 1)) {
        const x1 = 0 + (TILE_PADDING / 2) * TILE_WIDTH;
        const x2 = this.map.width * TILE_WIDTH - (TILE_PADDING / 2) * TILE_WIDTH;
        const y1 = (y + 1) * (TILE_HEIGHT * REGION_LENGTH) + (TILE_PADDING / 2) * TILE_HEIGHT;
        const y2 = y1;
        const g = this.scene.add.graphics();
        g.lineStyle(2, 0x000000, 0.5);
        g.strokeLineShape(new Phaser.Geom.Line(x1, y1, x2, y2));
        this.regionBoundaryGroup.add(g);
      }
      this.regionBoundaryGroup.setVisible(false);
    }
  }

  // Called once on init, then set to invisible to prevent flickering
  public renderRegionInfluence(visible: boolean, regionCoords?: WorldCoord[]) {
    // this.influenceGroup.clear(true, true);

    const viewport = this.viewport;
    // copying regionCoords because we modify the array in this method
    const regions = regionCoords ? [...regionCoords] : getRegionsInAreaArray(viewport);

    for (const child of this.influenceGroup.getChildren()) {
      this.influenceGroup.killAndHide(child);
    }

    const regionController = new CoordMap<{ controller: EthAddress; disputed: boolean }>();
    const assignedRegions = new CoordMap<boolean>();

    const isRegionAssigned = (regionCoord: WorldCoord) => Boolean(assignedRegions.get(regionCoord));
    // hack: check if it's in a settlement
    const getRegionController = (coord: WorldCoord): { controller: EthAddress; disputed: boolean } => {
      const existingController = regionController.get(coord);
      if (existingController) return existingController;
      const { settlement, found } = this.gm.extendedDungeon.getSettlement(coord);
      const controllerData = {
        controller: found ? settlement.owner : CheckedTypeUtils.address(ethers.constants.AddressZero),
        disputed: false,
      };
      regionController.set(coord, controllerData);
      return controllerData;
    };

    const drawRegionBorder = (player: string, disputed: boolean, regions: WorldCoord[]) => {
      if (player === CheckedTypeUtils.EMPTY_ADDRESS) return;

      const color = disputed
        ? hexColors.gray
        : player === this.gm.address
          ? (colors[ColorKey.Player] as number)
          : getColorFromEthAddress(CheckedTypeUtils.address(player)).color;

      const depth = 2;

      const regionBorder = this.influenceGroup.get();

      regionBorder.init(this.map, {
        color,
        alpha: visible ? 0.3 : 0,
        depth,
        style: PolygonStyle.FILLED,
      });

      regionBorder.setRegions(regions);
    };

    while (regions.length > 0) {
      const currentRegion = regions.pop()!;
      if (isRegionAssigned(currentRegion)) continue;

      const { controller, disputed } = getRegionController(currentRegion);

      const surroundingRegions = getSurroundingRegionsOfSameType(
        currentRegion,
        (region, coord) => {
          const surrounding = getRegionController(coord);
          if (disputed) {
            return surrounding.disputed;
          }
          return (
            surrounding.controller === controller &&
            !surrounding.disputed &&
            surrounding.controller !== CheckedTypeUtils.EMPTY_ADDRESS
          );
        },
        this.gm.extendedDungeon
      );

      for (const regionCoord of surroundingRegions) {
        assignedRegions.set(regionCoord, true);
      }

      drawRegionBorder(controller, disputed, surroundingRegions);
    }
  }

  private isInCoordRange(coord: WorldCoord): boolean {
    return checkInRange(this.gm.constants.MAX_X, this.gm.constants.MAX_Y)(coord);
  }

  public renderRegionResources(hasTacticalView: boolean) {
    const viewport = this.viewport;
    const regions = getRegionsInAreaArray(viewport);

    for (const child of this.regionResourcesGroup.getChildren()) {
      this.regionResourcesGroup.killAndHide(child);
    }
    for (const regionCoord of regions) {
      const tileCoord = regionCoordToTileCoord(regionCoord);
      const pos = this.map.tileToWorldXY(tileCoord.x, tileCoord.y);
      const rs = this.regionResourcesGroup.get(pos.x, pos.y) as RegionResources;
      // We store the region data in the Phaser DataManager
      // So we can use it to only update resources at a single coord
      rs.init(regionCoord);
      rs.update();
      rs.updateState(hasTacticalView);
    }
  }

  public updateRegionResources(hasTacticalView: boolean) {
    for (const rs of this.regionResourcesGroup.children.getArray()) {
      (rs as RegionResources).update();
      (rs as RegionResources).updateState(hasTacticalView);
    }
  }

  renderBackground(area: Area) {
    forEachTile({
      map: this.map,
      layer: "background",
      tileX: area.tileX,
      tileY: area.tileY,
      width: area.width,
      height: area.height,
      callback: (tile, worldCoord) => {
        if (this.isInCoordRange(worldCoord)) {
          this.drawTile(tile, TileType.Background);
        } else {
          this.drawTile(tile, TileType.OutsideMap);
        }
      },
    });
  }

  renderResources(area: Area) {
    forEachTile({
      map: this.map,
      layer: "terrain",
      tileX: area.tileX,
      tileY: area.tileY,
      width: area.width,
      height: area.width,
      callback: (tile, tileCoord) => {
        if (!this.isInCoordRange(tileCoord)) {
          this.drawTile(tile, TileType.Bedrock);
          return;
        }

        const isResource = this.gm.extendedDungeon.isResource(tileCoord);
        // This method takes care of cases like no gold/soul in premined spawn areas
        const hasGroundResource = this.gm.extendedDungeon.hasGroundResources(tileCoord);

        const dungeonTile = this.gm.extendedDungeon.getTileAt(tileCoord);
        if (dungeonTile.isMined) {
          // render harvestable resources using the terrainModification layer
          const terrainModificationTile = this.map.getTileAt(
            tileCoord.x,
            tileCoord.y,
            undefined,
            "terrainModification"
          );
          if (dungeonTile && !dungeonTile.upgrade && hasGroundResource) {
            this.drawTile(terrainModificationTile, TileType.SoulGroundResourceModification);
          } else {
            this.drawTile(terrainModificationTile, TileType.Empty);
          }
        }

        // Render gold and souls
        if (hasGroundResource) {
          this.drawTile(tile, TileType.SoulGroundResource);
        } else if (isResource?.soul) {
          this.drawTile(tile, TileType.SoulResource);
        } else if (isResource?.gold) {
          this.drawTile(tile, TileType.GoldResource);
        } else {
          this.drawTile(tile, TileType.Rock, tileCoord);
        }
      },
    });
  }

  renderConstructions(area: Area) {
    // Now render all tiles that have been mined (claimed, upgraded, etc)
    this.map.clearAnimationRequestsInArea(area.tileX, area.tileY, area.width, area.height);
    forEachTile({
      map: this.map,
      layer: "terrain",
      tileX: area.tileX,
      tileY: area.tileY,
      height: area.height,
      width: area.width,
      callback: (groundTile, coord) => {
        const tile = this.gm.extendedDungeon.tiles.get(coord);
        if (!tile) return;

        if (tile.owner === CheckedTypeUtils.EMPTY_ADDRESS) {
          // Draw raw ground
          this.drawTile(groundTile, TileType.Ground);
        } else {
          this.drawTile(groundTile, TileType.OwnedGround, coord);
        }

        // render upgrades
        const objectTile = this.map.getTileAt(coord.x, coord.y, undefined, "objects");
        if (tile.upgrade === TileUpgrade.DUNGEON_HEART) {
          const rightTile = this.gm.extendedDungeon.tiles.get({ x: coord.x + 1, y: coord.y });
          const bottomTile = this.gm.extendedDungeon.tiles.get({ x: coord.x, y: coord.y + 1 });
          const isTopLeft =
            rightTile?.upgrade === TileUpgrade.DUNGEON_HEART && bottomTile?.upgrade === TileUpgrade.DUNGEON_HEART;
          if (isTopLeft) {
            const objectTileB = this.map.getTileAt(coord.x + 1, coord.y, undefined, "objects");
            const objectTileC = this.map.getTileAt(coord.x, coord.y + 1, undefined, "objects");
            const objectTileD = this.map.getTileAt(coord.x + 1, coord.y + 1, undefined, "objects");
            const { settlement, found } = this.gm.extendedDungeon.getSettlement(tileCoordToRegionCoord(coord));
            if (!found) {
              throw new Error("not supposed to happen");
            }
            if (settlement.level === 0) {
              objectTile.index = ObjectTilesetId.DHa1;
              objectTileB.index = ObjectTilesetId.DHb1;
              objectTileC.index = ObjectTilesetId.DHc1;
              objectTileD.index = ObjectTilesetId.DHd1;
            } else if (settlement.level === 1) {
              objectTile.index = ObjectTilesetId.DHa2;
              objectTileB.index = ObjectTilesetId.DHb2;
              objectTileC.index = ObjectTilesetId.DHc2;
              objectTileD.index = ObjectTilesetId.DHd2;
            } else if (settlement.level === 2) {
              objectTile.index = ObjectTilesetId.DHa3;
              objectTileB.index = ObjectTilesetId.DHb3;
              objectTileC.index = ObjectTilesetId.DHc3;
              objectTileD.index = ObjectTilesetId.DHd3;
            }
            this.map.addTileToAnimationRequests(coord.x, coord.y, "objects");
            this.map.addTileToAnimationRequests(coord.x + 1, coord.y, "objects");
            this.map.addTileToAnimationRequests(coord.x, coord.y + 1, "objects");
            this.map.addTileToAnimationRequests(coord.x + 1, coord.y + 1, "objects");
            SoundManager.register(SoundType.FIRE, coord, SoundLayer.MAP);
          }
        } else if (tile.upgrade === TileUpgrade.GOLD_STORAGE) {
          const seed = xmur3(coordToId(tileCoordToRegionCoord(coord)).toHexString());
          // Output four 32-bit hashes to provide the seed for sfc32.
          const rand = sfc32(seed(), seed(), seed(), seed());
          const index = Math.floor(rand() * 4);
          objectTile.index = [
            ObjectTilesetId.GoldStorageA,
            ObjectTilesetId.GoldStorageB,
            ObjectTilesetId.GoldStorageC,
            ObjectTilesetId.GoldStorageD,
          ][index];
        } else if (tile.upgrade === TileUpgrade.GOLD_GENERATOR) {
          objectTile.index = this.getTileIdFromStage(coord, ObjectTilesetId.GoldGenerator);
          if (tile.owner !== ethers.constants.AddressZero) {
            this.map.addTileToAnimationRequests(coord.x, coord.y, "objects");
          }
          SoundManager.register(SoundType.GOLD_UPGRADE, coord, SoundLayer.MAP);
        } else if (tile.upgrade === TileUpgrade.SOUL_STORAGE) {
          objectTile.index = ObjectTilesetId.SoulStorage;
          if (tile.owner !== ethers.constants.AddressZero) {
            this.map.addTileToAnimationRequests(coord.x, coord.y, "objects");
          }
          SoundManager.register(SoundType.SOUL_UPGRADE, coord, SoundLayer.MAP);
        } else if (tile.upgrade === TileUpgrade.SOUL_GENERATOR) {
          objectTile.index = this.getTileIdFromStage(coord, ObjectTilesetId.SoulGenerator);
          const harvestableGroundResources = this.gm.extendedDungeon.hasGroundResources(coord);
          if (
            tile.owner !== ethers.constants.AddressZero &&
            harvestableGroundResources &&
            harvestableGroundResources.souls !== 0
          ) {
            this.map.addTileToAnimationRequests(coord.x, coord.y, "objects");
          }
        } else if (tile.upgrade === TileUpgrade.LAIR) {
          objectTile.index = this.getTileIdFromStage(coord, ObjectTilesetId.Lair);
          if (tile.owner !== ethers.constants.AddressZero) {
            this.map.addTileToAnimationRequests(coord.x, coord.y, "objects");
          }
        } else if (tile.upgrade === TileUpgrade.TRAINING_ROOM) {
          const numberOfTrainingRoomAround = getSurroundingTilesOfSameType(
            coord,
            (t, w) => t.upgrade === TileUpgrade.TRAINING_ROOM,
            this.gm.extendedDungeon
          ).length;
          if (numberOfTrainingRoomAround < 4) {
            objectTile.index = ObjectTilesetId.TrainingRoom1;
          } else if (numberOfTrainingRoomAround < 8) {
            objectTile.index = ObjectTilesetId.TrainingRoom2;
          } else if (numberOfTrainingRoomAround < 16) {
            objectTile.index = ObjectTilesetId.TrainingRoom3;
          } else {
            objectTile.index = ObjectTilesetId.TrainingRoom4;
          }
          if (tile.owner !== ethers.constants.AddressZero) {
            this.map.addTileToAnimationRequests(coord.x, coord.y, "objects");
          }
        } else if (tile.upgrade === TileUpgrade.NONE && objectTile) {
          objectTile.index = TerrainTilesetId.Empty;
        }
        if (tile.upgrade !== TileUpgrade.NONE) {
          const hueTint =
            tile.owner === this.gm.address
              ? colors[ColorKey.Player]!
              : getColorFromEthAddress(CheckedTypeUtils.address(tile.owner)).color;
          objectTile.tint = hueTint;
        }
      },
    });
  }

  renderBorderWallsFirstPass(area: Area) {
    // Figure out where walls should go and also tint the underlying tile
    forEachTile({
      map: this.map,
      layer: "terrain",
      tileX: area.tileX,
      tileY: area.tileY,
      width: area.width,
      height: area.height,
      callback: (tile, worldCoord) => {
        // don't place a wall on any of these
        const { isWalled, isMined } = this.gm.extendedDungeon.getTileAt(worldCoord);
        if (isMined && !isWalled) {
          return;
        }
        for (const direction of CIRCULAR_DIRECTIONS) {
          // Counterclockwise, starting from directly under the current tile
          const { x, y } = direction;
          const adjWorldCoord = { x: worldCoord.x + x, y: worldCoord.y + y } as WorldCoord;
          const { isMined: isAdjacentTileMined, isWalled: isAdjacentTileWalled } =
            this.gm.extendedDungeon.getTileAt(adjWorldCoord);
          // if there is at least one mined and unwalled tile, we create a wall
          if (isAdjacentTileMined && !isAdjacentTileWalled) {
            this.drawTile(tile, TileType.Wall);
            return;
          }
        }
        if (isMined && isWalled) {
          // it is mined, it is walled, and there are not adjacent tile mined and unwalled
          // we render an inner wall
          this.drawTile(tile, TileType.InnerWall);
        }
      },
    });
  }

  renderResourcesSecondPass(area: Area) {
    // Render resources that overlap with walls
    forEachTile({
      map: this.map,
      layer: "terrain",
      tileX: area.tileX,
      tileY: area.tileY,
      width: area.width,
      height: area.height,
      callback: (tile, worldCoord) => {
        if (!tile) return;
        const resourceTile = this.map.getTileAt(worldCoord.x, worldCoord.y, undefined, "resource");
        const isResource = this.gm.extendedDungeon.isResource(worldCoord);
        const hasGroundResources = this.gm.extendedDungeon.hasGroundResources(worldCoord);
        const { isMined } = this.gm.extendedDungeon.getTileAt(worldCoord);

        // Render gold and souls
        if (hasGroundResources && !isMined) {
          this.drawTile(resourceTile, TileType.SoulGroundResource);
        } else if (isResource?.soul && !isMined) {
          this.drawTile(resourceTile, TileType.SoulResource);
        } else if (isResource?.gold && !isMined) {
          this.drawTile(resourceTile, TileType.GoldResource);
        } else {
          this.drawTile(resourceTile, TileType.Empty);
        }
      },
    });
  }

  renderAreas(areas: Area[]) {
    if (!this.initialized) {
      this.renderRegionResources(false);
      this.renderRegionBoundaries();
    }

    for (const area of areas) {
      this.renderBackground(area);
      this.renderResources(area);
      this.renderConstructions(area);
    }

    for (const area of areas) {
      this.renderBorderWallsFirstPass(extendArea(area, 1));
    }
    for (const area of areas) {
      this.renderResourcesSecondPass(area);
    }

    for (const area of areas) {
      this.wallConnector.renderWallsConnectionPass(extendArea(area, 1));
      this.wallDepthPass.render(extendArea(area, 1));
    }

    if (!this.initialized) this.initialized = true;
  }
}
