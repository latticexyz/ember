import {
  DungeonEvent,
  EthAddress,
  GameManagerEvent,
  WorldCoord,
  NotificationManagerEvent,
  UIEvent,
  UpgradeItem,
  ExplorerEvent,
  ImpWorkType,
  NetworkEvent,
} from "../../_types/GlobalTypes";
import {
  LoadingStage,
  ObjectTilesetAnimations,
  ObjectTilesetId,
  colors,
  ColorKey,
  SpriteNameAndModifierToFrameStartAndNumber,
  getAnimationNameFromSpriteNameAndModifier,
  SpriteName,
  SpriteModifier,
  MODULAR_SPRITE_PARTS,
  getModularSpriteAnimationNamesFromSpriteNameAndModifier,
} from "../constants";

import { PhaserManager } from "../manager/PhaserManager";
import GameManager, { GameManagerEvents } from "../../Backend/Game/GameManager";
import { UIManager, UIEvents } from "../../Frontend/UIManager";

import { GameMap } from "../objects/main/map";
import { StrategicMap } from "../objects/main/strategicMap";
import { NotificationManagerEvents } from "../../Frontend/NotificationManager";
import { TerrainModificationSystem } from "../systems/TerrainModificationSystem";
import { CreatureMoveSystem } from "../systems/CreatureMoveSystem";
import { ExecutionSystem } from "../systems/ExecutionSystem";
import { CameraSystem } from "../systems/CameraSystem";
import { HueTintFXPipeline } from "../pipelines/hueTintAndOutlineFXPipeline";
import { TilemapAnimator } from "../primitives/TilemapAnimator";
import { clearSelection } from "../systems/Utils";
import {
  createWorkingImpAnimation,
  animateTileExplosion,
  animateLaser,
  stackAnimations,
  createAnimateControllerChange,
} from "../utils/animations";
import { DungeonEvents } from "../../Backend/ETH/types";
import { ExplorerEvents } from "../../Backend/Explorer/LazyExplorer";
import { SoundManager, SoundType, SoundLayer } from "../manager/SoundManager";
import { regionCoordToTileCoord, tileCoordToRegionCoord, tilesInRegion } from "../../Backend/Utils/Utils";
import { addListener, Entries } from "../../Utils/Utils";
import { CheckedTypeUtils } from "../../Backend/Utils/CheckedTypeUtils";
import { getColorFromEthAddress } from "../utils/colors";
import { MultiHueTintPipeline } from "../pipelines/multiHueTintPipeline";
import { isTileWall } from "../utils/tiles";
import { SettlementManager } from "../manager/SettlementManager";
import { CreatureStat, TileUpgrade } from "../../_types/ContractTypes";
import { worldCoordsEq } from "../utils/worldCoords";
import { CreatureType } from "@latticexyz/ember-combat";
import { NetworkEvents } from "../../Backend/ETH/Network";


export default class MainScene extends Phaser.Scene {
  player: EthAddress;

  // Backend manager.
  gm: GameManager;
  // Phaser manager.
  phaserManager: PhaserManager;
  // Frontend manager.
  uiManager: UIManager;

  // Systems
  // TODO: move under the same PhaserManager or collapse state similarly under some other object.
  terrainModificationSystem: TerrainModificationSystem;
  creatureMoveSystem: CreatureMoveSystem;
  executionSystem: ExecutionSystem;
  cameraSystem: CameraSystem;
  tilemapAnimator: TilemapAnimator;

  // Event Listeners.
  gameManagerEventListeners: Entries<GameManagerEvents>[];
  networkEventListeners: Entries<NetworkEvents>[];
  dungeonEventListeners: Entries<DungeonEvents>[];
  notificationEventListeners: Entries<NotificationManagerEvents>[];
  uiEventListeners: Entries<UIEvents>[];
  explorerEventListeners: Entries<ExplorerEvents>[];

  // Game objects.
  gameMap: GameMap;
  strategicMap: StrategicMap;
  fpsMeterCount: HTMLElement;

  // Flags.
  viewportChanged: boolean;
  renderingInfluence: boolean;

  // Pipeline.
  hueTintPipeline: HueTintFXPipeline;
  // Particle Manager (Phaser).
  particleManager: Phaser.GameObjects.Particles.ParticleEmitterManager;

  constructor() {
    super({ key: "MainScene" });
    (window as any).mainScene = this;
  }

  destroyEventListeners() {
    this.dungeonEventListeners.forEach((listener) => this.gm.extendedDungeon.removeListener(...listener));
    this.gameManagerEventListeners.forEach((listener) => this.gm.removeListener(...listener));
    this.notificationEventListeners.forEach((listener) => this.uiManager.services.notificationManager.removeListener(...listener));
    this.uiEventListeners.forEach((listener) => this.uiManager.removeListener(...listener));
    this.explorerEventListeners.forEach((listener) => this.gm.extendedDungeon.explorer.removeListener(...listener));
  }

