import { TileDelayedActionType, TileUpgrade, CreatureSpecies, CreatureType } from "./ContractTypes";
import { MovingAverage } from "../Backend/Game/MovingAverage";
import { Semaphore } from "../Backend/Game/Semaphore";

export interface WithId {
  id: string;
}

export enum PlayerStatus {
  UNKNOWN = "UNKNOWN",
  WHITELISTED = "WHITELISTED",
  INITIALIZED = "INITIALIZED",
}

/**
 * this is expected to be 64-length, lowercase hex string. see src/Utils/CheckedTypeUtils.ts for constructor
 */
export type TileId = string & {
  __value__: never;
};

export type RegionId = string & {
  __value__: never;
};

export type LocationId = TileId | RegionId;

export type EthAddress = string & {
  __value__: never;
}; // this is expected to be 40 chars, lowercase hex. see src/Utils/CheckedTypeUtils.ts for constructor

// objects
export interface Tile {
  owner: EthAddress;
  lastHarvestTimestamp: number;
  touchable: boolean;
  upgrade: TileUpgrade;
  // this is always true for tiles we get from the contract
  isMined: boolean;
  isWalled: boolean;
}

export interface Region {
  tiles: WorldCoord[];
  isMined: boolean;
  firstMiner: EthAddress;
  gold: number;
  souls: number;
  creatures: string[];
  lastSpawnTimestamp: number;
}

export interface Creature {
  species: CreatureSpecies;
  creatureType: CreatureType;
  level: number;
  life: number;
  owner: EthAddress;
  tileCoord: WorldCoord;
}

export interface Settlement {
  owner: EthAddress;
  level: number;
  energy: number;
  lastEnergyUpdateTimestamp: number;
}

export interface HarvestableGroundResources {
  souls: number;
}

export interface TileDelayedAction {
  coord: WorldCoord;
  initiator: EthAddress;
  delayedActionType: TileDelayedActionType;
  submittedTimestamp: number;
}

export interface WorldCoord {
  x: number;
  y: number;
}

export interface TileCoords {
  x: number;
  y: number;
  __value__: never;
}

export interface RegionCoords {
  x: number;
  y: number;
  __value__: never;
}

export interface Rectangle {
  topLeft: WorldCoord;
  sideLength: number;
}

export interface Area {
  tileX: number;
  tileY: number;
  width: number;
  height: number;
}

export interface Player {
  isInitialized: boolean;
  player: EthAddress;
  initTimestamp: number;
  maxGold: number;
  maxSouls: number;
  maxPopulation: number;
  gold: number;
  souls: number;
  population: number;
  mana: number;
  lastManaUpdateTimestamp: number;
}

export interface Rectangle {
  topLeft: WorldCoord;
  sideLength: number;
}

export enum TxType {
  MineTile = "MineTile",
  MineResourceTile = "MineResourceTile",
  UpgradeTile = "UpgradeTile",
  UpgradeSettlement = "UpgradeSettlement",
  CreateSettlement = "CreateSettlement",
  InitializePlayer = "InitializePlayer",
  HarvestTiles = "HarvestTiles",
  WallTile = "WallTile",
  CompleteWallTile = "CompleteWallTile",
  InitiateUnwallTile = "InitiateUnwallTile",
  CompleteUnwallTile = "CompleteUnwallTile",
  InitiateForceMineTile = "InitiateForceMineTile",
  CompleteForceMineTile = "CompleteForceMineTile",
  ClaimResourcesOnRegion = "ClaimResourcesOnRegion",
  SpawnCreature = "SpawnCreature",
  MoveCreatures = "MoveCreatures",
  ClaimDungeonHeart = "ClaimDungeonHeart",
}
// events
export enum NetworkEvent {
  BlockNumberChanged = "BlockNumberChanged",
  ChainTimeChanged = "ChainTimeChanged",
  PredictedChainTimeChanged = "PredictedChainTimeChanged",
}
export enum DungeonEvent {
  LoadingLog = "LoadingLog",
  LoadingStage = "LoadingStageCompleted",
  PlayerInitialized = "DungeonPlayerInitialized",
  PlayerUpdated = "DungeonPlayerUpdated",
  TileMined = "DungeonTileMined",
  RegionMined = "DungeonRegionMined",
  RegionUpdated = "DungeonRegionUpdated",
  SettlementUpdated = "SettlementUpdated",
  TileClaimed = "DungeonTileClaimed",
  TileUpgraded = "DungeonTileUpgraded",
  TileHarvestableGroundResourcesUpdated = "DungeonTileHarvestableGroundResourcesUpdated",
  TileLastHarvestTimestampUpdated = "DungeonTileLastHarvestTimestampUpdated",
  TileDelayedActionInitiated = "DungeonTileDelayedActionInitiated",
  TileDelayedActionCompleted = "DungeonTileDelayedActionCompleted",
  TileWalled = "DungeonTileWalled",
  TileUnwalled = "DungeonTileUnwalled",
  PlayerInfluenceInRegionUpdated = "DungeonPlayerInfluenceInRegionUpdated",
  DungeonHeartClaimed = "DungeonDungeonHeartClaimed",
  CreatureMovedToRegion = "DungeonCreatureMovedToRegion",
  CreatureUpdated = "DungeonCreatureUpdated",
  CreatureDied = "DungeonCreatureDied",
  Combat = "DungeonCombat",
  RegionControllerChanged = "RegionControllerChanged",
}

