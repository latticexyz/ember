import { EventEmitter } from "events";
import {
  EthAddress,
  GameManagerEvent,
  Player,
  WorldCoord,
  ActionType,
  MovingAverages,
  UpgradeItem as UpgradeTool,
  NetworkEvent,
  DungeonEvent,
  PlayerStatus,
  TxType,
  ResourceType,
  TileDelayedAction,
} from "../../_types/GlobalTypes";
import { createStrictEventEmitterClass, notNull, Move } from "../Utils/Utils";
import ExtendedDungeon from "./ExtendedDungeon";
import {
  SPECIAL_REGION_PROOF_DEFAULT_AVERAGE_DELAY,
  TOUCH_PROOF_DEFAULT_AVERAGE_DELAY,
  TX_CONFIRM_DEFAULT_AVERAGE_DELAY,
  TX_SUBMIT_DEFAULT_AVERAGE_DELAY,
  ACTION_QUEUE_CONCURRENCY,
  PATH_PROOF_DEFAULT_AVERAGE_DELAY,
} from "../Utils/Defaults";
import { TileDelayedActionType, CreatureSpecies, CreatureType } from "../../_types/ContractTypes";
import { MovingAverage } from "./MovingAverage";
import { ActionQueue } from "./ActionQueue";
import { getActionId } from "../Utils/Ids";
import { ActionContext } from "./ActionContext";
import Bank from "./Bank";
import Constants from "./Constants";
import {
  createSpecialRegionAction,
  createWallTileAction,
  createInitiateUnwallTileAction,
  createInitiateForceMineTileAction,
  createUpgradeAction,
  createClaimDungeonHeartAction,
  createMineTileAction,
  createHarvestAction,
  createSpawnCreatureAction,
  createMoveCreaturesAction,
  createCompleteUnwallTileAction,
  createCompleteForceMineTileAction,
  createClaimResourcesAction,
} from "./actions";
import {
  playerIsInitialized,
  tileIsOwnedByPlayer,
  tileIsMined,
  tileHasNoUpgrade,
  tileHasUpgrade,
  tileHasAnyUpgrade,
  tileIsWalled,
} from "./actions/assertions";
import { assert } from "./actions/utils";
import { Action } from "./actions/Action";
import { createMetaAction } from "./actions/createMetaAction";
import Network, { NetworkEvents } from "../ETH/Network";
import { GameContracts } from "../ETH/NetworkConfig";
import { addListener, Entries } from "../../Utils/Utils";
import { DungeonEvents } from "../ETH/types";
import { ResourceSemaphore } from "./ResourceSemaphore";
import { createUpgradeSettlementAction } from "./actions/createUpgradeSettlementAction";
import { deserializeWorldCoord } from "../../Renderer/utils/worldCoords";
import { createRemoveUpgradeAction } from "./actions/createRemoveUpgradeAction";
import { createRemoveWallAction } from "./actions/createRemoveWallAction";
import { createCreateSettlementAction } from "./actions/createCreateSettlementAction";
import { createDestroySettlementAction } from "./actions/createDestroySettlementAction";
import { Semaphore } from "./Semaphore";
import { GameManagerServices, RequiresServices } from "../../Renderer/game";
import { NameQueue } from "../Utils/NameQueue";

export interface GameManagerEvents {
  // mining tiles
  [GameManagerEvent.MineTileScheduled]: (coord: WorldCoord) => void;
  [GameManagerEvent.MineTileStarted]: (coord: WorldCoord) => void;
  [GameManagerEvent.MineTileProofDone]: (coord: WorldCoord) => void;
  [GameManagerEvent.MineTileTXSubmitting]: (coord: WorldCoord) => void;
  [GameManagerEvent.MineTileTXSubmitted]: (coord: WorldCoord) => void;
  [GameManagerEvent.MineTileTXConfirmed]: (coord: WorldCoord) => void;
  [GameManagerEvent.MineTileCancelled]: (coord: WorldCoord) => void;
  [GameManagerEvent.MineTileFailed]: (coord: WorldCoord) => void;

  // Upgrade settlement
  [GameManagerEvent.UpgradeSettlementScheduled]: (coord: WorldCoord) => void;
  [GameManagerEvent.UpgradeSettlementStarted]: (coord: WorldCoord) => void;
  [GameManagerEvent.UpgradeSettlementTXSubmitted]: (coord: WorldCoord) => void;
  [GameManagerEvent.UpgradeSettlementTXSubmitting]: (coord: WorldCoord) => void;
  [GameManagerEvent.UpgradeSettlementTXConfirmed]: (coord: WorldCoord) => void;
  [GameManagerEvent.UpgradeSettlementCancelled]: (coord: WorldCoord) => void;
  [GameManagerEvent.UpgradeSettlementFailed]: (coord: WorldCoord) => void;

