import { EventEmitter } from "events";
import { makeAutoObservable } from "mobx";
import { createStrictEventEmitterClass } from "../Backend/Utils/Utils";
import {
  UIEvent,
  Tool,
  Tile,
  InfluenceData,
  GameScene,
  UpgradeItem,
  WorldCoord,
  ResourceType,
  HarvestableGroundResources,
  EthAddress,
} from "../_types/GlobalTypes";
import { TileDelayedActionType, TileUpgrade } from "../_types/ContractTypes";
import GameManager from "../Backend/Game/GameManager";
import { CheckedTypeUtils } from "../Backend/Utils/CheckedTypeUtils";
import { RequiresServices, UIManagerServices } from "../Renderer/game";
import { NotificationManager } from "./NotificationManager";
import MainScene from "../Renderer/scenes/mainScene";

export interface UIEvents {
  [UIEvent.EnterReact]: () => void;
  [UIEvent.LeaveReact]: () => void;
  [UIEvent.JumpToCoord]: (c: WorldCoord) => void;
  [UIEvent.SendUpgradeMessage]: (upgrade: UpgradeItem) => void;
  [UIEvent.SendSingleActionMessage]: (action: string) => void;
  [UIEvent.SendCameraMessage]: (cameraNum: number) => void;
  [UIEvent.JumpToCameraGroup]: (cameraNum: number) => void;
}

export enum InteractType {
  Resource = "Resource",
  HarvestableGroundResources = "HarvestableGroundResources",
  Upgrade = "Upgrade",
  Generic = "Generic",
  Empty = "Empty",
}
// TODO: Strip gold, souls, and influence and compute it in components to make it re-render
export interface RegionData {
  influence?: InfluenceData;
  coord: WorldCoord;
  gold: number;
  souls: number;
}

export interface GenericInteractData {
  tile?: Tile;
  selectedCoords: WorldCoord[];
  region?: RegionData;
}

type SpecificInteractData =
  | {
    type: InteractType.Resource;
    subtype: ResourceType;
  }
  | {
    type: InteractType.Upgrade;
    subtype: TileUpgrade;
  }
  | {
    type: InteractType.HarvestableGroundResources;
    subtype: HarvestableGroundResources;
  }
  | { type: InteractType.Generic }
  | { type: InteractType.Empty };

export type InteractData = GenericInteractData & SpecificInteractData;

export interface ConfirmDelayedActionData {
  viewportCoord: WorldCoord;
  coords: WorldCoord[];
  // either unwall or force mine
  delayedActionType: TileDelayedActionType;
  playerControlsRegion: boolean;
}

export interface CreatureData {
  selectedCreatureIds: string[];
  creaturesInHoverRegion: string[];
}

export interface CreatureMovementData {
  multiMoveCurrentlyPlanning: boolean;
  multiMoveCurrentlySelectedCreatureId: string | undefined;
  multiMovePlannedCreatureMoves: Map<string, WorldCoord>;
  numberCreaturesMoving: number;
}

export class UIState {
  creatureData: CreatureData = {
    selectedCreatureIds: [],
    creaturesInHoverRegion: [],
  };
  creatureMovementData: CreatureMovementData = {
    multiMoveCurrentlyPlanning: false,
    multiMoveCurrentlySelectedCreatureId: undefined,
    multiMovePlannedCreatureMoves: new Map(),
    numberCreaturesMoving: 0,
  };
  interactData: InteractData = {
    type: InteractType.Empty,
    selectedCoords: [],
  };
  confirmDelayedActionData: ConfirmDelayedActionData | null = null;
  tool: Tool = Tool.MineTile;
  upgradeTool: UpgradeItem = UpgradeItem.GoldStorage;
  pointerOverReactUI: boolean = false;
  inputFocused: boolean = false;
  showHotbar: boolean = false;
  gameScene: GameScene = GameScene.Loading;
  playersInViewport: Set<EthAddress> = new Set();
  fundsWindowOpened: boolean = false;
  showPlayerOverview: { open: boolean; showSearch: boolean } = { open: false, showSearch: false };
  settingsWindowOpened: boolean = false;
  showHelp: boolean = false;

  constructor() {
    makeAutoObservable(this);
  }

  clearInteractData() {
    this.interactData = {
      type: InteractType.Empty,
      selectedCoords: [],
    };
  }

  setFundsWindowOpened(opened: boolean) {
    this.fundsWindowOpened = opened;
  }

  setInteractData(data: InteractData) {
    this.interactData = data;
  }

  setUpgradeTool(upgradeTool: UpgradeItem) {
    this.upgradeTool = upgradeTool;
  }

  setPointerOverReactUI(pointerOverReactUI: boolean) {
    this.pointerOverReactUI = pointerOverReactUI;
  }

  setInputFocused(inputFocused: boolean) {
    this.inputFocused = inputFocused;
  }

  setConfirmDelayedActionData(data: ConfirmDelayedActionData | null) {
    this.confirmDelayedActionData = data;
  }

  setGameScene(gameScene: GameScene) {
    this.gameScene = gameScene;
  }

  setCreatureData(data: CreatureData) {
    this.creatureData = data;
  }

  toggleHelp() {
    this.showHelp = !this.showHelp;
  }

  addCreature(id: string) {
    if (this.creatureData.selectedCreatureIds.includes(id)) return;
    const prevIds = this.creatureData.selectedCreatureIds;
    this.creatureData = {
      ...this.creatureData,
      selectedCreatureIds: [...prevIds, id],
    };
  }

  setCreaturesInHoverRegion(creaturesInHoverRegion: string[]) {
    this.creatureData = {
      ...this.creatureData,
      creaturesInHoverRegion,
    };
  }