export enum ExplorerEvent {
  PerlinExplored = "PerlinExplored",
}

export enum GameManagerEvent {
  MineTileScheduled = "MineTileScheduled",
  MineTileStarted = "MineTileStarted",
  MineTileProofDone = "MineTileProofDone",
  MineTileTXSubmitted = "MineTileTXSubmitted",
  MineTileTXSubmitting = "MineTileTXSubmitting",
  MineTileTXConfirmed = "MineTileTXConfirmed",
  MineTileCancelled = "MineTileCancelled",
  MineTileFailed = "MineTileFailed",

  UpgradeTileScheduled = "UpgradeTileScheduled",
  UpgradeTileStarted = "UpgradeTileStarted",
  UpgradeTileTXSubmitting = "UpgradeTileTXSubmitting",
  UpgradeTileTXSubmitted = "UpgradeTileTXSubmitted",
  UpgradeTileTXConfirmed = "UpgradeTileTXConfirmed",
  UpgradeTileCancelled = "UpgradeTileCancelled",
  UpgradeTileFailed = "UpgradeTileFailed",

  RemoveUpgradeScheduled = "RemoveUpgradeScheduled",
  RemoveUpgradeStarted = "RemoveUpgradeStarted",
  RemoveUpgradeTXSubmitting = "RemoveUpgradeTXSubmitting",
  RemoveUpgradeTXSubmitted = "RemoveUpgradeTXSubmitted",
  RemoveUpgradeTXConfirmed = "RemoveUpgradeTXConfirmed",
  RemoveUpgradeCancelled = "RemoveUpgradeCancelled",
  RemoveUpgradeFailed = "RemoveUpgradeFailed",

  RemoveWallScheduled = "RemoveWallScheduled",
  RemoveWallStarted = "RemoveWallStarted",
  RemoveWallTXSubmitting = "RemoveWallTXSubmitting",
  RemoveWallTXSubmitted = "RemoveWallTXSubmitted",
  RemoveWallTXConfirmed = "RemoveWallTXConfirmed",
  RemoveWallCancelled = "RemoveWallCancelled",
  RemoveWallFailed = "RemoveWallFailed",

  UpgradeSettlementScheduled = "UpgradeSettlementScheduled",
  UpgradeSettlementStarted = "UpgradeSettlementStarted",
  UpgradeSettlementTXSubmitting = "UpgradeSettlementTXSubmitting",
  UpgradeSettlementTXSubmitted = "UpgradeSettlementTXSubmitted",
  UpgradeSettlementTXConfirmed = "UpgradeSettlementTXConfirmed",
  UpgradeSettlementCancelled = "UpgradeSettlementCancelled",
  UpgradeSettlementFailed = "UpgradeSettlementFailed",

  CreateSettlementScheduled = "CreateSettlementScheduled",
  CreateSettlementStarted = "CreateSettlementStarted",
  CreateSettlementTXSubmitting = "CreateSettlementTXSubmitting",
  CreateSettlementTXSubmitted = "CreateSettlementTXSubmitted",
  CreateSettlementTXConfirmed = "CreateSettlementTXConfirmed",
  CreateSettlementCancelled = "CreateSettlementCancelled",
  CreateSettlementFailed = "CreateSettlementFailed",