  // Create settlement
  [GameManagerEvent.CreateSettlementScheduled]: (coord: WorldCoord) => void;
  [GameManagerEvent.CreateSettlementStarted]: (coord: WorldCoord) => void;
  [GameManagerEvent.CreateSettlementTXSubmitted]: (coord: WorldCoord) => void;
  [GameManagerEvent.CreateSettlementTXSubmitting]: (coord: WorldCoord) => void;
  [GameManagerEvent.CreateSettlementTXConfirmed]: (coord: WorldCoord) => void;
  [GameManagerEvent.CreateSettlementCancelled]: (coord: WorldCoord) => void;
  [GameManagerEvent.CreateSettlementFailed]: (coord: WorldCoord) => void;

  // Destroy settlement
  [GameManagerEvent.DestroySettlementScheduled]: (coord: WorldCoord) => void;
  [GameManagerEvent.DestroySettlementStarted]: (coord: WorldCoord) => void;
  [GameManagerEvent.DestroySettlementTXSubmitted]: (coord: WorldCoord) => void;
  [GameManagerEvent.DestroySettlementTXSubmitting]: (coord: WorldCoord) => void;
  [GameManagerEvent.DestroySettlementTXConfirmed]: (coord: WorldCoord) => void;
  [GameManagerEvent.DestroySettlementCancelled]: (coord: WorldCoord) => void;
  [GameManagerEvent.DestroySettlementFailed]: (coord: WorldCoord) => void;

  // Remove upgrade
  [GameManagerEvent.RemoveUpgradeScheduled]: (coord: WorldCoord) => void;
  [GameManagerEvent.RemoveUpgradeStarted]: (coord: WorldCoord) => void;
  [GameManagerEvent.RemoveUpgradeTXSubmitted]: (coord: WorldCoord) => void;
  [GameManagerEvent.RemoveUpgradeTXSubmitting]: (coord: WorldCoord) => void;
  [GameManagerEvent.RemoveUpgradeTXConfirmed]: (coord: WorldCoord) => void;
  [GameManagerEvent.RemoveUpgradeCancelled]: (coord: WorldCoord) => void;
  [GameManagerEvent.RemoveUpgradeFailed]: (coord: WorldCoord) => void;

  // Remove wall
  [GameManagerEvent.RemoveWallScheduled]: (coord: WorldCoord) => void;
  [GameManagerEvent.RemoveWallStarted]: (coord: WorldCoord) => void;
  [GameManagerEvent.RemoveWallTXSubmitted]: (coord: WorldCoord) => void;
  [GameManagerEvent.RemoveWallTXSubmitting]: (coord: WorldCoord) => void;
  [GameManagerEvent.RemoveWallTXConfirmed]: (coord: WorldCoord) => void;
  [GameManagerEvent.RemoveWallCancelled]: (coord: WorldCoord) => void;
  [GameManagerEvent.RemoveWallFailed]: (coord: WorldCoord) => void;

  // Upgrade tiles
  [GameManagerEvent.UpgradeTileScheduled]: (coord: WorldCoord) => void;
  [GameManagerEvent.UpgradeTileStarted]: (coord: WorldCoord) => void;
  [GameManagerEvent.UpgradeTileTXSubmitted]: (coord: WorldCoord) => void;
  [GameManagerEvent.UpgradeTileTXSubmitting]: (coord: WorldCoord) => void;
  [GameManagerEvent.UpgradeTileTXConfirmed]: (coord: WorldCoord) => void;
  [GameManagerEvent.UpgradeTileCancelled]: (coord: WorldCoord) => void;
  [GameManagerEvent.UpgradeTileFailed]: (coord: WorldCoord) => void;

  // Harvest tiles
  [GameManagerEvent.HarvestTilesScheduled]: (coords: WorldCoord[]) => void;
  [GameManagerEvent.HarvestTilesStarted]: (coords: WorldCoord[]) => void;
  [GameManagerEvent.HarvestTilesProofDone]: (coords: WorldCoord[]) => void;
  [GameManagerEvent.HarvestTilesTXSubmitted]: (coords: WorldCoord[]) => void;
  [GameManagerEvent.HarvestTilesTXSubmitting]: (coords: WorldCoord[]) => void;
  [GameManagerEvent.HarvestTilesTXConfirmed]: (coords: WorldCoord[]) => void;
  [GameManagerEvent.HarvestTilesCancelled]: (coords: WorldCoord[]) => void;
  [GameManagerEvent.HarvestTilesFailed]: (coords: WorldCoord[]) => void;

