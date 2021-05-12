import { BigNumberish, BigNumber } from "@ethersproject/bignumber";
import {
  Region,
  Tile,
  Player,
  TileDelayedAction,
  HarvestableGroundResources,
  InfluenceData,
  EthAddress,
  Creature,
} from "../../_types/GlobalTypes";
import { CheckedTypeUtils } from "./CheckedTypeUtils";
import { CreatureSpecies, CreatureType } from "../../_types/ContractTypes";
import { idToCoord } from "./PackedCoords";

export function TileFromContractData({
  owner,
  lastHarvestTimestamp,
  isMined,
  isWalled,
  upgrade,
  touchable,
}: {
  owner: string;
  lastHarvestTimestamp: number;
  isMined: boolean;
  isWalled: boolean;
  upgrade: number;
  touchable: boolean;
}): Tile {
  return {
    owner: CheckedTypeUtils.address(owner),
    lastHarvestTimestamp,
    touchable,
    upgrade,
    isMined,
    isWalled,
  };
}

export function RegionFromContractData({
  tiles,
  isMined,
  firstMiner,
  gold,
  souls,
  creatures,
  lastSpawnTimestamp,
}: {
  tiles: BigNumberish[];
  isMined: boolean;
  firstMiner: string;
  gold: BigNumber;
  souls: BigNumber;
  creatures: BigNumberish[];
  lastSpawnTimestamp: number;
}): Region {
  return {
    firstMiner: CheckedTypeUtils.address(firstMiner),
    tiles: tiles.map((t) => idToCoord(t)),
    gold: gold.toNumber(),
    souls: souls.toNumber(),
    isMined,
    creatures: creatures.map((c) => c.toString()),
    lastSpawnTimestamp,
  };
}

export function CreatureFromContractData({
  species,
  creatureType,
  level,
  life,
  owner,
  tileId,
}: {
  species: CreatureSpecies;
  creatureType: CreatureType;
  level: BigNumber;
  life: BigNumber;
  owner: string;
  tileId: BigNumber;
}): Creature {
  return {
    species,
    creatureType,
    level: level.toNumber(),
    life: life.toNumber(),
    owner: CheckedTypeUtils.address(owner),
    tileCoord: idToCoord(tileId),
  };
}

export function PlayerFromContractData({
  isInitialized,
  player,
  initTimestamp,
  gold,
  souls,
  population,
  mana,
  lastManaUpdateTimestamp,
  maxGold,
  maxSouls,
  maxPopulation,
}: {
  isInitialized: boolean;
  player: string;
  initTimestamp: BigNumber;
  gold: BigNumber;
  souls: BigNumber;
  population: BigNumber;
  mana: BigNumber;
  lastManaUpdateTimestamp: BigNumber;
  maxGold: BigNumber;
  maxSouls: BigNumber;
  maxPopulation: BigNumber;
}): Player {
  return {
    isInitialized,
    player: CheckedTypeUtils.address(player),
    initTimestamp: initTimestamp.toNumber(),
    gold: gold.toNumber(),
    souls: souls.toNumber(),
    population: population.toNumber(),
    mana: mana.toNumber(),
    lastManaUpdateTimestamp: lastManaUpdateTimestamp.toNumber(),
    maxGold: maxGold.toNumber(),
    maxSouls: maxSouls.toNumber(),
    maxPopulation: maxPopulation.toNumber(),
  };
}

export function DelayedActionFromContractData({
  tileId,
  initiator,
  delayedActionType,
  submittedTimestamp,
}: {
  tileId: BigNumber;
  initiator: string;
  delayedActionType: number;
  submittedTimestamp: number;
}): TileDelayedAction {
  return {
    coord: idToCoord(tileId),
    initiator: CheckedTypeUtils.address(initiator),
    submittedTimestamp,
    delayedActionType,
  };
}

export function HarvestableGroundResourcesFromContractData({
  souls,
}: {
  souls: BigNumber;
}): HarvestableGroundResources {
  return {
    souls: souls.toNumber(),
  };
}

export function InfluenceDataFromContractData({
  players,
  influences,
}: {
  players: string[];
  influences: BigNumber[];
}): InfluenceData {
  const influenceData = new Map<EthAddress, number>();

  for (let i = 0; i < players.length; i++) {
    const influence = influences[i].toNumber();
    influenceData.set(CheckedTypeUtils.address(players[i]), influence);
  }

  return influenceData;
}