  DestroySettlementScheduled = "DestroySettlementScheduled",
  DestroySettlementStarted = "DestroySettlementStarted",
  DestroySettlementTXSubmitting = "DestroySettlementTXSubmitting",
  DestroySettlementTXSubmitted = "DestroySettlementTXSubmitted",
  DestroySettlementTXConfirmed = "DestroySettlementTXConfirmed",
  DestroySettlementCancelled = "DestroySettlementCancelled",
  DestroySettlementFailed = "DestroySettlementFailed",

  HarvestTilesScheduled = "HarvestTilesScheduled",
  HarvestTilesStarted = "HarvestTilesStarted",
  HarvestTilesProofDone = "HarvestTilesStarted",
  HarvestTilesTXSubmitting = "HarvestTilesTXSubmitting",
  HarvestTilesTXSubmitted = "HarvestTilesTXSubmitted",
  HarvestTilesTXConfirmed = "HarvestTilesTXConfirmed",
  HarvestTilesCancelled = "HarvestTilesCancelled",
  HarvestTilesFailed = "HarvestTilesFailed",

  WallTileScheduled = "WallTileScheduled",
  WallTileStarted = "WallTileStarted",
  WallTileTXSubmitting = "WallTileTXSubmitting",
  WallTileTXSubmitted = "WallTileTXSubmitted",
  WallTileTXConfirmed = "WallTileTXConfirmed",
  WallTileCancelled = "WallTileCancelled",
  WallTileFailed = "WallTileFailed",

  UnwallTileScheduled = "UnwallTileScheduled",
  UnwallTileStarted = "UnwallTileStarted",
  UnwallTileProofDone = "UnwallTileStarted",
  UnwallTileTXSubmitting = "UnwallTileTXSubmitting",
  UnwallTileTXSubmitted = "UnwallTileTXSubmitted",
  UnwallTileTXConfirmed = "UnwallTileTXConfirmed",
  UnwallTileCancelled = "UnwallTileCancelled",
  UnwallTileFailed = "UnwallTileFailed",

  ForceMineTileScheduled = "ForceMineTileScheduled",
  ForceMineTileStarted = "ForceMineTileStarted",
  ForceMineTileProofDone = "ForceMineTileStarted",
  ForceMineTileTXSubmitting = "ForceMineTileTXSubmitting",
  ForceMineTileTXSubmitted = "ForceMineTileTXSubmitted",
  ForceMineTileTXConfirmed = "ForceMineTileTXConfirmed",
  ForceMineTileCancelled = "ForceMineTileCancelled",
  ForceMineTileFailed = "ForceMineTileFailed",

  InitializeStarted = "InitializeStarted",
  InitializeProofDone = "InitializeProofDone",
  InitializeTXSubmitted = "InitializeTXSubmitted",
  InitializeTXConfirmed = "InitiliazeTXConfirmed",
  InitializeError = "InitializeError",

  ClaimResourcesScheduled = "ClaimResourcesScheduled",
  ClaimResourcesStarted = "ClaimResourcesStarted",
  ClaimResourcesTXSubmitting = "ClaimResourcesTXSubmitting",
  ClaimResourcesTXSubmitted = "ClaimResourcesTXSubmitted",
  ClaimResourcesTXConfirmed = "ClaimResourcesTXConfirmed",
  ClaimResourcesCancelled = "ForceMineTileCancelled",
  ClaimResourcesFailed = "ClaimResourcesFailed",

  SpawnCreatureScheduled = "SpawnCreatureScheduled",
  SpawnCreatureStarted = "SpawnCreatureStarted",
  SpawnCreatureTXSubmitting = "SpawnCreatureTXSubmitting",
  SpawnCreatureTXSubmitted = "SpawnCreatureTXSubmitted",
  SpawnCreatureTXConfirmed = "SpawnCreatureTXConfirmed",
  SpawnCreatureCancelled = "ForceMineTileCancelled",
  SpawnCreatureFailed = "SpawnCreatureFailed",

  MoveCreaturesScheduled = "MoveCreaturesScheduled",
  MoveCreaturesStarted = "MoveCreaturesStarted",
  MoveCreaturesProofDone = "MoveCreaturesStarted",
  MoveCreaturesTXSubmitting = "MoveCreaturesTXSubmitting",
  MoveCreaturesTXSubmitted = "MoveCreaturesTXSubmitted",
  MoveCreaturesTXConfirmed = "MoveCreaturesTXConfirmed",
  MoveCreaturesCancelled = "MoveCreaturesCancelled",
  MoveCreaturesFailed = "MoveCreaturesFailed",