  // Wall tiles
  [GameManagerEvent.WallTileScheduled]: (coord: WorldCoord) => void;
  [GameManagerEvent.WallTileStarted]: (coord: WorldCoord) => void;
  [GameManagerEvent.WallTileTXSubmitted]: (coord: WorldCoord) => void;
  [GameManagerEvent.WallTileTXSubmitting]: (coord: WorldCoord) => void;
  [GameManagerEvent.WallTileTXConfirmed]: (coord: WorldCoord) => void;
  [GameManagerEvent.WallTileCancelled]: (coord: WorldCoord) => void;
  [GameManagerEvent.WallTileFailed]: (coord: WorldCoord) => void;

  // Unwall tiles
  [GameManagerEvent.UnwallTileScheduled]: (coord: WorldCoord) => void;
  [GameManagerEvent.UnwallTileStarted]: (coord: WorldCoord) => void;
  [GameManagerEvent.UnwallTileTXSubmitted]: (coord: WorldCoord) => void;
  [GameManagerEvent.UnwallTileTXSubmitting]: (coord: WorldCoord) => void;
  [GameManagerEvent.UnwallTileTXConfirmed]: (coord: WorldCoord) => void;
  [GameManagerEvent.UnwallTileCancelled]: (coord: WorldCoord) => void;
  [GameManagerEvent.UnwallTileFailed]: (coord: WorldCoord) => void;

  // Force mine tiles
  [GameManagerEvent.ForceMineTileScheduled]: (coord: WorldCoord) => void;
  [GameManagerEvent.ForceMineTileStarted]: (coord: WorldCoord) => void;
  [GameManagerEvent.ForceMineTileTXSubmitted]: (coord: WorldCoord) => void;
  [GameManagerEvent.ForceMineTileTXSubmitting]: (coord: WorldCoord) => void;
  [GameManagerEvent.ForceMineTileTXConfirmed]: (coord: WorldCoord) => void;
  [GameManagerEvent.ForceMineTileCancelled]: (coord: WorldCoord) => void;
  [GameManagerEvent.ForceMineTileFailed]: (coord: WorldCoord) => void;

  // claiming resources
  [GameManagerEvent.ClaimResourcesScheduled]: (coord: WorldCoord) => void;
  [GameManagerEvent.ClaimResourcesStarted]: (coord: WorldCoord) => void;
  [GameManagerEvent.ClaimResourcesTXSubmitted]: (coord: WorldCoord) => void;
  [GameManagerEvent.ClaimResourcesTXSubmitting]: (coord: WorldCoord) => void;
  [GameManagerEvent.ClaimResourcesTXConfirmed]: (coord: WorldCoord) => void;
  [GameManagerEvent.ClaimResourcesCancelled]: (coord: WorldCoord) => void;
  [GameManagerEvent.ClaimResourcesFailed]: (coord: WorldCoord) => void;

  // spawning creatures
  [GameManagerEvent.SpawnCreatureScheduled]: (coord: WorldCoord) => void;
  [GameManagerEvent.SpawnCreatureStarted]: (coord: WorldCoord) => void;
  [GameManagerEvent.SpawnCreatureTXSubmitted]: (coord: WorldCoord) => void;
  [GameManagerEvent.SpawnCreatureTXSubmitting]: (coord: WorldCoord) => void;
  [GameManagerEvent.SpawnCreatureTXConfirmed]: (coord: WorldCoord) => void;
  [GameManagerEvent.SpawnCreatureCancelled]: (coord: WorldCoord) => void;
  [GameManagerEvent.SpawnCreatureFailed]: (coord: WorldCoord) => void;

  // spawning
  [GameManagerEvent.InitializeStarted]: (player: Player, coord: WorldCoord) => void;
  [GameManagerEvent.InitializeProofDone]: (player: Player, coord: WorldCoord) => void;
  [GameManagerEvent.InitializeTXSubmitted]: (player: Player, coord: WorldCoord) => void;
  [GameManagerEvent.InitializeTXConfirmed]: (player: Player, coord: WorldCoord) => void;
  [GameManagerEvent.InitializeError]: (msg: string) => void;

  // moving creatures
  [GameManagerEvent.MoveCreaturesScheduled]: (creatureIds: string[], destinationTile: WorldCoord) => void;
  [GameManagerEvent.MoveCreaturesStarted]: () => void;
  [GameManagerEvent.MoveCreaturesProofDone]: () => void;
  [GameManagerEvent.MoveCreaturesTXSubmitted]: () => void;
  [GameManagerEvent.MoveCreaturesTXSubmitting]: () => void;
  [GameManagerEvent.MoveCreaturesTXConfirmed]: () => void;
  [GameManagerEvent.MoveCreaturesCancelled]: (creatureIds: string[]) => void;
  [GameManagerEvent.MoveCreaturesFailed]: (creatureIds: string[]) => void;

