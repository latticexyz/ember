import { Action } from "./Action";
import { ActionState } from "../../../_types/GlobalTypes";
import { ActionType, WorldCoord, TxType } from "../../../_types/GlobalTypes";
import { tileCoordToRegionCoord } from "../../Utils/Utils";
import { v4 } from "uuid";
import { ActionCreator } from "./types";
import { TileUpgrade } from "../../../_types/ContractTypes";
import { getActionId } from "../../Utils/Ids";
import { actionEvents } from "./events";
import { coordToId } from "../../Utils/PackedCoords";

interface CreateWallTileActionData {
  type: ActionType;
  coord: WorldCoord;
  requirement?: () => boolean;
}

export const createWallTileAction: ActionCreator<CreateWallTileActionData, Action<boolean | null>> = (
  { type, coord, requirement },
  context
) => {
  const { extendedDungeon, emit, txExecutor, net, movingAverages, player } = context;

  const actionId = getActionId(coord, type);

  const events = actionEvents[type] as
    | typeof actionEvents[ActionType.InitiateWallTile]
    | typeof actionEvents[ActionType.CompleteWallTile];

  const action = new Action({
    id: actionId,
    type,
    name: `Wall (${type === ActionType.InitiateWallTile ? "Initiate" : "Complete"}) ${coord.x}/${coord.y}`,
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
      if (requirement && !requirement()) {
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

      const ethMethod = {
        [ActionType.InitiateWallTile]: net.contracts.dungeonFacet.initiateWallTile,
        [ActionType.CompleteWallTile]: net.contracts.dungeonFacet.completeWallTile,
      };

      const txType = {
        [ActionType.InitiateWallTile]: TxType.InitiateWallTile,
        [ActionType.CompleteWallTile]: TxType.CompleteWallTile,
      };

      const { submitted, confirmed } = txExecutor.makeRequest({
        txId: v4(),
        actionId,
        onBalanceTooLow: () => net.getFunds(),
        genTransaction: async (nonce, _) => {
          return ethMethod[type](tileId, {
            nonce,
            ...net.ethersOverrides,
            ...net.ethersOverridesPerTxType[txType[type]],
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