  destroy() {
    // Destroy event listeners.
    this.destroyEventListeners();

    // Destroy Phaser-specific stuff.
    this.lights.destroy();
    this.hueTintPipeline.destroy();
    this.particleManager.destroy();

    // Destroy all of the services.
    PhaserManager.hasInstance() && this.phaserManager.destroy();
    this.tilemapAnimator.destroyService();

    // Destroy the singleton.
    PhaserManager.destroy();
    // TODO: sound manager should not be a singleton but should be under PhaserManager.
    SoundManager.destroy();
  }

  create() {
    this.setupAnimations();
    // The "destroy" event should be fired off when the scene is removed from the game.
    this.events.on(this.scene.scene.events.destroy.name, () => this.destroy());
    this.fpsMeterCount = document.getElementById("fpsCount") as HTMLElement;

    // Get singletons for managing the state for backend (GameManager), frontend (UIManager), and game (PhaserManager).
    this.gm = GameManager.getInstance();
    this.uiManager = UIManager.getInstance();
    this.phaserManager = PhaserManager.getInstance();

    // Not all services *have* to be under PhaserManager. In this case, if we want the TilemapAnimator
    // to be specific to the MainScene scene, then we can use it like this and then call bootService()
    // and destroyService() ourselves instead of letting PhaserManager do it for us.
    const animationRequests = Object.values(ObjectTilesetAnimations)
      .flat()
      .map((req) => ({ frames: req }));
    this.tilemapAnimator = new TilemapAnimator(100, animationRequests);


    this.phaserManager.services.viewportManager.setOnViewportChange((viewport, currentRegions, addedRegions, removedRegions) => {
      this.gameMap.setRegionsInViewport();
      this.phaserManager.services.toolManager.updateData();
      this.viewportChanged = removedRegions.length === 0 && addedRegions.length === 0 ? false : true;
      if (addedRegions.length > 0) {
        this.gm.extendedDungeon.explorer.addRegionsToExplore(addedRegions, true);
        this.phaserManager.services.creatureManager.registerCreaturesInRegion(addedRegions);
        this.phaserManager.services.settlementManager.registerSettlementsInRegion(addedRegions);
      }
      if (addedRegions.length > 0 || removedRegions.length > 0) {
        this.uiManager.state.setViewportPlayers(currentRegions.coords(), this.gm);
      }
    });

    this.phaserManager.services.strategicMapViewportManager.setOnViewportChange((viewport, currentRegions, addedRegions, removedRegions) => {
      if (addedRegions.length > 0) {
        this.gm.extendedDungeon.explorer.addRegionsToExplore(addedRegions);
      }
    });

    // Get references to game objects that the scene needs. These are managed by the PhaserManager,
    // but we get a reference to them here for convenience. These are not initialized until 
    // boot() is called on the PhaserManager.
    this.gameMap = this.phaserManager.objects.gameMap;
    this.strategicMap = this.phaserManager.objects.strategicMap;


    this.particleManager = this.add.particles("particle");
    this.player = this.gm.address;

    // TODO: move under the same PhaserManager or collapse state similarly under some other object.
    this.terrainModificationSystem = new TerrainModificationSystem();
    this.creatureMoveSystem = new CreatureMoveSystem();
    this.executionSystem = new ExecutionSystem();
    this.cameraSystem = new CameraSystem(
      this,
      this.gameMap,
      this.strategicMap,
      this.phaserManager.services.cameraState,
      this.phaserManager.services.selectionManager.state,
      {
        acceleration: 0.05,
        drag: 0.002,
        maxLateralSpeed: 1,
      },
      this.phaserManager.services.viewportObjectManager
    );

    // Set up the pipeline.
    const renderer = this.renderer as Phaser.Renderer.WebGL.WebGLRenderer;
    this.hueTintPipeline = renderer.pipelines.add(
      HueTintFXPipeline.KEY,
      new HueTintFXPipeline(this.game)
    ) as HueTintFXPipeline;
    renderer.pipelines.add(MultiHueTintPipeline.KEY, new MultiHueTintPipeline(this.game));

    SoundManager.init(this, this.phaserManager.services.viewportManager);

    this.setupEventListeners();
    this.gm.processDelayedActions(this.gm.extendedDungeon.delayedActions, true);

    // Try to center the camera on dungeon heart.
    setTimeout(() => this.centerCamera(), 5);

    // TODO: No time to debug why mask does not show up without timeout
    setTimeout(() => this.phaserManager.services.toolManager.init(), 100);

    // Boot up all the managers (singletons).
    this.phaserManager.boot(this);
    // Boot up any services specific to the scene.
    this.tilemapAnimator.bootService(this);

    // Link up state between different objects and services.
    this.gameMap.camera.zoom = 2;
    this.gameMap.camera.ignore(this.strategicMap.graphics);
    this.strategicMap.camera.setVisible(false);
    this.strategicMap.camera.ignore(this.phaserManager.services.toolManager.getGameObjects());

    this.phaserManager.services.groupRegistry.groups.emitter.add(this.particleManager);
  }