  // Claiming Dungeon Heart
  [GameManagerEvent.ClaimDungeonHeartScheduled]: () => void;
  [GameManagerEvent.ClaimDungeonHeartStarted]: () => void;
  [GameManagerEvent.ClaimDungeonHeartTXSubmitted]: () => void;
  [GameManagerEvent.ClaimDungeonHeartTXSubmitting]: () => void;
  [GameManagerEvent.ClaimDungeonHeartTXConfirmed]: () => void;
  [GameManagerEvent.ClaimDungeonHeartCancelled]: () => void;
  [GameManagerEvent.ClaimDungeonHeartFailed]: () => void;
}

/**
 * GameManager requires a loaded ExtendedDungeon that was initiliased with an net that has a signer. GameManager allows to mutate the game using this signer.
 * GameManager a TX queue. It emits events when TXes are sent and confirmed. Clients can also listen to events emitted by the extendedDungeon property of the GameManager to re-render the game or the UI.
 */

/**
 * - mutation queues: done
 * - mutation functions: some done
 * - tx created, tx submitted, tx confirmed events and list: not done. for ui and renderer.
 */
class GameManager extends createStrictEventEmitterClass<GameManagerEvents>() implements RequiresServices {
  services: GameManagerServices;
  static instance: GameManager | null = null;
  extendedDungeon: ExtendedDungeon;
  bank: Bank;
  constants: Constants;
  address: EthAddress;
  net: Network<GameContracts, TxType>;
  actionQueue: ActionQueue;
  actionContext: ActionContext;
  movingAverages: MovingAverages;
  networkEventListeners: Entries<NetworkEvents>[];
  dungeonEventListeners: Entries<DungeonEvents>[];

  static getInstance(): GameManager {
    if (!GameManager.instance) {
      throw new Error("no singleton instance");
    }
    return GameManager.instance;
  }

  private constructor(
    extendedDungeon: ExtendedDungeon,
    bank: Bank,
    constants: Constants,
    address: EthAddress,
    net: Network<GameContracts, TxType>,
    movingAverages: MovingAverages,
    actionQueue: ActionQueue,
    actionContext: ActionContext
  ) {
    super();
    this.extendedDungeon = extendedDungeon;
    this.bank = bank;
    this.constants = constants;
    this.address = address;
    this.net = net;
    this.movingAverages = movingAverages;
    this.actionQueue = actionQueue;
    this.actionContext = actionContext;
    this.networkEventListeners = [];
    this.dungeonEventListeners = [];

    // Instantiate all of services that the manager needs.
    const nameQueue = new NameQueue();

    this.services = {
      nameQueue: nameQueue
    };
  }

  boot() {
    this.setupEventListeners();

    // Boot all the services that this manager needs.
    this.services.nameQueue.bootService();
  }

  destroy() {
    this.removeEventListeners();
    this.net.destroy();

    // Destroy all the services that this manager needed.
    this.services.nameQueue.destroyService();

    GameManager.instance = null;
  }

  public setupEventListeners() {
    this.removeEventListeners();

    this.networkEventListeners = [
      addListener(this.net, NetworkEvent.PredictedChainTimeChanged, () => {
        this.extendedDungeon.updateCurrentManaFromChainTime(this.address);
        for (const coord of this.extendedDungeon.settlements.coords()) {
          this.extendedDungeon.updateCurrentEnergyFromChainTime(coord);
        }
        this.actionQueue.process([
          ActionType.SpawnCreature,
          ActionType.UpgradeTile,
          ActionType.MineTile,
          ActionType.CompleteForceMineTile,
          ActionType.CompleteUnwallTile,
        ]);
      }),
    ];

    this.dungeonEventListeners = [
      addListener(this.extendedDungeon, DungeonEvent.PlayerInfluenceInRegionUpdated, () => this.actionQueue.process()),
      addListener(this.extendedDungeon, DungeonEvent.TileMined, () => this.actionQueue.process()),
      addListener(this.extendedDungeon, DungeonEvent.TileClaimed, () => this.actionQueue.process()),
      addListener(this.extendedDungeon, DungeonEvent.TileWalled, () => this.actionQueue.process()),
      addListener(this.extendedDungeon, DungeonEvent.TileUnwalled, () => this.actionQueue.process()),
      addListener(this.extendedDungeon, DungeonEvent.TileUpgraded, () => this.actionQueue.process()),
      addListener(this.extendedDungeon, DungeonEvent.PlayerUpdated, () =>
        this.actionQueue.process([ActionType.WallTile, ActionType.UpgradeTile, ActionType.SpawnCreature])
      ),
      addListener(this.extendedDungeon, DungeonEvent.TileDelayedActionInitiated, (delayedAction) =>
        this.processDelayedActions([delayedAction])
      ),
    ];
  }

