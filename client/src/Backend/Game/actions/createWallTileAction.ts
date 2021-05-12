import { Action } from "./Action";
import { ActionState, ResourceType } from "../../../_types/GlobalTypes";
import { ActionType, WorldCoord, TxType } from "../../../_types/GlobalTypes";
import { tileCoordToRegionCoord } from "../../Utils/Utils";
import { v4 } from "uuid";
import { ActionCreator } from "./types";
import { getActionId } from "../../Utils/Ids";
import { actionEvents } from "./events";
import { coordToId } from "../../Utils/PackedCoords";
import { serializeWorldCoord } from "../../../Renderer/utils/worldCoords";

interface CreateWallTileActionData {
  coord: WorldCoord;
}

export const createWallTileAction: ActionCreator<CreateWallTileActionData, Action<boolean | null>> = (
  { coord },
  context
) => {
  const { extendedDungeon, emit, txExecutor, net, movingAverages, player } = context;

  const actionId = getActionId(coord, ActionType.WallTile);

  const events = actionEvents[ActionType.WallTile];
  const regionCoord = tileCoordToRegionCoord(coord);

  const action = new Action({
    id: actionId,
    type: ActionType.WallTile,
    name: `Wall ${coord.x}/${coord.y}`,
    costByResource: {
      [ResourceType.Gold]: context.constants.gameConstants.WALL_PRICE,
    },
    onStateChange: (state) => {
      if (!emit) return;
      if (state === ActionState.Queued) emit(events.scheduled, coord);
      if (state === ActionState.Cancelled) {
        // TODO: send transaction to remove the delayed action from the contract. Cancellation of delayed actions is deactivated on the client until then.
        // const delayedAction = extendedDungeon.getDelayedActionsAt(coord).find((d) => d.initiator === player);
        // delayedAction && extendedDungeon.removeDelayedAction(delayedAction);
        emit(events.cancelled, coord);
      }
    },
    requirement: () => {
      const goldBalance = context.extendedDungeon.players.get(context.player)?.gold;
      const upgradePrice = context.constants.gameConstants.WALL_PRICE;
      const { settlement } = extendedDungeon.getSettlement(tileCoordToRegionCoord(coord));

      if (goldBalance != null && (goldBalance < upgradePrice || settlement.energy < 1)) {
        return false;
      }
      const regionCoords = tileCoordToRegionCoord(coord);
      const { controller, disputed } = extendedDungeon.getRegionController(regionCoords);
      if (controller !== player || disputed) {
        return false;
      }

      return true;
    },
    process: async () => {
      emit && emit(events.started, coord);

      const tileId = coordToId(coord);
      let submitStart: number;
      let confirmStart: number;

      const { submitted, confirmed } = txExecutor.makeRequest({
        txId: v4(),
        actionId,
        onBalanceTooLow: () => net.getFunds(),
        genTransaction: async (nonce, _) => {
          return net.contracts.dungeonFacet.wallTile(tileId, {
            nonce,
            ...net.ethersOverrides,
            ...net.ethersOverridesPerTxType[TxType.WallTile],
          });
        },
        onSubmitting: () => {
          submitStart = Date.now();
          emit && emit(events.txSubmitting, coord);
          action.setProgress(0.33);
        },
        onSubmitted: () => {
          const submitDuration = Date.now() - submitStart;
          emit && emit(events.txSubmitted, coord);
          movingAverages.txSubmit.addStat(submitDuration);
          confirmStart = Date.now();
          action.setProgress(0.66);
        },
        onConfirmed: () => {
          const confirmDuration = Date.now() - confirmStart;
          movingAverages.txConfirm.addStat(confirmDuration);
        },
      });

      try {
        await submitted;
        const receipt = await confirmed;
        if (receipt.status === 0) {
          throw new Error("Reverted");
        }
        extendedDungeon.chargeEnergyForAction(coord, 1);
        await net.waitForAllTransactionLogsToBeHandled(receipt.transactionHash);
        emit && emit(events.txConfirmed, coord);
      } catch (e) {
        emit && emit(events.failed, coord);
        // Rethrow the error to catch it again in the action queue
        throw e;
      }
    },
  });
  return action;
};