  setupAnimations() {
    for (const spriteName of Object.keys(SpriteNameAndModifierToFrameStartAndNumber)) {
      {
        const modifiers = SpriteNameAndModifierToFrameStartAndNumber[spriteName];
        for (const spriteModifier of Object.keys(modifiers)) {
          const config = modifiers[spriteModifier];
          if (config.start) {
            const { start, length } = config;
            const animationName = getAnimationNameFromSpriteNameAndModifier(
              spriteName as SpriteName,
              spriteModifier as SpriteModifier
            );
            this.anims.create({
              key: animationName,
              frames: this.anims.generateFrameNumbers("tilemapSpritesheet", { start: start, end: start + length - 1 }),
              frameRate: 10,
              repeat: spriteModifier === SpriteModifier.Action && spriteName !== SpriteName.Imp ? 0 : -1,
            });
          } else {
            const { prefix, length } = config;
            const animationName = getAnimationNameFromSpriteNameAndModifier(
              spriteName as SpriteName,
              spriteModifier as SpriteModifier
            );
            this.anims.create({
              key: animationName,
              frames: this.anims.generateFrameNames("atlas", {
                start: 0,
                end: length - 1,
                prefix: (prefix + "/") as string,
                suffix: ".png",
              }),
              frameRate: 10,
              repeat: -1,
            });
          }
        }
      }
    }

    this.anims.create({
      key: "laser-top-anim",
      frames: this.anims.generateFrameNames("laser", { start: 0, end: 11 }),
      frameRate: 10,
      repeat: 0,
    });

    this.anims.create({
      key: "laser-bottom-anim",
      frames: this.anims.generateFrameNames("laser", { start: 12, end: 23 }),
      frameRate: 10,
      repeat: 0,
    });
    // regionResources

    this.anims.create({
      key: "region-resources-souls",
      frames: this.anims.generateFrameNames("tilemapSpritesheet", { start: 652, end: 659 }),
      frameRate: 10,
      repeat: -1,
    });
    this.anims.create({
      key: "region-resources-gold",
      frames: this.anims.generateFrameNames("tilemapSpritesheet", { start: 684, end: 691 }),
      frameRate: 10,
      repeat: -1,
    });
    this.anims.create({
      key: "region-resources-gold-and-souls",
      frames: this.anims.generateFrameNames("tilemapSpritesheet", { start: 716, end: 723 }),
      frameRate: 10,
      repeat: -1,
    });

    this.anims.create({
      key: "imp-appear",
      frames: this.anims.generateFrameNames("tilemapSpritesheet", { start: 534, end: 543 }),
      frameRate: 10,
      repeat: 0,
    });

    this.anims.create({
      key: "imp-disappear",
      frames: this.anims.generateFrameNames("tilemapSpritesheet", { start: 566, end: 574 }),
      frameRate: 10,
      repeat: 0,
    });
    // stars
    this.anims.create({
      key: "stars-bronze",
      frames: this.anims.generateFrameNames("atlas", {
        start: 0,
        end: 3,
        prefix: "sprites/effects/stars/bronze/",
        suffix: ".png",
      }),
      frameRate: 10,
      repeat: -1,
    });
    this.anims.create({
      key: "stars-silver",
      frames: this.anims.generateFrameNames("atlas", {
        start: 0,
        end: 3,
        prefix: "sprites/effects/stars/silver/",
        suffix: ".png",
      }),
      frameRate: 10,
      repeat: -1,
    });
    this.anims.create({
      key: "stars-gold",
      frames: this.anims.generateFrameNames("atlas", {
        start: 0,
        end: 3,
        prefix: "sprites/effects/stars/gold/",
        suffix: ".png",
      }),
      frameRate: 10,
      repeat: -1,
    });
  }

  hideModal() {
    // Hide "Confirm delayed action" modal
    if (this.uiManager.state.confirmDelayedActionData) {
      this.uiManager.state.setConfirmDelayedActionData(null);
    }
  }

  async centerCamera() {
    const dungeonHeart = await this.gm.extendedDungeon.getPlayerDungeonHeart(this.gm.address);
    this.gameMap.centerMap(dungeonHeart);
    this.strategicMap.centerMap(dungeonHeart);
  }