  private removeEventListeners() {
    this.dungeonEventListeners.forEach((listener) => this.extendedDungeon.removeListener(...listener));
    this.dungeonEventListeners = [];

    this.networkEventListeners.forEach((listener) => this.net.removeListener(...listener));
    this.networkEventListeners = [];
  }

  static hasInstance(): boolean {
    return !!GameManager.instance;
  }

  static async create(net: Network<GameContracts, TxType>): Promise<GameManager> {
    if (GameManager.instance) {
      throw new Error("a singleton instance already exists");
    }

    let address: EthAddress;

    try {
      address = net.getAddress();
    } catch {
      throw new Error("the Net used to init the dungeon has no signer. GameManager requires a signer");
    }

    // Loading constants
    const constants = await Constants.create(net);

    // Setup ExtendedDungeon
    const extendedDungeon = await ExtendedDungeon.create(net, address, constants);

    const movingAverages = {
      specialRegionProof: new MovingAverage("specialRegionProof", SPECIAL_REGION_PROOF_DEFAULT_AVERAGE_DELAY),
      touchProof: new MovingAverage("touchProof", TOUCH_PROOF_DEFAULT_AVERAGE_DELAY),
      pathProof: new MovingAverage("pathProof", PATH_PROOF_DEFAULT_AVERAGE_DELAY),
      txSubmit: new MovingAverage("TXSubmit", TX_SUBMIT_DEFAULT_AVERAGE_DELAY),
      txConfirm: new MovingAverage("TXConfirm", TX_CONFIRM_DEFAULT_AVERAGE_DELAY),
    };

    const goldSemaphore = new ResourceSemaphore(() => extendedDungeon.players.get(extendedDungeon.player)?.gold || 0);
    const soulSemaphore = new ResourceSemaphore(() => extendedDungeon.players.get(extendedDungeon.player)?.souls || 0);

    const populationSemaphore = new ResourceSemaphore(
      () =>
        (extendedDungeon.players.get(extendedDungeon.player)?.maxPopulation || 0) -
        (extendedDungeon.players.get(extendedDungeon.player)?.population || 0)
    );
    const manaSemaphore = new ResourceSemaphore(() => extendedDungeon.currentMana || 0);

    const semaphoreForResource = {
      [ResourceType.Gold]: goldSemaphore,
      [ResourceType.Mana]: manaSemaphore,
      [ResourceType.Soul]: soulSemaphore,
      [ResourceType.Population]: populationSemaphore,
    };

    const spawnSemaphore = new Semaphore(1);
    const semaphoreForAction = {
      [ActionType.SpawnCreature]: spawnSemaphore,
    };

    const actionQueue = new ActionQueue(ACTION_QUEUE_CONCURRENCY, semaphoreForAction, semaphoreForResource);

    const actionContext = await ActionContext.create({
      extendedDungeon,
      constants,
      net: extendedDungeon.net,
      movingAverages,
      player: address,
      playerStatus: PlayerStatus.UNKNOWN,
      actionQueue,
    });

    const bank = await Bank.create(extendedDungeon.net, actionContext.txExecutor, address);

    const gm = new GameManager(
      extendedDungeon,
      bank,
      constants,
      address,
      extendedDungeon.net,
      movingAverages,
      actionQueue,
      actionContext
    );

    actionContext.setEmit(gm.emit.bind(gm));

    this.instance = gm;
    // Boot up the manager, which should setup listeners that it needs and boot up any services
    // that the manager needs.
    gm.boot();

    return gm;
  }

  public async load() {
    await this.extendedDungeon.load();
    // HACK: compute all the initial values
    for (const coord of this.extendedDungeon.settlements.coords()) {
      this.extendedDungeon.updateCurrentEnergyFromChainTime(coord);
    }
    const p = this.extendedDungeon.players.get(this.address);
    let playerStatus = PlayerStatus.UNKNOWN;
    if (!p) {
      console.debug("Player is whitelised");
      playerStatus = PlayerStatus.WHITELISTED;
    } else {
      console.debug("Player is initialized");
      playerStatus = PlayerStatus.INITIALIZED;
    }

    this.actionContext.setPlayerStatus(playerStatus);
    this.processDelayedActions(this.extendedDungeon.delayedActions, true);
  }

