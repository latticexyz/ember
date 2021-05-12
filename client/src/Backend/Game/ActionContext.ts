import ExtendedDungeon from "./ExtendedDungeon";
import { TxExecutor } from "./TxExecutor";
import { GameManagerEvent, MovingAverages, Player, EthAddress, PlayerStatus, TxType } from "../../_types/GlobalTypes";
import Constants from "./Constants";
import Bank from "./Bank";
import { ActionQueue } from "./ActionQueue";
import { GameContracts } from "../ETH/NetworkConfig";
import Network from "../ETH/Network";

export interface ActionContextInterface {
  extendedDungeon: ExtendedDungeon;
  constants: Constants;
  txExecutor: TxExecutor;
  net: Network<GameContracts, TxType>;
  emit?: (event: GameManagerEvent, ...args: any[]) => any;
  movingAverages: MovingAverages;
  player: EthAddress;
  playerStatus: PlayerStatus;
  actionQueue: ActionQueue;
}

export class ActionContext {
  extendedDungeon: ActionContextInterface["extendedDungeon"];
  constants: ActionContextInterface["constants"];
  txExecutor: ActionContextInterface["txExecutor"];
  net: ActionContextInterface["net"];
  emit: ActionContextInterface["emit"];
  movingAverages: ActionContextInterface["movingAverages"];
  player: ActionContextInterface["player"];
  playerStatus: ActionContextInterface["playerStatus"];
  actionQueue: ActionContextInterface["actionQueue"];

  constructor(context: ActionContextInterface) {
    this.extendedDungeon = context.extendedDungeon;
    this.constants = context.constants;
    this.txExecutor = context.txExecutor;
    this.net = context.net;
    this.emit = context.emit;
    this.movingAverages = context.movingAverages;
    this.player = context.player;
    this.playerStatus = context.playerStatus;
    this.actionQueue = context.actionQueue;
  }

  public setEmit(emit: ActionContextInterface["emit"]) {
    this.emit = emit;
  }

  public setPlayerStatus(playerStatus: ActionContextInterface["playerStatus"]) {
    this.playerStatus = playerStatus;
  }

  public static async create({
    extendedDungeon,
    constants,
    net,
    emit,
    movingAverages,
    player,
    playerStatus,
    actionQueue,
  }: {
    extendedDungeon: ActionContextInterface["extendedDungeon"];
    constants: ActionContextInterface["constants"];
    net: ActionContextInterface["net"];
    emit?: ActionContextInterface["emit"];
    movingAverages: ActionContextInterface["movingAverages"];
    player: ActionContextInterface["player"];
    playerStatus: ActionContextInterface["playerStatus"];
    actionQueue: ActionContextInterface["actionQueue"];
  }) {
    const nonce = await net.getNonce();

    const context = {
      extendedDungeon,
      constants,
      txExecutor: new TxExecutor(net, nonce),
      net,
      emit,
      movingAverages,
      player,
      playerStatus,
      actionQueue,
    };

    return new ActionContext(context);
  }
}