  updateViewport() {
    if (this.cameraSystem.strategicViewVisible) {
      this.phaserManager.services.strategicMapViewportManager.setViewport(this.strategicMap.getViewport());
    } else {
      this.phaserManager.services.viewportManager.setViewport(this.gameMap.getViewport());
    }
  }

  updateCursor(shouldRender: boolean) {
    this.strategicMap.updateCursor(shouldRender && this.cameraSystem.strategicViewVisible);
    this.gameMap.cursor.update(shouldRender && !this.cameraSystem.strategicViewVisible);
  }

  updateRegionBoundaryView() {
    if (this.phaserManager.services.inputManager.state.currentInput.has("showTacticalView")) {
      this.phaserManager.services.groupRegistry.groups.regionAndEmpireBoundary.setVisible(true);
      this.uiManager.state.setShowPlayerOverview(true);
      this.gameMap.renderRegionInfluence(true);
    }
    if (this.phaserManager.services.inputManager.state.currentInput.has("hideTacticalView")) {
      this.phaserManager.services.groupRegistry.groups.regionAndEmpireBoundary.setVisible(false);
      this.phaserManager.services.groupRegistry.groups.influence.setVisible(false);
      this.uiManager.state.setShowPlayerOverview(false);
    }

    if (this.viewportChanged) {
      this.gameMap.renderRegionResources(this.phaserManager.services.inputManager.state.currentInput.has("showTacticalView"));
    } else {
      this.gameMap.updateRegionResources(this.phaserManager.services.inputManager.state.currentInput.has("showTacticalView"));
    }
  }

  update() {
    const loop = this.sys.game.loop;
    const delta = loop.delta;
    this.tilemapAnimator.postUpdate(delta);
    this.phaserManager.services.combatRendererManager.update();

    //@ts-ignore
    if (this.fpsMeterCount) this.fpsMeterCount.textContent = "FPS: " + loop.actualFps.toFixed(1);

    // update input
    this.phaserManager.services.inputManager.handleInput(this.input, this.uiManager.state, this.gameMap);

    // Update everything that depends on input
    this.cameraSystem.update(delta);
    this.updateCursor(!this.uiManager.state.pointerOverReactUI && !this.cameraSystem.cameraMoving);
    // Prevent the user from being able to click around when in stratefic view.
    if (!this.cameraSystem.strategicViewVisible) {
      this.phaserManager.services.selectionSystem.update(this.phaserManager.services.selectionManager.state);
    }
    this.terrainModificationSystem.update(this.phaserManager.services.selectionManager.state, this.phaserManager.services.toolManager, this.gm);
    this.executionSystem.update(this.phaserManager.services.selectionManager.state, this.phaserManager.services.toolManager);
    this.creatureMoveSystem.update(this.phaserManager.services.inputManager.state, this.phaserManager.services.selectionManager.state, this.phaserManager.services.toolManager, this.gameMap);
    this.phaserManager.services.toolManager.update();
    this.updateRegionBoundaryView();

    if (this.cameraSystem.strategicViewVisible) {
      const staleChunks = this.phaserManager.services.strategicMapChunkManager.getStaleChunksInViewport();
      const staleAreas = staleChunks.map((chunk) => this.phaserManager.services.strategicMapChunkManager.chunkCoordToArea(chunk));
      this.strategicMap.renderAreas(staleAreas);
      this.phaserManager.services.strategicMapChunkManager.setChunksUnstale(staleChunks);
    } else {
      const staleChunks = this.phaserManager.services.chunkManager.getStaleChunksInViewport();
      const staleAreas = staleChunks.map((chunk) => this.phaserManager.services.chunkManager.chunkCoordToArea(chunk));
      this.gameMap.renderAreas(staleAreas);
      this.phaserManager.services.viewportObjectManager.update();
      this.phaserManager.services.chunkManager.setChunksUnstale(staleChunks);
      this.phaserManager.services.unitMoveManager.update();
    }
    this.updateViewport();
    this.phaserManager.services.inputManager.state.reset();
  }