  public cancelAction(actionId: string) {
    this.actionQueue.remove(actionId);
  }

  public cancelMineTile(coords: WorldCoord) {
    const actionId = getActionId(coords, ActionType.MineTile);
    this.cancelAction(actionId);
  }

  public cancelUpgradeTile(coords: WorldCoord) {
    const actionId = getActionId(coords, ActionType.UpgradeTile);
    this.cancelAction(actionId);
  }

  public cancelWallTile(coords: WorldCoord) {
    const actionId = getActionId(coords, ActionType.WallTile);
    this.cancelAction(actionId);
  }

  public cancelIniateUnwallTile(coords: WorldCoord) {
    const actionId = getActionId(coords, ActionType.InitiateUnwallTile);
    this.cancelAction(actionId);
  }

  public cancelInitiateForceMineTile(coords: WorldCoord) {
    const actionId = getActionId(coords, ActionType.InitiateForceMineTile);
    this.cancelAction(actionId);
  }

  public cancelCompleteForceMineTile(coord: WorldCoord) {
    const actionId = getActionId(coord, ActionType.CompleteForceMineTile);
    this.cancelAction(actionId);
  }

  public cancelCompleteUnwallTile(coord: WorldCoord) {
    const actionId = getActionId(coord, ActionType.CompleteUnwallTile);
    this.cancelAction(actionId);
  }

  public async initializePlayer(regionCoord: WorldCoord) {
    const action = createSpecialRegionAction({ regionCoord }, this.actionContext);
    action && this.actionQueue.add(action);
  }

  public async wallTile(coord: WorldCoord) {
    return this.wallTiles([coord]);
  }

  public async wallTiles(coords: WorldCoord[]) {
    const actions: Action<any>[] = coords
      .map((coord) => {
        const { pass, error } = assert([
          tileIsOwnedByPlayer(coord, this.actionContext),
          tileIsMined(coord, this.actionContext),
          tileHasNoUpgrade(coord, this.actionContext),
        ]);

        if (!pass) {
          console.warn(error);
          return;
        }
        return createWallTileAction({ coord }, this.actionContext);
      })
      .filter(notNull);

    const action =
      actions.length === 1
        ? actions[0]
        : createMetaAction({ actionGraph: { actions }, name: "Build walls" }, this.actionContext);

    action && this.actionQueue.add(action);
  }

  public async initiateUnwallTile(coord: WorldCoord) {
    return this.initiateUnwallTiles([coord]);
  }

  public async initiateUnwallTiles(coords: WorldCoord[]) {
    const actions: Action<any>[] = coords.map((coord) => {
      return createInitiateUnwallTileAction({ coord }, this.actionContext);
    });

    const action =
      actions.length === 1
        ? actions[0]
        : createMetaAction({ actionGraph: { actions }, name: "Break walls" }, this.actionContext);

    action && this.actionQueue.add(action);
  }

  public async initiateForceMineTile(coord: WorldCoord) {
    return this.initiateForceMineTiles([coord]);
  }

  public async initiateForceMineTiles(coords: WorldCoord[]) {
    const actions: Action<any>[] = coords.map((coord) => {
      return createInitiateForceMineTileAction({ coord }, this.actionContext);
    });

    const action =
      actions.length === 1
        ? actions[0]
        : createMetaAction({ actionGraph: { actions }, name: "Force mine tiles" }, this.actionContext);

    action && this.actionQueue.add(action);
  }

  public async upgradeTile(coord: WorldCoord, upgrade: UpgradeTool) {
    const { pass } = assert([playerIsInitialized(this.actionContext)]);
    if (!pass) return;

    const action = createUpgradeAction({ coord, tool: upgrade }, this.actionContext);
    action && this.actionQueue.add(action);
  }

  public async removeUpgrade(coord: WorldCoord) {
    const { pass } = assert([playerIsInitialized(this.actionContext), tileHasAnyUpgrade(coord, this.actionContext)]);
    if (!pass) return;

    const action = createRemoveUpgradeAction({ coord }, this.actionContext);
    action && this.actionQueue.add(action);
  }

  public async removeWall(coord: WorldCoord) {
    const { pass } = assert([playerIsInitialized(this.actionContext), tileIsWalled(coord, this.actionContext)]);
    if (!pass) return;

    const action = createRemoveWallAction({ coord }, this.actionContext);
    action && this.actionQueue.add(action);
  }

