import {
  DungeonFacetEvent,
  CreaturesFacetEvent,
  PlayerInitializedParams,
  PlayerUpdatedParams,
  TileMinedParams,
  RegionMinedParams,
  RegionUpdatedParams,
  TileClaimedParams,
  TileUpgradedParams,
  TileLastHarvestTimestampUpdatedParams,
  TileHarvestableGroundResourcesUpdatedParams,
  TileDelayedActionInitiatedParams,
  TileDelayedActionCompletedParams,
  TileWalledParams,
  TileUnwalledParams,
  PlayerInfluenceInRegionUpdatedParams,
  DungeonHeartClaimedParams,
  CreatureMovedToRegionParams,
  CreatureDiedParams,
  CreatureUpdatedParams,
  CombatParams,
} from "../../_types/ContractTypes";
import {
  Player,
  RegionId,
  Tile,
  Region,
  HarvestableGroundResources,
  TileDelayedAction,
  EthAddress,
  Creature,
  DungeonEvent,
  WorldCoord,
} from "../../_types/GlobalTypes";
import { CombatTrace, CombatWinner } from "@latticexyz/ember-combat";

export enum DungeonLoadingStage {
  TILES,
  PLAYERS,
  REGIONS,
  CREATURES,
  DELAYED_ACTIONS,
  HARVESTABLE_GROUND_RESOURCES,
  INFLUENCES,
  DONE,
}

export interface DungeonEvents {
  [DungeonEvent.LoadingLog]: (log: string, subLog?: boolean) => void;
  [DungeonEvent.LoadingStage]: (loadingStage: DungeonLoadingStage) => void;
  [DungeonEvent.PlayerInitialized]: (player: Player, regionCoord: WorldCoord) => void;
  [DungeonEvent.PlayerUpdated]: (player: Player) => void;
  [DungeonEvent.TileMined]: (tile: Tile, tileCoord: WorldCoord, miner: EthAddress) => void;
  [DungeonEvent.RegionMined]: (region: Region, regionCoord: WorldCoord) => void;
  [DungeonEvent.RegionUpdated]: (region: Region, regionCoord: WorldCoord) => void;
  [DungeonEvent.TileClaimed]: (tile: Tile, tileCoord: WorldCoord) => void;
  [DungeonEvent.TileUpgraded]: (tile: Tile, tileCoord: WorldCoord) => void;
  [DungeonEvent.TileHarvestableGroundResourcesUpdated]: (
    harvestableGroundResources: HarvestableGroundResources,
    tileCoord: WorldCoord
  ) => void;

  [DungeonEvent.TileLastHarvestTimestampUpdated]: (lastHarvestTimestamp: number, tileCoord: WorldCoord) => void;
  [DungeonEvent.TileDelayedActionInitiated]: (delayedAction: TileDelayedAction) => void;
  [DungeonEvent.TileDelayedActionCompleted]: (delayedAction: TileDelayedAction) => void;
  [DungeonEvent.TileWalled]: (tile: Tile, tileCoord: WorldCoord) => void;
  [DungeonEvent.TileUnwalled]: (tile: Tile, tileCoord: WorldCoord) => void;
  [DungeonEvent.PlayerInfluenceInRegionUpdated]: (player: EthAddress, regionCoord: WorldCoord, amount: number) => void;
  [DungeonEvent.DungeonHeartClaimed]: (
    regionCoord: WorldCoord,
    previousOwner: EthAddress,
    newOwner: EthAddress
  ) => void;

  [DungeonEvent.CreatureMovedToRegion]: (creatureId: string, creature: Creature, tileCoord: WorldCoord) => void;
  [DungeonEvent.CreatureUpdated]: (creatureId: string, creature: Creature, tileCoord: WorldCoord) => void;
  [DungeonEvent.CreatureDied]: (creatureId: string) => void;
  [DungeonEvent.Combat]: (
    squad1: Creature[],
    squad2: Creature[],
    trace: CombatTrace,
    winner: CombatWinner,
    soulsDropped: number,
    regionCoord: WorldCoord,
    txHash: string
  ) => void;
  [DungeonEvent.RegionControllerChanged]: (
    regionCoord: WorldCoord,
    oldController: EthAddress,
    newController: EthAddress
  ) => void;
}

export type ContractEventHandler<T> = (eventParams: T, txHash?: string, logIndex?: number) => void | Promise<void>;

export interface DungeonFacetEventHandlers {
  [DungeonFacetEvent.PlayerInitialized]: ContractEventHandler<PlayerInitializedParams>;
  [DungeonFacetEvent.PlayerUpdated]: ContractEventHandler<PlayerUpdatedParams>;
  [DungeonFacetEvent.TileMined]: ContractEventHandler<TileMinedParams>;
  [DungeonFacetEvent.RegionMined]: ContractEventHandler<RegionMinedParams>;
  [DungeonFacetEvent.RegionUpdated]: ContractEventHandler<RegionUpdatedParams>;
  [DungeonFacetEvent.TileClaimed]: ContractEventHandler<TileClaimedParams>;
  [DungeonFacetEvent.TileUpgraded]: ContractEventHandler<TileUpgradedParams>;
  [DungeonFacetEvent.TileLastHarvestTimestampUpdated]: ContractEventHandler<TileLastHarvestTimestampUpdatedParams>;
  [DungeonFacetEvent.TileHarvestableGroundResourcesUpdated]: ContractEventHandler<TileHarvestableGroundResourcesUpdatedParams>;
  [DungeonFacetEvent.TileDelayedActionInitiated]: ContractEventHandler<TileDelayedActionInitiatedParams>;
  [DungeonFacetEvent.TileDelayedActionCompleted]: ContractEventHandler<TileDelayedActionCompletedParams>;
  [DungeonFacetEvent.TileWalled]: ContractEventHandler<TileWalledParams>;
  [DungeonFacetEvent.TileUnwalled]: ContractEventHandler<TileUnwalledParams>;
  [DungeonFacetEvent.PlayerInfluenceInRegionUpdated]: ContractEventHandler<PlayerInfluenceInRegionUpdatedParams>;
  [DungeonFacetEvent.DungeonHeartClaimed]: ContractEventHandler<DungeonHeartClaimedParams>;
}

export interface CreatureFacetEventHandlers {
  [CreaturesFacetEvent.CreatureMovedToRegion]: ContractEventHandler<CreatureMovedToRegionParams>;
  [CreaturesFacetEvent.CreatureDied]: ContractEventHandler<CreatureDiedParams>;
  [CreaturesFacetEvent.CreatureUpdated]: ContractEventHandler<CreatureUpdatedParams>;
  [CreaturesFacetEvent.Combat]: ContractEventHandler<CombatParams>;
}