  setupEventListeners() {
    const removeActiveTile = (coord: WorldCoord, address: EthAddress = this.player) => {
      this.phaserManager.services.impManager.removeTileToWorkOn(address, coord);
      this.phaserManager.services.activeTileManager.removeActiveTile(coord);
    };

    const removeActiveTileAndExplode = (coord: WorldCoord, address: EthAddress = this.player) => {
      removeActiveTile(coord, address);
      this.phaserManager.services.animationManager.addAnimation(animateTileExplosion, coord);
    };

    this.dungeonEventListeners = [
      addListener(this.gm.extendedDungeon, DungeonEvent.PlayerInitialized, (p) => {
        const { player } = p;
        this.phaserManager.services.impManager.initPlayer(player);
      }),

      addListener(this.gm.extendedDungeon, DungeonEvent.TileMined, async (tile, coord, miner) => {
        if (miner === this.gm.address) {
          removeActiveTileAndExplode(coord);
        } else {
          const animateWorkingImp = createWorkingImpAnimation(miner);
          this.phaserManager.services.animationManager.addAnimation(animateWorkingImp, coord);
          this.phaserManager.services.activeTileManager.removeActiveTile(coord);
        }
        this.phaserManager.services.chunkManager.setTileStale(coord);
        this.phaserManager.services.strategicMapChunkManager.setTileStale(coord);
        this.phaserManager.services.toolManager.updateToolGraphics();
        this.gameMap.updateRegionResources(this.phaserManager.services.inputManager.state.currentInput.has("showTacticalView"));
        SoundManager.register(SoundType.MINE_END, coord);
      }),

      addListener(this.gm.extendedDungeon, DungeonEvent.RegionUpdated, (region, regionCoord) => {
        this.gameMap.updateRegionResources(this.phaserManager.services.inputManager.state.currentInput.has("showTacticalView"));
      }),

      addListener(this.gm.extendedDungeon, DungeonEvent.TileClaimed, async (tile, coord) => {
        removeActiveTileAndExplode(coord);
        this.phaserManager.services.chunkManager.setTileStale(coord);
        this.phaserManager.services.strategicMapChunkManager.setTileStale(coord);
        this.phaserManager.services.toolManager.updateToolGraphics();
      }),

      addListener(this.gm.extendedDungeon, DungeonEvent.TileUpgraded, (tile, coord) => {
        if (tile.owner !== this.gm.address) {
          const animateWorkingImp = createWorkingImpAnimation(tile.owner);
          this.phaserManager.services.animationManager.addAnimation(stackAnimations(animateWorkingImp, animateLaser), coord);
          SoundManager.register(SoundType.UPGRADE_END, coord, SoundLayer.UPGRADING);
        } else {
          removeActiveTileAndExplode(coord);
          this.phaserManager.services.animationManager.addAnimation(animateLaser, coord);
          SoundManager.register(SoundType.UPGRADE_END, coord, SoundLayer.UPGRADING);
        }
        this.phaserManager.services.chunkManager.setTileStale(coord);
        this.phaserManager.services.toolManager.updateToolGraphics();
        this.gameMap.updateRegionResources(this.phaserManager.services.inputManager.state.currentInput.has("showTacticalView"));
      }),

      addListener(this.gm.extendedDungeon, DungeonEvent.TileDelayedActionInitiated, (delayedAction) => {
        if (delayedAction.initiator === this.player) {
          this.phaserManager.services.impManager.removeTileToWorkOn(this.player, delayedAction.coord);
        }
        this.phaserManager.services.activeTileManager.setActiveTile(delayedAction.coord, LoadingStage.Waiting, delayedAction);
      }),

      addListener(this.gm.extendedDungeon, DungeonEvent.TileWalled, (tile, coord) => {
        if (tile.owner !== this.gm.address) {
          const animateWorkingImp = createWorkingImpAnimation(tile.owner);
          this.phaserManager.services.animationManager.addAnimation(stackAnimations(animateWorkingImp, animateLaser), coord);
        } else {
          removeActiveTileAndExplode(coord);
          this.phaserManager.services.animationManager.addAnimation(animateLaser, coord);
        }
        this.phaserManager.services.activeTileManager.removeActiveTile(coord);
        this.phaserManager.services.chunkManager.setTileStale(coord);
        this.phaserManager.services.strategicMapChunkManager.setTileStale(coord);
        this.phaserManager.services.toolManager.updateToolGraphics();
      }),

      addListener(this.gm.extendedDungeon, DungeonEvent.TileUnwalled, (tile, coords) => {
        // TODO: Add miner to event and animate with enemy imps
        removeActiveTileAndExplode(coords);
        this.phaserManager.services.chunkManager.setTileStale(coords);
        this.phaserManager.services.strategicMapChunkManager.setTileStale(coords);
        this.phaserManager.services.toolManager.updateToolGraphics();
      }),

      addListener(this.gm.extendedDungeon, DungeonEvent.PlayerInfluenceInRegionUpdated, (player, region, amount) => {
        this.phaserManager.services.chunkManager.setRegionStale(region);
        const tacticalView = this.phaserManager.services.inputManager.state.currentInput.has("showTacticalView");
        this.gameMap.renderRegionInfluence(tacticalView);
        this.phaserManager.services.toolManager.updateData();
      }),

      addListener(this.gm.extendedDungeon, DungeonEvent.SettlementUpdated, (settlement, regionCoord) => {
        const id = this.phaserManager.services.settlementManager.getSettlementId(regionCoord);
        const existingSettlement = this.phaserManager.services.viewportObjectManager.has(id);
        if (existingSettlement) {
          this.phaserManager.services.settlementManager.updateSettlement(id, settlement);
        } else {
          this.phaserManager.services.settlementManager.registerSettlement(id, regionCoord);
        }
      }),

      addListener(this.gm.extendedDungeon, DungeonEvent.CreatureMovedToRegion, (creatureId, creature, tileCoord) => {
        const existingCreature = this.phaserManager.services.viewportObjectManager.has(creatureId);
        const isUnique = creature.creatureType === CreatureType.UNIQUE;
        const maxLife =
          this.gm.constants.gameConstants.CREATURES_BASE_STAT_PER_SPECIES[creature.species][CreatureStat.LIFE][
          creature.level
          ] * (isUnique ? this.gm.constants.gameConstants.CREATURES_UNIQUE_STAT_MULTIPLIER : 1);

        // Else either move or register creature
        if (existingCreature) {
          this.phaserManager.services.creatureManager.setDestination(creatureId, tileCoord, creature.owner);
          this.phaserManager.services.creatureManager.updateCreatureLife(creatureId, creature.life, maxLife);
          this.phaserManager.services.creatureManager.updateCreatureLevel(creatureId, creature.level);
        } else {
          this.phaserManager.services.creatureManager.registerCreature(creatureId, tileCoord);
          SoundManager.register(SoundType.CREATURE, tileCoord);
        }
      }),

      addListener(this.gm.extendedDungeon, DungeonEvent.CreatureUpdated, (creatureId, creature, tileCoord) => {
        const existingCreature = this.phaserManager.services.creatureManager.isRegistered(creatureId);
        const isUnique = creature.creatureType === CreatureType.UNIQUE;
        const maxLife =
          this.gm.constants.gameConstants.CREATURES_BASE_STAT_PER_SPECIES[creature.species][CreatureStat.LIFE][
          creature.level
          ] * (isUnique ? this.gm.constants.gameConstants.CREATURES_UNIQUE_STAT_MULTIPLIER : 1);

        if (existingCreature) {
          this.phaserManager.services.creatureManager.updateCreatureLife(creatureId, creature.life, maxLife);
          this.phaserManager.services.creatureManager.updateCreatureLevel(creatureId, creature.level);
        } else {
          this.phaserManager.services.creatureManager.registerCreature(creatureId, tileCoord);
        }
      }),

      addListener(this.gm.extendedDungeon, DungeonEvent.CreatureDied, (creatureId) => {
        this.phaserManager.services.creatureManager.killCreature(creatureId);
      }),

      addListener(
        this.gm.extendedDungeon,
        DungeonEvent.Combat,
        async (squad1, squad2, trace, winner, soulsDropped, regionCoord, txHash) => {
          const tileCoord = regionCoordToTileCoord(regionCoord);
          SoundManager.removeSpatialSound(tileCoord, SoundLayer.COMBAT);
          this.phaserManager.services.combatRendererManager.playCombatTrace({
            regionCoord,
            squad1,
            squad2,
            trace,
            winner,
            soulsDropped,
            txHash,
          });
        }
      ),

      addListener(
        this.gm.extendedDungeon,
        DungeonEvent.RegionControllerChanged,
        (regionCoord, oldController, newController) => {
          this.phaserManager.services.toolManager.updateToolGraphics();
          if (newController === CheckedTypeUtils.EMPTY_ADDRESS) return;
          this.phaserManager.services.impManager.fleeRegion(regionCoord, newController);
          const tint =
            newController === this.gm.address ? colors[ColorKey.Player]! : getColorFromEthAddress(newController).color;
          for (const t of tilesInRegion(regionCoord)) {
            const tileIndex = this.gameMap.map.getTileAt(t.x, t.y).index;
            if (isTileWall(tileIndex)) {
              this.phaserManager.services.animationManager.addAnimation(createAnimateControllerChange(tint), t);
            }
          }
        }
      ),
    ];

    const tileEventHandlers = {
      scheduled: (coord: WorldCoord) => {
        this.phaserManager.services.activeTileManager.setActiveTile(coord, LoadingStage.Planned);
      },
      started: (coord: WorldCoord, type: ImpWorkType) => {
        this.phaserManager.services.activeTileManager.setActiveTile(coord, LoadingStage.Planned);
        this.phaserManager.services.impManager.addTileToWorkOn(this.player, coord, type);
      },
      submitting: (coord: WorldCoord) => {
        this.phaserManager.services.activeTileManager.setActiveTile(coord, LoadingStage.Submitting);
      },
      submitted: (coord: WorldCoord) => {
        this.phaserManager.services.activeTileManager.setActiveTile(coord, LoadingStage.Confirming);
      },
      confirmed: (coord: WorldCoord) => {
        this.phaserManager.services.toolManager.updateToolGraphics();
      },
      cancelled: removeActiveTile,
      failed: removeActiveTile,
    };

    const tileScheduledEvents: GameManagerEvent[] = [
      GameManagerEvent.MineTileScheduled,
      GameManagerEvent.UpgradeTileScheduled,
      GameManagerEvent.WallTileScheduled,
      GameManagerEvent.UnwallTileScheduled,
      GameManagerEvent.ForceMineTileScheduled,
    ];

    const tileTXSubmittingEvents: GameManagerEvent[] = [
      GameManagerEvent.MineTileTXSubmitting,
      GameManagerEvent.UpgradeTileTXSubmitting,
      GameManagerEvent.WallTileTXSubmitting,
      GameManagerEvent.UnwallTileTXSubmitting,
      GameManagerEvent.ForceMineTileTXSubmitting,
    ];
    const tileTXSubmittedEvents: GameManagerEvent[] = [
      GameManagerEvent.MineTileTXSubmitted,
      GameManagerEvent.UpgradeTileTXSubmitted,
      GameManagerEvent.WallTileTXSubmitted,
      GameManagerEvent.UnwallTileTXSubmitted,
      GameManagerEvent.ForceMineTileTXSubmitted,
    ];
    const tileTXCancelledEvents: GameManagerEvent[] = [
      GameManagerEvent.MineTileCancelled,
      GameManagerEvent.UpgradeTileCancelled,
      GameManagerEvent.WallTileCancelled,
      GameManagerEvent.UnwallTileCancelled,
      GameManagerEvent.ForceMineTileCancelled,
    ];

    const tileTXConfirmedEvents: GameManagerEvent[] = [
      GameManagerEvent.MineTileTXConfirmed,
      GameManagerEvent.UpgradeTileTXConfirmed,
      GameManagerEvent.WallTileTXConfirmed,
      GameManagerEvent.UnwallTileTXConfirmed,
      GameManagerEvent.ForceMineTileTXConfirmed,
    ];
    const tileFailedEvents: GameManagerEvent[] = [
      GameManagerEvent.MineTileFailed,
      GameManagerEvent.UpgradeTileFailed,
      GameManagerEvent.WallTileFailed,
      GameManagerEvent.UnwallTileFailed,
      GameManagerEvent.ForceMineTileFailed,
    ];

    this.gameManagerEventListeners = [
      addListener(this.gm, GameManagerEvent.MoveCreaturesScheduled, (creatureIds, destinationTile) => {
        for (const creatureId of creatureIds) {
          const c = this.gm.extendedDungeon.creatures.get(creatureId)!;
          this.phaserManager.services.creatureManager.setPlannedDestination(creatureId, destinationTile, c.owner);
        }
      }),

      addListener(this.gm, GameManagerEvent.MoveCreaturesCancelled, (creatureIds) => {
        for (const creatureId of creatureIds) {
          const c = this.gm.extendedDungeon.creatures.get(creatureId)!;
          this.phaserManager.services.creatureManager.setPlannedDestination(creatureId, undefined, c.owner);
        }
      }),

      addListener(this.gm, GameManagerEvent.MoveCreaturesFailed, (creatureIds) => {
        for (const creatureId of creatureIds) {
          const c = this.gm.extendedDungeon.creatures.get(creatureId)!;
          this.phaserManager.services.creatureManager.setPlannedDestination(creatureId, undefined, c.owner);
        }
        // It's possible for a creature move to fail as part of a meta-move, so we call the queue
        // process function here to clean up any actions on the queue.
        this.gm.actionQueue.process();
      }),

      addListener(this.gm, GameManagerEvent.MineTileStarted, (coord) => {
        tileEventHandlers.started(coord, ImpWorkType.MINE);
      }),

      addListener(this.gm, GameManagerEvent.UpgradeTileStarted, (coord) => {
        tileEventHandlers.started(coord, ImpWorkType.UPGRADE);
      }),

      addListener(this.gm, GameManagerEvent.WallTileStarted, (coord) => {
        tileEventHandlers.started(coord, ImpWorkType.UPGRADE);
      }),

      addListener(this.gm, GameManagerEvent.UnwallTileStarted, (coord) => {
        tileEventHandlers.started(coord, ImpWorkType.MINE);
      }),

      addListener(this.gm, GameManagerEvent.ForceMineTileStarted, (coord) => {
        tileEventHandlers.started(coord, ImpWorkType.MINE);
      }),

      addListener(this.gm, GameManagerEvent.HarvestTilesTXConfirmed, (coords) => {
        const uniqueRegions: WorldCoord[] = [];
        for (const coord of coords) {
          const region = tileCoordToRegionCoord(coord);
          if (!uniqueRegions.find((r) => worldCoordsEq(r, region))) {
            uniqueRegions.push(region);
          }
        }
        for (const r of uniqueRegions) {
          this.phaserManager.services.chunkManager.setRegionStale(r);
        }
      }),
      ...tileScheduledEvents.map((e) => addListener(this.gm, e, tileEventHandlers.scheduled)),

      ...tileTXSubmittingEvents.map((e) => addListener(this.gm, e, tileEventHandlers.submitting)),

      ...tileTXSubmittedEvents.map((e) => addListener(this.gm, e, tileEventHandlers.submitted)),

      ...tileTXConfirmedEvents.map((e) => addListener(this.gm, e, tileEventHandlers.confirmed)),

      ...tileTXCancelledEvents.map((e) => addListener(this.gm, e, tileEventHandlers.cancelled)),

      ...tileFailedEvents.map((e) => addListener(this.gm, e, tileEventHandlers.failed)),
    ];

    this.notificationEventListeners = [
      addListener(this.uiManager.services.notificationManager, NotificationManagerEvent.JumpToCoord, (coord) => {
        this.gameMap.centerMap(coord);
        this.strategicMap.centerMap(coord);
      }),
    ];

    this.uiEventListeners = [
      addListener(this.uiManager, UIEvent.JumpToCoord, (coord) => {
        this.gameMap.centerMap(coord);
        this.strategicMap.centerMap(coord);
      }),

      addListener(this.uiManager, UIEvent.JumpToCameraGroup, (camNum) => {
        this.cameraSystem.handleViewCamera(camNum);
      }),

      addListener(this.uiManager, UIEvent.SendUpgradeMessage, (upgrade) => {
        const selection = this.phaserManager.services.selectionManager.state.upgradeableCoords;
        this.phaserManager.services.toolManager.tools.upgrade.upgrade(selection, upgrade as UpgradeItem);
        this.uiManager.state.setPointerOverReactUI(false);
        clearSelection(this.phaserManager.services.selectionManager.state, this.phaserManager.services.toolManager);
      }),

      // Triggered when you press a single action in the dragMenu
      addListener(this.uiManager, UIEvent.SendSingleActionMessage, (action) => {
        if (action === "mine" && this.phaserManager.services.selectionManager.state.hasMineableCoords()) {
          this.phaserManager.services.toolManager.tools.mine.mineTiles(this.phaserManager.services.selectionManager.state.mineableCoords, []);
          clearSelection(this.phaserManager.services.selectionManager.state, this.phaserManager.services.toolManager);
        }
        if (action === "forceMine" && this.phaserManager.services.selectionManager.state.hasForceMineCoords()) {
          this.phaserManager.services.toolManager.tools.mine.mineTiles([], this.phaserManager.services.selectionManager.state.forceMineCoords);
          clearSelection(this.phaserManager.services.selectionManager.state, this.phaserManager.services.toolManager);
        }
        if (action === "upgrade" && this.phaserManager.services.selectionManager.state.hasUpgradeableCoords()) {
          this.uiManager.state.setShowHotbar(true, tileCoordToRegionCoord(this.phaserManager.services.selectionManager.state.upgradeableCoords[0]));
        }
      }),

      addListener(this.uiManager, UIEvent.SendCameraMessage, (cameraNum: number) => {
        this.cameraSystem.handleSetCamera(cameraNum);
      }),
    ];

    this.explorerEventListeners = [
      addListener(this.gm.extendedDungeon.explorer, ExplorerEvent.PerlinExplored, (region: WorldCoord) => {
        this.phaserManager.services.chunkManager.setRegionStale(region);
        this.phaserManager.services.strategicMapChunkManager.setRegionStale(region);
      }),
    ];

    this.networkEventListeners = [
      addListener(this.gm.net, NetworkEvent.PredictedChainTimeChanged, (_) => {
        // ridiculous hack. we should do something like the animtion manager that changes one tile efficiently
        // we also need a tile harvested event otherwise we don't know which tile to set stale here
        for (const region of this.phaserManager.services.viewportManager.getRegionsInViewportArray()) {
          for (const coord of tilesInRegion(region)) {
            const tile = this.gm.extendedDungeon.getTileAt(coord);
            if (tile.upgrade !== TileUpgrade.NONE) {
              this.phaserManager.services.chunkManager.setTileStale(coord);
            }
          }
        }
      }),
    ];
  }
}