  public async upgradeTiles(coords: WorldCoord[], upgrade: UpgradeTool) {
    if (coords.length === 1) return this.upgradeTile(coords[0], upgrade);
    const { pass } = assert([playerIsInitialized(this.actionContext)]);
    if (!pass) return;

    const actions: Action<any>[] = [];
    for (const coord of coords) {
      actions.push(createUpgradeAction({ coord, tool: upgrade }, this.actionContext));
    }

    const action = createMetaAction({ actionGraph: { actions }, name: "Upgrade tiles" }, this.actionContext);
    action && this.actionQueue.add(action);
  }

  public async createSettlement(regionCoord: WorldCoord) {
    const { pass } = assert([playerIsInitialized(this.actionContext)]);
    if (!pass) return;
    const action = createCreateSettlementAction({ regionCoord }, this.actionContext);
    action && this.actionQueue.add(action);
  }

  public async destroySettlement(regionCoord: WorldCoord) {
    const { pass } = assert([playerIsInitialized(this.actionContext)]);
    if (!pass) return;
    const action = createDestroySettlementAction({ regionCoord }, this.actionContext);
    action && this.actionQueue.add(action);
  }

  public async upgradeSettlement(regionCoord: WorldCoord) {
    const { pass } = assert([playerIsInitialized(this.actionContext)]);
    if (!pass) return;
    const action = createUpgradeSettlementAction({ regionCoord }, this.actionContext);
    action && this.actionQueue.add(action);
  }

  public async claimDungeonHeart(regionCoord: WorldCoord) {
    const { pass } = assert([playerIsInitialized(this.actionContext)]);
    if (!pass) return;

    const action = createClaimDungeonHeartAction({ regionCoord }, this.actionContext);
    action && this.actionQueue.add(action);
  }

  public async claimResourcesOnRegion(regionCoord: WorldCoord) {
    const { pass } = assert([playerIsInitialized(this.actionContext)]);
    if (!pass) return;

    const action = createClaimResourcesAction({ regionCoord }, this.actionContext);
    action && this.actionQueue.add(action);
  }

  public async mineTile(coord: WorldCoord) {
    const { pass } = assert([playerIsInitialized(this.actionContext)]);
    if (!pass) return;

    const action = createMineTileAction({ coord }, this.actionContext);
    action && this.actionQueue.add(action);
  }

  public async mineTiles(coords: WorldCoord[]) {
    if (coords.length === 0) return;
    if (coords.length === 1) return this.mineTile(coords[0]);

    const { pass } = assert([playerIsInitialized(this.actionContext)]);
    if (!pass) return;

    const actions: Action<any>[] = [];
    for (const coord of coords) {
      actions.push(createMineTileAction({ coord }, this.actionContext));
    }

    const action = createMetaAction({ actionGraph: { actions }, name: "Mine tiles" }, this.actionContext);
    action && this.actionQueue.add(action);
  }

  public async harvestTiles(tileCoords: WorldCoord[]) {
    const action = createHarvestAction({ tileCoords }, this.actionContext);
    action && this.actionQueue.add(action);
  }

  public async spawnCreature(coord: WorldCoord, creatureSpecies: CreatureSpecies, creatureType: CreatureType) {
    const action = createSpawnCreatureAction({ coord, creatureSpecies, creatureType }, this.actionContext);
    action && this.actionQueue.add(action);
  }

  /**
   * Creates a single creature move and adds to queue.
   *
   * @param move single move specifying how to move to the destination.
   * @param creatureIds IDs of the creatues to be moved.
   */
  public async moveCreatures(move: Move, creatureIds: string[]) {
    const { pass } = assert([playerIsInitialized(this.actionContext)]);
    if (!pass) return;

    const action = this.buildActionForSimpleCreatureMovement(move, creatureIds);
    action && this.actionQueue.add(action);
  }

  /**
   * Creates a meta-move for creatures comprised of individual moves and adds to queue.
   *
   * @param moves array of moves specifying how to get to destination.
   * @param creatureIds IDs of the creatues to be moved.
   */
  public async metaMoveCreatures(moves: Move[], creatureIds: string[]) {
    const { pass } = assert([playerIsInitialized(this.actionContext)]);
    if (!pass) return;

    const action = this.buildActionForMetaCreatureMovement(moves, creatureIds);
    action && this.actionQueue.add(action);
  }