  setViewportPlayers(regions: WorldCoord[], gm: GameManager) {
    const playersInViewport = new Set<EthAddress>();
    for (const coord of regions) {
      const { controller, disputed } = gm.extendedDungeon.getRegionController(coord);
      if (!disputed && controller !== CheckedTypeUtils.EMPTY_ADDRESS) {
        playersInViewport.add(controller);
      }
    }
    this.playersInViewport = playersInViewport;
  }

  addViewportPlayers(addedRegions: WorldCoord[], gm: GameManager) {
    for (const coord of addedRegions) {
      const { controller, disputed } = gm.extendedDungeon.getRegionController(coord);
      if (!disputed && controller !== CheckedTypeUtils.EMPTY_ADDRESS) {
        this.playersInViewport.add(controller);
      }
    }
  }

  removeViewportPlayers(removedRegions: WorldCoord[], gm: GameManager) {
    for (const coord of removedRegions) {
      const { controller, disputed } = gm.extendedDungeon.getRegionController(coord);
      if (!disputed && controller !== CheckedTypeUtils.EMPTY_ADDRESS) {
        this.playersInViewport.delete(controller);
      }
    }
  }

  setShowHotbar(val: boolean) {
    this.showHotbar = val;
    if (!val) this.pointerOverReactUI = false;
  }

  setShowPlayerOverview(open: boolean, showSearch?: boolean) {
    this.showPlayerOverview = {
      open,
      showSearch: showSearch ?? false,
    };
  }

  /// Functions to handle a creature multi-move, where a player can set destinations for each creature individually.

  isCurrentlyPlanningMultiCreatureMove(): boolean {
    return this.creatureMovementData.multiMoveCurrentlyPlanning;
  }

  startPlanningMultiCreatureMove(numberCreaturesMoving: number) {
    this.creatureMovementData.multiMoveCurrentlyPlanning = true;
    this.creatureMovementData.numberCreaturesMoving = numberCreaturesMoving;
  }

  stopPlanningMultiCreatureMove() {
    this.creatureMovementData.multiMoveCurrentlyPlanning = false;
    this.creatureMovementData.numberCreaturesMoving = 0;
  }

  setDestinationForCreatureInMultiCreatureMove(creatureId: string, destination: WorldCoord) {
    this.creatureMovementData.multiMovePlannedCreatureMoves.set(creatureId, destination);
  }

  getDestinationForCreatureInMultiCreatureMove(creatureId: string): WorldCoord | undefined {
    return this.creatureMovementData.multiMovePlannedCreatureMoves.get(creatureId);
  }

  getCurrentlySelectingCreatureId(): string | undefined {
    return this.creatureMovementData.multiMoveCurrentlySelectedCreatureId;
  }

  startSelectingDestinationForCreatureInMultiCreatureMove(creatureId: string) {
    this.creatureMovementData.multiMoveCurrentlySelectedCreatureId = creatureId;

    // If this creature was already given a destination, that means we are trying
    // to update it, so clear out the old destination.
    this.creatureMovementData.multiMovePlannedCreatureMoves.delete(creatureId);
  }

  resetCurrentlySelectingCreatureId() {
    this.creatureMovementData.multiMoveCurrentlySelectedCreatureId = undefined;
  }

  clearCreatureMovementData() {
    this.creatureMovementData.multiMovePlannedCreatureMoves.clear();
    this.creatureMovementData.multiMoveCurrentlyPlanning = false;
    this.creatureMovementData.multiMoveCurrentlySelectedCreatureId = undefined;
  }

  areAllDestinationsSet(): boolean {
    const numberDestinationsSet = Array.from(this.creatureMovementData.multiMovePlannedCreatureMoves).filter(
      (destination) => destination !== undefined
    ).length;
    return this.creatureMovementData.numberCreaturesMoving === numberDestinationsSet;
  }

  setSettingsWindowOpened(val: boolean) {
    this.settingsWindowOpened = val;
  }
}

export class UIManager extends createStrictEventEmitterClass<UIEvents>() implements RequiresServices {
  services: UIManagerServices;
  state: UIState;
  private cursorIcon: string;
  static instance: UIManager;

  constructor() {
    super();

    this.state = new UIState();

    const notificationManager = new NotificationManager();

    this.services = {
      notificationManager: notificationManager
    }
  }

  boot(scene: MainScene) {
    this.services.notificationManager.bootService(scene);
  }

  destroy() {
    this.services.notificationManager.destroyService();
  }

  static getInstance(): UIManager {
    if (!this.instance) {
      this.instance = new UIManager();
    }
    return this.instance;
  }

  enterReact() {
    this.cursorIcon = document.body.style.cursor;
    document.body.style.cursor = "auto";
    this.state.setPointerOverReactUI(true);
  }

  leaveReact() {
    document.body.style.cursor = this.cursorIcon;
    this.state.setPointerOverReactUI(false);
  }

  jumpToCoord(c: WorldCoord) {
    this.emit(UIEvent.JumpToCoord, c);
  }

  jumpToCameraGroup(group: number) {
    this.emit(UIEvent.JumpToCameraGroup, group);
  }

  sendUpgradeMessage(upgrade: UpgradeItem) {
    this.emit(UIEvent.SendUpgradeMessage, upgrade);
  }
  sendSingleActionMessage(action: string) {
    this.emit(UIEvent.SendSingleActionMessage, action);
  }
  sendCameraMessage(cameraNum: number) {
    this.emit(UIEvent.SendCameraMessage, cameraNum);
  }
}