  ClaimDungeonHeartScheduled = "ClaimDungeonHeartScheduled",
  ClaimDungeonHeartStarted = "ClaimDungeonHeartStarted",
  ClaimDungeonHeartTXSubmitting = "ClaimDungeonHeartTXSubmitting",
  ClaimDungeonHeartTXSubmitted = "ClaimDungeonHeartTXSubmitted",
  ClaimDungeonHeartTXConfirmed = "ClaimDungeonHeartTXConfirmed",
  ClaimDungeonHeartCancelled = "ClaimDungeonHeartCancelled",
  ClaimDungeonHeartFailed = "ClaimDungeonHeartFailed",
}

export enum NotificationManagerEvent {
  JumpToCoord = "JumpToCoord",
}

export enum BankEvent {
  DripRequested = "DripRequested",
  DripReceived = "DripReceived",
}

export enum TxExecutorEvent {
  TxScheduled = "TxScheduled",
  TxSubmitting = "TxSubmitting",
  TxSubmitted = "TxSubmitted",
  TxConfirmed = "TxConfirmed",
}

export enum SnarkEvent {
  Scheduled = "SnarkScheduled",
  Proving = "SnarkProving",
  Done = "SnarkDone",
}

export enum ActionState {
  Created = "created",
  Queued = "planned",
  Scheduled = "scheduled",
  Processing = "processing",
  Done = "done",
  Failed = "failed",
  Cancelled = "cancelled",
}

export enum ActionType {
  Meta = "Meta",
  MineTile = "MineTile",
  InitPlayer = "InitPlayer",
  UpgradeTile = "UpgradeTile",
  RemoveUpgrade = "RemoveUpgrade",
  RemoveWall = "RemoveWall",
  HarvestTiles = "HarvestTiles",
  UpgradeSettlement = "UpgradeSettlement",
  CreateSettlement = "CreateSettlement",
  DestroySettlement = "DestroySettlement",
  WallTile = "WallTile",
  InitiateUnwallTile = "InitiateUnwallTile",
  CompleteUnwallTile = "CompleteUnwallTile",
  InitiateForceMineTile = "InitiateForceMineTile",
  CompleteForceMineTile = "CompleteForceMineTile",
  ClaimResources = "ClaimResources",
  SpawnCreature = "SpawnCreature",
  MoveCreatures = "MoveCreatures",
  ClaimDungeonHeart = "ClaimDungeonHeart",
}

export enum DelayedActionState {
  Initiate = "Initiate",
  Complete = "Complete",
}
export enum UIEvent {
  EnterReact = "EnterReact",
  LeaveReact = "LeaveReact",
  JumpToCoord = "JumpToCoord",
  SendUpgradeMessage = "SendUpgradeMessage",
  SendSingleActionMessage = "SendSingleActionMessage",
  SendCameraMessage = "SendCameraMessage",
  JumpToCameraGroup = "JumpToCameraGroup",
}

export enum Tool {
  MineTile = "MineTile",
  Interact = "Interact",
  Upgrade = "Upgrade",
}

export enum CreatureMovement {
  RickClickToMove = "RickClickToMove",
  StartMultiCreatureMove = "StartMultiCreatureMove",
  DoMultiCreatureMove = "DoMultiCreatureMove",
  CompleteMultiCreatureMove = "CompleteMultiCreatureMove",
}

export enum UpgradeItem {
  // acts like an upgrade tool but is not an upgrade
  Wall = "Wall",
  GoldStorage = "GoldStorage",
  GoldGenerator = "GoldGenerator",
  SoulStorage = "SoulStorage",
  SoulGenerator = "SoulGenerator",
  Lair = "Lair",
  TrainingRoom = "TrainingRoom",
}

export interface MovingAverages {
  touchProof: MovingAverage;
  specialRegionProof: MovingAverage;
  pathProof: MovingAverage;
  txSubmit: MovingAverage;
  txConfirm: MovingAverage;
}

export type InfluenceData = Map<EthAddress, number>;

export enum GameScene {
  Loading = "Loading",
  Initialize = "Initialize",
  Main = "Main",
}

export interface PerlinValues {
  gold: number;
  soul: number;
}

export enum ResourceType {
  Gold = "Gold",
  Soul = "Soul",
  Population = "Population",
  Dai = "Dai",
  Mana = "Mana",
  Energy = "Energy",
}

export enum ImpWorkType {
  MINE,
  UPGRADE,
}