  /**
   * Creates a multi-destination move which itself may be comprised of meta-moves. A multi-destination
   * move allows creatures to be moved to different destination tiles/regions.
   *
   * @param destinationPaths a map of creature ID -> array of moves specifying how to get to destination.
   * @param creatureIds IDs of the creatues to be moved.
   */
  public async multipleDestinationsMoveCreatures(destinationPaths: Map<string, Move[]>, creatureIds: string[]) {
    const { pass } = assert([playerIsInitialized(this.actionContext)]);
    if (!pass) return;

    // Execute a meta move one-by-one by sending invidual move transactions based on the moves that were
    // figured out in the previous step. Before each move we need to check if based on the *current* state
    // the move to the region and/or final destination tile can successfully be completed. If no, we
    // should stop the creatures at whatever intermediary region they currently are at and let the user know.
    const action = this.buildActionForMultiDestinationCreatureMovement(destinationPaths, creatureIds);
    action && this.actionQueue.add(action);
  }

  /*
  Attempts to build a 'simple' creature move, which is one within some radius where we are allowed to move
  in a single transaction and can attack another player's creatures. For this move we take the starting region
  of where the creatures (or single creature) are and attempt to build a path to a destination region and
  destination tile. If the destination tile is not specified ('undefined'), then we will attempt to move to any
  valid tile in the region.
  */
  private buildActionForSimpleCreatureMovement(move: Move, creatureIds: string[]): Action<any> {
    const destinationTile = move.endTile;
    const destinationRegion = move.endRegion;
    const startRegion = move.startRegion;

    return createMoveCreaturesAction(
      { creatureIds, destinationRegion, destinationTile, startRegion },
      this.actionContext
    );
  }

  /*
  Attempts to build a 'meta' creature move, which is a move that is comprised of a series of smaller, 
  'simple' creature moves. At a high level, this is done by taking a pre-computed path in region space, 
  breaking it down into singlular moves and attempting to execute them in order to get to the final destination.

  There is a notion of a 'itermediary' move and a 'final' move, since as we chain moves together, for the final
  move we care that the creatures are moved to the specific destination tile, but for itermediary it is OK to use
  any tile as long as there one is available (since otherwise it would be an illegal move).
  */
  private buildActionForMetaCreatureMovement(moves: Move[], creatureIds: string[]): Action<any> {
    if (moves.length === 1) return this.buildActionForSimpleCreatureMovement(moves[0], creatureIds);

    const actions: Action<any>[] = [];
    for (const move of moves) {
      const destinationRegion = move.endRegion;
      const destinationTile = move.endTile;
      const startRegion = move.startRegion;

      actions.push(
        createMoveCreaturesAction({ creatureIds, destinationRegion, destinationTile, startRegion }, this.actionContext)
      );
    }

    return createMetaAction(
      { actionGraph: { actions }, name: `Move creature${creatureIds.length > 1 ? "s" : ""}` },
      this.actionContext
    );
  }

  /*
  Attempts to build a 'multi destination' meta movement action. This time of creature movement allows the player to pick
  creatures from the same region and pick destinations that are in different regions, effectivelly allowing actions that
  split up an army between neighboring regions. This is implemented by build a meta action comprised of other actions or even
  meta actions themselves.
  */
  private buildActionForMultiDestinationCreatureMovement(
    destinationPaths: Map<string, Move[]>,
    creatureIds: string[]
  ): Action<any> {
    const actions: Action<any>[] = [];

    for (const creatureId of creatureIds) {
      const moves = destinationPaths.get(creatureId);
      if (!moves) continue;

      const action = this.buildActionForMetaCreatureMovement(moves, [creatureId]);
      actions.push(action);
    }

    return createMetaAction(
      { actionGraph: { actions }, name: "Move creatures to multiple destinations" },
      this.actionContext
    );
  }

  public processDelayedActions(delayedActions: TileDelayedAction[], initial?: boolean) {
    for (const delayedAction of delayedActions) {
      const { initiator, coord, delayedActionType, submittedTimestamp } = delayedAction;

      // Skip stale delayed actions
      const delayBeforeExpired = this.constants.gameConstants.SECONDS_UNTIL_EXPIRED_DELAYED_ACTION;
      const delay = this.net.predictedChainTime - submittedTimestamp;
      if (delay >= delayBeforeExpired) {
        continue;
      }

      // Adding own complete actions to the queue, duplicate actions will be ignored by the actionQueue
      if (initiator === this.address) {
        const createAction = {
          [TileDelayedActionType.UNWALL]: createCompleteUnwallTileAction,
          [TileDelayedActionType.FORCE_MINE]: createCompleteForceMineTileAction,
        };

        const action = createAction[delayedActionType]({ coord, submittedTimestamp }, this.actionContext);
        this.actionQueue.add(action);
      }

      // Emitting this event to handle delayed actions that were initiated before the game was loaded.
      if (initial) this.extendedDungeon.emit(DungeonEvent.TileDelayedActionInitiated, delayedAction);
    }
  }
}
export default GameManager;
