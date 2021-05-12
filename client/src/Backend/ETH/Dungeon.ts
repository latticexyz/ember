import { EventEmitter } from "events";
import { BigNumber as EthersBN, ContractFunction, BigNumberish, BigNumber } from "ethers";
import anylogger, { Logger, BaseLevels } from "anylogger";
import { CheckedTypeUtils } from "../Utils/CheckedTypeUtils";
import {
  aggregateBulkGetter,
  callWithRetry,
  createStrictEventEmitterClass,
  tileCoordToRegionCoord,
  regionCoordToCenterTileCoords,
  regionCoordToTileCoord,
} from "../Utils/Utils";
import { ThrottledConcurrentQueue } from "../Utils/ThrottledConcurrentQueue";
import {
  EthAddress,
  Player,
  Region,
  Tile,
  TileDelayedAction,
  HarvestableGroundResources,
  InfluenceData,
  Creature,
  WorldCoord,
  DungeonEvent,
  TxType,
} from "../../_types/GlobalTypes";
import {
  RegionFromContractData,
  TileFromContractData,
  PlayerFromContractData,
  DelayedActionFromContractData,
  HarvestableGroundResourcesFromContractData,
  InfluenceDataFromContractData,
  CreatureFromContractData,
} from "../Utils/Decoders";
import {
  DungeonFacetEvent,
  TileUpgrade,
  CreatureSpecies,
  CreaturesFacetEvent,
  TileDelayedActionType,
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
import { makeObservable, observable, action, toJS, computed } from "mobx";
import Constants from "../Game/Constants";
import { parseCombatLog } from "../../../../packages/combat/dist";
import { NotificationType, NotificationManager } from "../../Frontend/NotificationManager";
import { DungeonEvents, DungeonFacetEventHandlers, CreatureFacetEventHandlers, DungeonLoadingStage } from "./types";
import { GameContracts } from "./NetworkConfig";
import Network, { NetworkStatus } from "./Network";
import { idToCoord, coordToId } from "../Utils/PackedCoords";
import { CoordMap } from "../../Utils/CoordMap";
import { worldCoordsEq } from "../../Renderer/utils/worldCoords";
import { REGION_LENGTH } from "../Utils/Defaults";
import { Cache, Store } from "../Cache/Cache";
import { getDungeonHeartCacheKey } from "../Cache/utils";
import { UIManager } from "../../Frontend/UIManager";
import { QueueRequestType } from "../Utils/NameQueue";
import GameManager from "../Game/GameManager";

const OBJECT_PER_QUERY_BULK_LOADING = 100;

/**
 * Read only dungeon. Essentially a local copy the AppStorage of the contract
 */
class Dungeon extends createStrictEventEmitterClass<DungeonEvents>() {
  private log: Logger<BaseLevels>;
  public net: Network<GameContracts, TxType>;
  public player: EthAddress;
  public constants: Constants;
  public loaded: boolean;
  private readonly callQueue = new ThrottledConcurrentQueue(10, 1000, 10);

  // storage
  public tiles: CoordMap<Tile>;
  public tileHarvestableGroundResources: CoordMap<HarvestableGroundResources>;
  public regions: CoordMap<Region>;
  public creatures: Map<string, Creature>;
  public players: Map<EthAddress, Player>;
  public influenceDataByRegion: CoordMap<InfluenceData>;

  // delayed action
  public delayedActions: TileDelayedAction[];

  private notificationManager: NotificationManager;

  public constructor(net: Network<GameContracts, TxType>, player: EthAddress, constants: Constants) {
    super();
    this.log = anylogger("dungeon");
    this.constants = constants;
    // remove the dependency on this.player. Hooks for notifications should come from the game manager
    this.loaded = false;
    this.player = player;
    this.net = net;
    this.players = new Map<EthAddress, Player>();
    this.regions = new CoordMap<Region>();
    this.creatures = new Map<string, Creature>();
    this.delayedActions = [];
    this.influenceDataByRegion = new CoordMap<InfluenceData>();
    this.notificationManager = UIManager.getInstance().services.notificationManager;

    // TODO: remove all the very bulky actions and the very bulky wrapped Mobx data structures. They cost a lot of memory overhead.
    makeObservable(this, {
      players: observable,
      regions: observable,
      influenceDataByRegion: observable,
      setRegions: action,
      setRegion: action,
      setPlayers: action,
      setPlayer: action,
      increaseGold: action,
      increaseSouls: action,
      currentMana: computed,
    });
  }

  static async create(net: Network<GameContracts, TxType>, player: EthAddress, constants: Constants): Promise<Dungeon> {
    if (!net.contracts) {
      throw new Error("The Network must first load the contracts");
    }
    const dungeon = new Dungeon(net, player, constants);

    return dungeon;
  }

  get currentMana(): number {
    const player = this.players.get(this.player);
    if (!player) return 0;

    const maxMana = this.constants.gameConstants.MAX_MANA;
    const updatedMana =
      player.mana +
      Math.floor(
        (this.net.predictedChainTime - player.lastManaUpdateTimestamp) /
        this.constants.gameConstants.NUMBER_OF_SECONDS_FOR_ONE_MANA_REGEN

      );

    return updatedMana > maxMana ? maxMana : updatedMana;
  }

  public setPlayers(players: Map<EthAddress, Player>) {
    this.players = players;
  }

  public setPlayer(address: EthAddress, player: Player) {
    this.players.set(address, player);
  }

  public setRegions(regions: CoordMap<Region>) {
    this.regions = regions;
  }

  public setRegion(coord: WorldCoord, region: Region) {
    this.regions.set(coord, region);
  }

  public increaseGold(address: EthAddress, amount: number) {
    const player = this.players.get(address);
    if (!player) return;
    this.players.set(address, { ...player, gold: player.gold + amount });
  }

  public increaseSouls(address: EthAddress, amount: number) {
    const player = this.players.get(address);
    if (!player) return;
    this.players.set(address, { ...player, souls: player.souls + amount });
  }

  private logToEventAndConsole(log: string, subLog?: boolean) {
    this.log.info(log);
    this.emit(DungeonEvent.LoadingLog, log, subLog);
  }

  private createLogPercentageFunction(category: string) {
    return (percentage: number) => this.logPercentage(category, percentage);
  }

  private logPercentage(category: string, percentage) {
    const log = `${category}: ${percentage.toFixed(0)}%`;
    this.logToEventAndConsole(log, true);
  }

  public async load(): Promise<void> {
    if (this.loaded) {
      throw new Error("this dungeon is already loaded!");
    }
    this.setupEventListeners();
    this.logToEventAndConsole("Getting tiles...");
    this.emit(DungeonEvent.LoadingStage, DungeonLoadingStage.TILES);
    this.tiles = await this.getTiles();

    this.logToEventAndConsole("Getting players...");
    this.emit(DungeonEvent.LoadingStage, DungeonLoadingStage.PLAYERS);
    const players = await this.getPlayers();
    this.setPlayers(players);


    this.logToEventAndConsole("Getting regions...");
    this.emit(DungeonEvent.LoadingStage, DungeonLoadingStage.REGIONS);
    const regions = await this.getRegions();
    this.setRegions(regions);

    this.logToEventAndConsole("Getting creatures...");
    this.emit(DungeonEvent.LoadingStage, DungeonLoadingStage.CREATURES);
    this.creatures = await this.getCreatures();

    this.logToEventAndConsole("Getting delayed actions...");
    this.emit(DungeonEvent.LoadingStage, DungeonLoadingStage.DELAYED_ACTIONS);
    this.delayedActions = await this.getDelayedActions();

    this.logToEventAndConsole("Getting harvestable ground resources...");
    this.emit(DungeonEvent.LoadingStage, DungeonLoadingStage.HARVESTABLE_GROUND_RESOURCES);
    this.tileHarvestableGroundResources = await this.getHarvestableGroundResources();

    this.logToEventAndConsole("Getting influences...");
    this.emit(DungeonEvent.LoadingStage, DungeonLoadingStage.INFLUENCES);
    this.influenceDataByRegion = await this.getInfluenceDataByRegions(toJS(this.regions.coords()));

    this.logToEventAndConsole("Done loading");
    this.emit(DungeonEvent.LoadingStage, DungeonLoadingStage.DONE);

    this.loaded = true;

    this.net.setSyncedBlockNumber(this.net.blockNumber);
    this.net.handleEvents();
  }

  private makeCall<T>(contractViewFunction: ContractFunction<T>, args: unknown[] = []): Promise<T> {
    return this.callQueue.add(() => callWithRetry<T>(contractViewFunction, args));
  }

  // All those are processors for event sourcing
  // The change the state based on events received from nodes, either every blog while playing or when replaying events when loading the game

  private processPlayerInitialized({ player: _address, data: _data, region: _regionId }: PlayerInitializedParams) {
    const address = CheckedTypeUtils.address(_address);
    const player: Player = PlayerFromContractData(_data);
    this.setPlayer(address, player);
    const regionCoord = idToCoord(_regionId);
    const cache = Cache.getInstance();
    const cacheKey = getDungeonHeartCacheKey(address, this.net.diamondAddress);
    cache.setItem(Store.DungeonHeartRegions, cacheKey, regionCoord);

    const gm = GameManager.getInstance();
    gm.services.nameQueue.add({
      address,
      reqType: [QueueRequestType.ENS, QueueRequestType.NICKNAME],
    });

    this.emit(DungeonEvent.PlayerInitialized, player, regionCoord);
  }

  private processPlayerUpdated({ player: _address, data: _data }: PlayerUpdatedParams) {
    const address = CheckedTypeUtils.address(_address);
    const player: Player = PlayerFromContractData(_data);
    this.setPlayer(address, player);
    this.emit(DungeonEvent.PlayerUpdated, player);
  }

  private processTileMinedEvent({ tile: _tileId, touchable, miner: _miner }: TileMinedParams) {
    const tile: Tile = {
      owner: CheckedTypeUtils.EMPTY_ADDRESS,
      lastHarvestTimestamp: this.net.predictedChainTime,
      touchable,
      upgrade: TileUpgrade.NONE,
      isMined: true,
      isWalled: false,
    };
    const tileCoord = idToCoord(_tileId);
    const existingTile = this.tiles.has(tileCoord);
    if (!existingTile) {
      this.tiles.set(tileCoord, tile);
    }

    const miner = CheckedTypeUtils.address(_miner);

    // update the region to add the tile
    const regionCoord = tileCoordToRegionCoord(tileCoord);
    const updatedRegion = this.regions.get(regionCoord);
    if (!updatedRegion) {
      const newRegion: Region = {
        firstMiner: miner,
        tiles: [tileCoord],
        gold: 0,
        souls: 0,
        isMined: true,
        creatures: [],
        lastSpawnTimestamp: 0,
      };
      this.setRegion(regionCoord, newRegion);
    } else {
      if (!updatedRegion.tiles.find((t) => worldCoordsEq(t, tileCoord))) {
        updatedRegion.tiles.push(tileCoord);
      }
      this.setRegion(regionCoord, updatedRegion);
    }
    // check the queue for corresponding delayed events
    this.emit(DungeonEvent.TileMined, tile, tileCoord, miner);
  }

  private processRegionMinedEvent({ region: _regionId, miner: _miner }: RegionMinedParams) {
    const firstMiner = CheckedTypeUtils.address(_miner);
    const regionCoord = idToCoord(_regionId);
    const region = this.regions.get(regionCoord);
    if (!region) {
      const newRegion: Region = {
        firstMiner,
        tiles: [],
        gold: 0,
        souls: 0,
        isMined: true,
        creatures: [],
        lastSpawnTimestamp: 0,
      };
      this.setRegion(regionCoord, newRegion);
      this.emit(DungeonEvent.RegionMined, newRegion, regionCoord);
    } else {
      this.emit(DungeonEvent.RegionMined, region, regionCoord);
    }
  }

  private processRegionUpdatedEvent({ region: _regionId, data: _data }: RegionUpdatedParams) {
    const regionCoord = idToCoord(_regionId);
    const region: Region = RegionFromContractData(_data);
    this.setRegion(regionCoord, region);
    // this.log.log("region updatd");
    this.emit(DungeonEvent.RegionUpdated, region, regionCoord);
  }

  private processTileClaimedEvent({ tile: _tileId, player: _player }: TileClaimedParams) {
    const owner = CheckedTypeUtils.address(_player);
    const tileCoord = idToCoord(_tileId);
    const tile = this.tiles.get(tileCoord);
    if (!tile) {
      this.log.error("OOO TileClaimed", tileCoord, owner);
      this.net.setNetworkStatus(NetworkStatus.ERROR);
      return;
    }
    tile.owner = owner;
    this.tiles.set(tileCoord, tile);

    this.emit(DungeonEvent.TileClaimed, tile, tileCoord);
  }

  private processTileUpgradedEvent({ tile: _tileId, upgrade: _upgrade }: TileUpgradedParams) {
    const tileCoord = idToCoord(_tileId);
    const tile = this.tiles.get(tileCoord);
    if (!tile) {
      this.log.error("OOO TileUpgraded", tileCoord, _upgrade);
      this.net.setNetworkStatus(NetworkStatus.ERROR);
      return;
    }
    tile.upgrade = _upgrade;
    this.tiles.set(tileCoord, tile);

    this.emit(DungeonEvent.TileUpgraded, tile, tileCoord);
  }

  private processTileLastHarvestTimestampUpdatedEvent({
    tile: _tileId,
    timestamp: _timestamp,
  }: TileLastHarvestTimestampUpdatedParams) {
    const tileCoord = idToCoord(_tileId);
    const lastHarvestTimestamp: number = _timestamp;
    const tile = this.tiles.get(tileCoord);
    if (!tile) {
      this.log.error("OOO LastHarvestTimestampUpdated", tileCoord, lastHarvestTimestamp);
      this.net.setNetworkStatus(NetworkStatus.ERROR);
      return;
    }
    tile.lastHarvestTimestamp = lastHarvestTimestamp;
    this.tiles.set(tileCoord, tile);
    this.emit(DungeonEvent.TileLastHarvestTimestampUpdated, lastHarvestTimestamp, tileCoord);
  }

  private processTileHarvestableGroundResourceUpdated({
    tile: _tileId,
    data: _data,
  }: TileHarvestableGroundResourcesUpdatedParams) {
    const tileCoord = idToCoord(_tileId);
    const harvestableGroundResources: HarvestableGroundResources = HarvestableGroundResourcesFromContractData(_data);
    this.tileHarvestableGroundResources.set(tileCoord, harvestableGroundResources);
    this.emit(DungeonEvent.TileHarvestableGroundResourcesUpdated, harvestableGroundResources, tileCoord);
  }

  private processTileDelayedActionInitiated({ delayedAction: _delayedAction }: TileDelayedActionInitiatedParams) {
    const delayedAction = DelayedActionFromContractData(_delayedAction);
    this.addDelayedAction(delayedAction);
    this.emit(DungeonEvent.TileDelayedActionInitiated, delayedAction);
  }

  private processTileDelayedActionCompleted({ delayedAction: _delayedAction }: TileDelayedActionCompletedParams) {
    const delayedAction = DelayedActionFromContractData(_delayedAction);
    this.removeDelayedAction(delayedAction);
    this.emit(DungeonEvent.TileDelayedActionCompleted, delayedAction);
  }

  private processTileWalledEvent({ tile: _tileId }: TileWalledParams) {
    const tileCoord = idToCoord(_tileId);
    const tile = this.tiles.get(tileCoord);
    if (!tile) {
      this.log.error("OOO TileWalled", tileCoord);
      this.net.setNetworkStatus(NetworkStatus.ERROR);
      return;
    }
    tile.isWalled = true;
    this.tiles.set(tileCoord, tile);
    this.emit(DungeonEvent.TileWalled, tile, tileCoord);
  }

  private processTileUnwalledEvent({ tile: _tileId }: TileUnwalledParams) {
    const tileCoord = idToCoord(_tileId);
    const tile = this.tiles.get(tileCoord);
    if (!tile) {
      this.log.error("OOO TileUnwalled", tileCoord);
      this.net.setNetworkStatus(NetworkStatus.ERROR);
      return;
    }
    tile.isWalled = false;
    this.tiles.set(tileCoord, tile);
    this.emit(DungeonEvent.TileUnwalled, tile, tileCoord);
  }

  private processPlayerInfluenceInRegionUpdatedEvent({
    player: _player,
    region: _regionId,
    amount: _amount,
  }: PlayerInfluenceInRegionUpdatedParams) {
    const player = CheckedTypeUtils.address(_player);
    const regionCoord = idToCoord(_regionId);
    const amount = _amount.toNumber();
    const currentInfluenceData = this.influenceDataByRegion.get(regionCoord);
    if (!currentInfluenceData) {
      const influenceData: InfluenceData = new Map<EthAddress, number>();
      influenceData.set(player, amount);
      this.influenceDataByRegion.set(regionCoord, influenceData);
    } else {
      currentInfluenceData.set(player, amount);
    }
    this.emit(DungeonEvent.PlayerInfluenceInRegionUpdated, player, regionCoord, amount);
  }

  private processDungeonHeartClaimedEvent({
    region: _regionId,
    previousOwner: _previousOwner,
    newOwner: _newOwner,
  }: DungeonHeartClaimedParams) {
    const regionCoord = idToCoord(_regionId);
    const previousOwner = CheckedTypeUtils.address(_previousOwner);
    const newOwner = CheckedTypeUtils.address(_newOwner);
    this.emit(DungeonEvent.DungeonHeartClaimed, regionCoord, previousOwner, newOwner);
    const topLeftCorner = regionCoordToTileCoord(regionCoord);
    const dhCoord = { x: topLeftCorner.x + REGION_LENGTH / 2, y: topLeftCorner.y + REGION_LENGTH / 2 } as WorldCoord;
    this.notificationManager.notify("A dungeon heart has been claimed", dhCoord, NotificationType.Critical);
  }

  private processCreatureMovedToRegionEvent({
    creatureId: _creatureId,
    data: _data,
    fromRegionId: _fromRegion,
    toRegionId: _toRegion,
  }: CreatureMovedToRegionParams) {
    const creatureId = _creatureId.toString();
    const existingCreature = this.creatures.get(creatureId);

    // Remove creature from potential previous region
    if (existingCreature) {
      const fromRegionCoord = idToCoord(_fromRegion);
      const previousRegion = this.regions.get(fromRegionCoord);
      if (previousRegion) {
        this.regions.set(fromRegionCoord, {
          ...previousRegion,
          creatures: previousRegion.creatures.filter((id) => id !== creatureId),
        });
      } else {
        this.log.error("Could not find previous region of creature");
      }
    }

    const creature = CreatureFromContractData(_data);
    this.creatures.set(creatureId, creature);

    const toRegionCoord = idToCoord(_toRegion);
    const toRegion = this.regions.get(toRegionCoord);

    if (!toRegion) {
      throw new Error("Creature spawned in unknown region");
    }

    this.regions.set(toRegionCoord, { ...toRegion, creatures: [...toRegion.creatures, creatureId] });
    this.emit(DungeonEvent.CreatureMovedToRegion, creatureId, creature, creature.tileCoord);
  }

  private processCreatureDiedEvent({ creatureId: _creatureId, regionId: _regionId }: CreatureDiedParams) {
    const creatureId = _creatureId.toString();
    this.creatures.delete(creatureId);
    const regionCoord = idToCoord(_regionId);
    const region = this.regions.get(regionCoord);
    if (region) {
      this.regions.set(regionCoord, { ...region, creatures: region.creatures.filter((id) => id !== creatureId) });
    } else {
      this.log.error("Creature died in unknown region");
    }
    this.emit(DungeonEvent.CreatureDied, creatureId);
  }

  private processCreatureUpdatedEvent({
    creatureId: _creatureId,
    regionId: _regionId,
    data: _data,
  }: CreatureUpdatedParams) {
    const regionCoord = idToCoord(_regionId);
    const creatureId = _creatureId.toString();
    const creature = CreatureFromContractData(_data);
    this.creatures.set(creatureId, creature);
    this.emit(DungeonEvent.CreatureUpdated, creatureId, creature, regionCoord);
  }

  private processCombatEvent(
    {
      squad1: _squad1,
      squad2: _squad2,
      trace: _trace,
      winner: _winner,
      soulsDropped: _soulsDropped,
      regionId: _regionId,
    }: CombatParams,
    txHash: string
  ) {
    const regionCoord = idToCoord(_regionId);
    const region = this.regions.get(regionCoord);
    if (!region) {
      console.error("Combat in unknown region", regionCoord);
      this.log.error("Combat in unknown region");
      return;
    }
    const squad1 = _squad1.map(CreatureFromContractData);
    const squad2 = _squad2.map(CreatureFromContractData);
    const winner = _winner;
    const trace = parseCombatLog(_squad1, _squad2, _trace);
    const centerTileCoord = regionCoordToCenterTileCoords(regionCoord)[0];
    if (squad1[0].owner === this.player) {
      this.notificationManager.notify("You are attacking enemy creatures", centerTileCoord, NotificationType.Warning);
    } else if (squad2[0].owner === this.player) {
      this.notificationManager.notify("You are being attacked!", centerTileCoord, NotificationType.Warning);
    }
    this.emit(DungeonEvent.Combat, squad1, squad2, trace, winner, _soulsDropped.toNumber(), regionCoord, txHash);
  }

  private getEventHandlers(): {
    dungeonFacetEventHandlers: DungeonFacetEventHandlers;
    creaturesFacetEventHandlers: CreatureFacetEventHandlers;
  } {
    const dungeonFacetEventHandlers: DungeonFacetEventHandlers = {
      [DungeonFacetEvent.PlayerInitialized]: this.processPlayerInitialized.bind(this),
      [DungeonFacetEvent.PlayerUpdated]: this.processPlayerUpdated.bind(this),
      [DungeonFacetEvent.TileMined]: this.processTileMinedEvent.bind(this),
      [DungeonFacetEvent.RegionMined]: this.processRegionMinedEvent.bind(this),
      [DungeonFacetEvent.RegionUpdated]: this.processRegionUpdatedEvent.bind(this),
      [DungeonFacetEvent.TileClaimed]: this.processTileClaimedEvent.bind(this),
      [DungeonFacetEvent.TileUpgraded]: this.processTileUpgradedEvent.bind(this),
      [DungeonFacetEvent.TileLastHarvestTimestampUpdated]: this.processTileLastHarvestTimestampUpdatedEvent.bind(this),
      [DungeonFacetEvent.TileHarvestableGroundResourcesUpdated]:
        this.processTileHarvestableGroundResourceUpdated.bind(this),
      [DungeonFacetEvent.TileDelayedActionInitiated]: this.processTileDelayedActionInitiated.bind(this),
      [DungeonFacetEvent.TileDelayedActionCompleted]: this.processTileDelayedActionCompleted.bind(this),
      [DungeonFacetEvent.TileWalled]: this.processTileWalledEvent.bind(this),
      [DungeonFacetEvent.TileUnwalled]: this.processTileUnwalledEvent.bind(this),
      [DungeonFacetEvent.PlayerInfluenceInRegionUpdated]: this.processPlayerInfluenceInRegionUpdatedEvent.bind(this),
      [DungeonFacetEvent.DungeonHeartClaimed]: this.processDungeonHeartClaimedEvent.bind(this),
    };

    const creaturesFacetEventHandlers: CreatureFacetEventHandlers = {
      [CreaturesFacetEvent.CreatureMovedToRegion]: this.processCreatureMovedToRegionEvent.bind(this),
      [CreaturesFacetEvent.CreatureDied]: this.processCreatureDiedEvent.bind(this),
      [CreaturesFacetEvent.CreatureUpdated]: this.processCreatureUpdatedEvent.bind(this),
      [CreaturesFacetEvent.Combat]: this.processCombatEvent.bind(this),
    };

    return { dungeonFacetEventHandlers, creaturesFacetEventHandlers };
  }

  protected setupEventListeners(): void {
    this.log.info("setting up the event listeners");
    const { dungeonFacet, creaturesFacet } = this.net.contracts;

    const dungeonFacetTopics = [
      [
        dungeonFacet.filters.PlayerInitialized(null, null, null).topics,
        dungeonFacet.filters.PlayerUpdated(null, null).topics,
        dungeonFacet.filters.TileMined(null, null, null).topics,
        dungeonFacet.filters.RegionMined(null, null).topics,
        dungeonFacet.filters.RegionUpdated(null, null).topics,
        dungeonFacet.filters.TileClaimed(null, null).topics,
        dungeonFacet.filters.TileUpgraded(null, null).topics,
        dungeonFacet.filters.TileLastHarvestTimestampUpdated(null, null).topics,
        dungeonFacet.filters.TileHarvestableGroundResourcesUpdated(null, null).topics,
        dungeonFacet.filters.TileDelayedActionInitiated(null).topics,
        dungeonFacet.filters.TileDelayedActionCompleted(null).topics,
        dungeonFacet.filters.TileWalled(null).topics,
        dungeonFacet.filters.TileUnwalled(null).topics,
        dungeonFacet.filters.PlayerInfluenceInRegionUpdated(null, null, null).topics,
        dungeonFacet.filters.DungeonHeartClaimed(null, null, null).topics,
        creaturesFacet.filters.CreatureMovedToRegion(null, null, null, null).topics,
        creaturesFacet.filters.CreatureDied(null, null).topics,
        creaturesFacet.filters.CreatureUpdated(null, null, null).topics,
        creaturesFacet.filters.Combat(null, null, null, null, null, null).topics,
      ].map((topicsOrUndefined) => (topicsOrUndefined || [])[0]),
    ] as Array<Array<string>>;

    const creaturesFacetTopics = [
      [
        creaturesFacet.filters.CreatureMovedToRegion(null, null, null, null).topics,
        creaturesFacet.filters.CreatureDied(null, null).topics,
        creaturesFacet.filters.CreatureUpdated(null, null, null).topics,
        creaturesFacet.filters.Combat(null, null, null, null, null, null).topics,
      ].map((topicsOrUndefined) => (topicsOrUndefined || [])[0]),
    ] as Array<Array<string>>;

    const { dungeonFacetEventHandlers, creaturesFacetEventHandlers } = this.getEventHandlers();

    this.net.subscribeToContractEvents(dungeonFacet, dungeonFacetEventHandlers, dungeonFacetTopics);
    this.net.subscribeToContractEvents(creaturesFacet, creaturesFacetEventHandlers, creaturesFacetTopics);
    // we might not need this in the future
    // TODO: this is executed once per tx in the block
    this.net.contracts.dungeonFacet.on("Time", (_time) => {
      const time = _time.toNumber();
      const t = Math.floor(Date.now() / 1000);
      const diff = this.net.predictedChainTime - time;
      if (diff > 0) {
        this.log.warn("time: client is ahead!!!", diff);
      }
      if (diff < 0) {
        this.log.warn("time: client is behind!!!", diff);
      }
      this.log.debug(
        "time: contract time",
        time,
        "predicted chain time: ",
        this.net.predictedChainTime,
        "diff: ",
        this.net.predictedChainTime - time
      );
    });
  }

  public getContractAddress(): EthAddress {
    return CheckedTypeUtils.address(this.net.diamondAddress);
  }

  public addDelayedAction(delayedAction: TileDelayedAction) {
    // Send notification if someone is mining your wall
    if (delayedAction.delayedActionType === TileDelayedActionType.UNWALL && delayedAction.initiator !== this.player) {
      const tile = this.tiles.get(delayedAction.coord);
      if (tile && tile.isWalled && tile.owner === this.player) {
        this.notificationManager.notify("Someone is mining your wall!", delayedAction.coord, NotificationType.Warning);
      }
    }

    // Add or update delayed action
    const serialize = (d: TileDelayedAction) => `${d.initiator}-${d.delayedActionType}-${d.coord.x}/${d.coord.y}`;
    this.delayedActions = [
      ...this.delayedActions.filter((d) => serialize(d) !== serialize(delayedAction)),
      delayedAction,
    ];
  }

  public removeDelayedAction(delayedAction: TileDelayedAction) {
    const serialize = (d: TileDelayedAction) => `${d.initiator}-${d.delayedActionType}-${d.coord.x}/${d.coord.y}`;
    const prevLength = this.delayedActions.length;
    this.delayedActions = this.delayedActions.filter((d) => serialize(d) !== serialize(delayedAction));
    if (this.delayedActions.length === prevLength) {
      this.log.warn("Delayed action already removed: ", delayedAction);
    }
  }

  private async getPlayers(): Promise<Map<EthAddress, Player>> {
    const nPlayers: number = (await this.makeCall<EthersBN>(this.net.bulkContracts.getterFacet.getNPlayers)).toNumber();

    const players = await aggregateBulkGetter<Player>(
      nPlayers,
      OBJECT_PER_QUERY_BULK_LOADING,
      async (start, end) =>
        (
          await this.makeCall<
            { isInitialized: boolean; player: string; initTimestamp: BigNumber; gold: BigNumber; souls: BigNumber }[]
          >(this.net.bulkContracts.getterFacet.bulkGetPlayers, [start, end])
        ).map(PlayerFromContractData),
      this.createLogPercentageFunction("getting players")
    );

    const playerMap: Map<EthAddress, Player> = new Map();
    for (const player of players) {
      playerMap.set(player.player, player);
    }
    return playerMap;
  }

  private async getTiles(): Promise<CoordMap<Tile>> {
    const nTiles: number = (await this.makeCall<EthersBN>(this.net.bulkContracts.getterFacet.getNTiles)).toNumber();

    const tileCoords: WorldCoord[] = await aggregateBulkGetter<WorldCoord>(
      nTiles,
      OBJECT_PER_QUERY_BULK_LOADING,
      async (start, end) =>
        (
          await this.makeCall<BigNumberish[]>(this.net.bulkContracts.getterFacet.bulkGetTileIds, [start, end])
        ).map((b: BigNumberish) => idToCoord(b)),
      this.createLogPercentageFunction("getting tile coordinates")
    );

    const tiles = await aggregateBulkGetter<Tile>(
      nTiles,
      OBJECT_PER_QUERY_BULK_LOADING,
      async (start, end) =>
        (
          await this.makeCall<
            {
              owner: string;
              isMined: boolean;
              isWalled: boolean;
              upgrade: number;
              touchable: boolean;
            }[]
          >(this.net.bulkContracts.getterFacet.bulkGetTilesByIds, [
            tileCoords.slice(start, end).map((t) => coordToId(t)),
          ])
        ).map(TileFromContractData),
      this.createLogPercentageFunction("getting tiles")
    );

    const tileMap = new CoordMap<Tile>();
    for (const [index, coord] of tileCoords.entries()) {
      tileMap.set(coord, tiles[index]);
    }
    return tileMap;
  }

  private async getRegions(): Promise<CoordMap<Region>> {
    const nRegions: number = (await this.makeCall<EthersBN>(this.net.bulkContracts.getterFacet.getNRegions)).toNumber();

    const regionCoords: WorldCoord[] = await aggregateBulkGetter<WorldCoord>(
      nRegions,
      OBJECT_PER_QUERY_BULK_LOADING,
      async (start, end) =>
        (
          await this.makeCall<BigNumberish[]>(this.net.bulkContracts.getterFacet.bulkGetRegionIds, [start, end])
        ).map((b: BigNumberish) => idToCoord(b)),
      this.createLogPercentageFunction("getting region coordinates")
    );

    const regions = await aggregateBulkGetter<Region>(
      nRegions,
      OBJECT_PER_QUERY_BULK_LOADING,
      async (start, end) =>
        (
          await this.makeCall<
            { firstMiner: string; isMined: boolean; tiles: BigNumberish[]; creatures: BigNumberish[] }[]
          >(this.net.bulkContracts.getterFacet.bulkGetRegionsByIds, [
            regionCoords.slice(start, end).map((t) => coordToId(t)),
          ])
        ).map(RegionFromContractData),
      this.createLogPercentageFunction("getting regions")
    );

    const regionMap = new CoordMap<Region>();

    for (const [index, regionCoord] of regionCoords.entries()) {
      regionMap.set(regionCoord, regions[index]);
    }
    return regionMap;
  }

  private async getCreatures(): Promise<Map<string, Creature>> {
    const creatureIds: string[] = [];

    for (const region of this.regions.values()) {
      creatureIds.push(...region.creatures);
    }

    const creatures = await aggregateBulkGetter<Creature>(
      creatureIds.length,
      OBJECT_PER_QUERY_BULK_LOADING,
      async (start, end) =>
        (
          await this.makeCall<{ species: CreatureSpecies; owner: string; tileId: BigNumberish }[]>(
            this.net.bulkContracts.getterFacet.bulkGetCreaturesByIds,
            [creatureIds.slice(start, end).map((t) => BigNumber.from(t))]
          )
        ).map(CreatureFromContractData),
      this.createLogPercentageFunction("getting creatures")
    );

    const creatureMap: Map<string, Creature> = new Map();
    for (const [index, creatureId] of creatureIds.entries()) {
      creatureMap.set(creatureId, creatures[index]);
    }

    return creatureMap;
  }

  private async getDelayedActions(): Promise<TileDelayedAction[]> {
    const nTilesWithDelayedActions: number = (
      await this.makeCall<EthersBN>(this.net.bulkContracts.getterFacet.getNTilesWithDelayedActions)
    ).toNumber();

    const tilesWithDelayedActions: WorldCoord[] = await aggregateBulkGetter<WorldCoord>(
      nTilesWithDelayedActions,
      OBJECT_PER_QUERY_BULK_LOADING,
      async (start, end) =>
        (
          await this.makeCall<BigNumberish[]>(this.net.bulkContracts.getterFacet.bulkGetTilesWithDelayedActions, [
            start,
            end,
          ])
        ).map((b: BigNumberish) => idToCoord(b)),
      this.createLogPercentageFunction("getting tiles with delayed actions")
    );

    const delayedActions = await aggregateBulkGetter<TileDelayedAction>(
      nTilesWithDelayedActions,
      OBJECT_PER_QUERY_BULK_LOADING,
      async (start, end) =>
        (
          await this.makeCall<
            { tileId: BigNumber; initiator: string; delayedActionType: number; submittedTimestamp: number }[]
          >(this.net.bulkContracts.getterFacet.bulkGetTileDelayedActionsByTileIds, [
            tilesWithDelayedActions.slice(start, end).map((t) => coordToId(t)),
          ])
        ).map(DelayedActionFromContractData),
      this.createLogPercentageFunction("getting delayed actions")
    );
    return delayedActions;
  }

  private async getHarvestableGroundResources(): Promise<CoordMap<HarvestableGroundResources>> {
    const nTilesWithHarvestableGroundResources: number = (
      await this.makeCall<EthersBN>(this.net.bulkContracts.getterFacet.getNTilesWithHarvestableGroundResources)
    ).toNumber();

    const tilesWithHarvestableGroundResources: WorldCoord[] = await aggregateBulkGetter<WorldCoord>(
      nTilesWithHarvestableGroundResources,
      OBJECT_PER_QUERY_BULK_LOADING,
      async (start, end) =>
        (
          await this.makeCall<BigNumberish[]>(
            this.net.bulkContracts.getterFacet.bulkGetTilesWithHarvestableGroundResources,
            [start, end]
          )
        ).map((b: BigNumberish) => idToCoord(b)),
      this.createLogPercentageFunction("getting tiles with harvestable resources")
    );

    const harvestableGroundResources = await aggregateBulkGetter<HarvestableGroundResources>(
      nTilesWithHarvestableGroundResources,
      OBJECT_PER_QUERY_BULK_LOADING,
      async (start, end) =>
        (
          await this.makeCall<{ souls: BigNumber }[]>(
            this.net.bulkContracts.getterFacet.bulkGetTileHarvestableGroundResourcesByIds,
            [tilesWithHarvestableGroundResources.slice(start, end).map((t) => coordToId(t))]
          )
        ).map(HarvestableGroundResourcesFromContractData),
      this.createLogPercentageFunction("getting harvestable resources")
    );

    const harvestableGroundResourcesMap = new CoordMap<HarvestableGroundResources>();
    for (const [index, tileCoord] of tilesWithHarvestableGroundResources.entries()) {
      harvestableGroundResourcesMap.set(tileCoord, harvestableGroundResources[index]);
    }
    return harvestableGroundResourcesMap;
  }

  private async getInfluenceDataByRegions(regionCoords: WorldCoord[]): Promise<CoordMap<InfluenceData>> {
    const influenceData = await aggregateBulkGetter<InfluenceData>(
      regionCoords.length,
      OBJECT_PER_QUERY_BULK_LOADING,
      async (start, end) =>
        (
          await this.makeCall<
            {
              players: string[];
              influences: BigNumber[];
            }[]
          >(this.net.bulkContracts.getterFacet.bulkGetInfluenceDataByRegionIds, [
            regionCoords.slice(start, end).map((r) => coordToId(r)),
          ])
        ).map(InfluenceDataFromContractData),
      this.createLogPercentageFunction("getting influence data")
    );

    const influenceDataByRegionId = new CoordMap<InfluenceData>();
    for (const [index, regionCoord] of regionCoords.entries()) {
      influenceDataByRegionId.set(regionCoord, influenceData[index]);
    }

    return influenceDataByRegionId;
  }
}

export default Dungeon;
