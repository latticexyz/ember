import { Action } from "./Action";
import { ActionState, ResourceType } from "../../../_types/GlobalTypes";
import { ActionType, WorldCoord, TxType, UpgradeItem as UpgradeTool } from "../../../_types/GlobalTypes";
import { ActionTypeToContractActionType, tileCoordToRegionCoord } from "../../Utils/Utils";
import { v4 } from "uuid";
import { ActionCreator } from "./types";
import { TileUpgrade } from "../../../_types/ContractTypes";
import { getActionId } from "../../Utils/Ids";
import { assert } from "./utils";
import { tileIsMined, playerControlsRegion, tileIsOwnedByPlayer } from "./assertions";
import { actionEvents } from "./events";
import { coordToId, idToCoord } from "../../Utils/PackedCoords";
import { serializeWorldCoord } from "../../../Renderer/utils/worldCoords";

interface RemoveTileUpgradeData {
  coord: WorldCoord;
}

export const createRemoveUpgradeAction: ActionCreator<RemoveTileUpgradeData, Action<boolean | null>> = (
  { coord },
  context
) => {
  const { extendedDungeon, emit, txExecutor, net, movingAverages, player } = context;
  const actionId = getActionId(coord, ActionType.RemoveUpgrade);
  const events = actionEvents[ActionType.RemoveUpgrade];
  const regionCoord = tileCoordToRegionCoord(coord);
  const action = new Action({
    id: actionId,
    type: ActionType.RemoveUpgrade,
    name: `Remove upgrade ${coord.x}/${coord.y}`,
    onStateChange: (state) => {
      if (!emit) return;
      if (state === ActionState.Queued) emit(events.scheduled, coord);
      if (state === ActionState.Cancelled) emit(events.cancelled, coord);
    },
    requirement: async () => {
      const { pass } = assert([
        tileIsMined(coord, context),
        tileIsOwnedByPlayer(coord, context),
        playerControlsRegion(tileCoordToRegionCoord(coord), context),
      ]);
      if (!pass) return false;
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
          if (!tileId) {
            throw new Error("Tile does not exist in Unobfuscated Dungeon");
          }

          return net.contracts.dungeonFacet.removeUpgrade(tileId, {
            nonce,
            ...net.ethersOverrides,
            ...net.ethersOverridesPerTxType[TxType.UpgradeTile],
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
          emit && emit(events.txConfirmed, coord);
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
      } catch (e) {
        emit && emit(events.failed, coord);
        // Rethrow the error to catch it again in the action queue
        throw e;
      }
    },
  });
  return action;
};
