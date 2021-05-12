import { BigNumber } from "ethers";
import { RoundTrace, CombatWinner } from "@latticexyz/ember-combat";

export enum DungeonFacetEvent {
  PlayerInitialized = "PlayerInitialized",
  TileMined = "TileMined",
  RegionMined = "RegionMined",
  RegionUpdated = "RegionUpdated",
  TileClaimed = "TileClaimed",
  TileUpgraded = "TileUpgraded",
  PlayerUpdated = "PlayerUpdated",
  TileLastHarvestTimestampUpdated = "TileLastHarvestTimestampUpdated",
  TileHarvestableGroundResourcesUpdated = "TileHarvestableGroundResourcesUpdated",
  TileDelayedActionInitiated = "TileDelayedActionInitiated",
  TileDelayedActionCompleted = "TileDelayedActionCompleted",
  TileWalled = "TileWalled",
  TileUnwalled = "TileUnwalled",
  PlayerInfluenceInRegionUpdated = "PlayerInfluenceInRegionUpdated",
  DungeonHeartClaimed = "DungeonHeartClaimed",
}

export enum ViewportObjectManagerEvent {
  ViewportObjectSpawned = "ViewportObjectSpawned",
  ViewportObjectDespawned = "ViewportObjectDespawned",
}

export enum CreaturesFacetEvent {
  CreatureMovedToRegion = "CreatureMovedToRegion",
  CreatureDied = "CreatureDied",
  CreatureUpdated = "CreatureUpdated",
  Combat = "Combat",
}

export enum TileUpgrade {
  NONE = 0,
  DUNGEON_HEART = 1,
  GOLD_GENERATOR = 2,
  GOLD_STORAGE = 3,
  SOUL_GENERATOR = 4,
  SOUL_STORAGE = 5,
  LAIR = 6,
}

export enum TileDelayedActionType {
  WALL = 0,
  UNWALL = 1,
  FORCE_MINE = 2,
}

export enum CreatureSpecies {
  BALANCED,
}

export enum CreatureType {
  NORMAL,
  RED,
  BLUE,
  BLACK,
  UNIQUE,
}

export enum CreatureStat {
  ATK,
  LIFE,
}

export enum Resource {
  GOLD,
  SOULS,
}

export enum ActionType {
  MINE,
  CLAIM,
  UPGRADE
}

export interface Creature {
  species: CreatureSpecies;
  creatureType: CreatureType;
  level: BigNumber;
  life: BigNumber;
  owner: string;
  tileId: BigNumber;
}

export interface PlayerInitializedParams {
  player: string;
  data: any; //TODO: type those as well, will need to type the decoders
  region: BigNumber;
}

export interface PlayerUpdatedParams {
  player: string;
  data: any; //TODO: type those as well, will need to type the decoders
}

export interface TileMinedParams {
  tile: BigNumber;
  touchable: boolean;
  miner: string;
}

export interface RegionMinedParams {
  region: BigNumber;
  miner: string;
}

export interface RegionUpdatedParams {
  region: BigNumber;
  data: any;
}

export interface TileClaimedParams {
  tile: BigNumber;
  player: string;
}

export interface TileUpgradedParams {
  tile: BigNumber;
  upgrade: number;
}

export interface PlayerInfluenceInRegionUpdatedParams {
  player: string;
  region: BigNumber;
  amount: BigNumber;
}

export interface TileLastHarvestTimestampUpdatedParams {
  tile: BigNumber;
  timestamp: number;
}

export interface TileHarvestableGroundResourcesUpdatedParams {
  tile: BigNumber;
  data: any; //TODO: type this
}

export interface TileDelayedActionInitiatedParams {
  delayedAction: any; //TODO: type this
}

export interface TileDelayedActionCompletedParams {
  delayedAction: any; //TODO: type this
}

export interface TileWalledParams {
  tile: BigNumber;
}

export interface TileUnwalledParams {
  tile: BigNumber;
}

export interface DungeonHeartClaimedParams {
  region: BigNumber;
  previousOwner: string;
  newOwner: string;
}

export interface CreatureMovedToRegionParams {
  creatureId: BigNumber;
  data: any; //TODO: type this
  fromRegionId: BigNumber;
  toRegionId: BigNumber;
}

export interface CreatureDiedParams {
  creatureId: BigNumber;
  regionId: BigNumber;
}

export interface CreatureUpdatedParams {
  creatureId: BigNumber;
  regionId: BigNumber;
  data: any; //TODO: type this
}

export interface CombatParams {
  squad1: Creature[];
  squad2: Creature[];
  trace: RoundTrace[];
  winner: CombatWinner;
  soulsDropped: BigNumber;
  regionId: BigNumber;
}
