import { Action } from "./Action";
import { ActionState } from "../../../_types/GlobalTypes";
import { ActionType, WorldCoord, TxType } from "../../../_types/GlobalTypes";
import { v4 } from "uuid";
import { ActionCreator } from "./types";
import { getActionIdFromCoordGroup } from "../../Utils/Ids";
import { actionEvents } from "./events";
import { packCoordList } from "../../Utils/PackedCoords";

interface CreateTileActionData {
  tileCoords: WorldCoord[];
}

export const createHarvestAction: ActionCreator<CreateTileActionData, Action<unknown>> = (
  { tileCoords },
  { extendedDungeon: extendedDungeon, emit, txExecutor, net, movingAverages }
) => {
  const actionId = getActionIdFromCoordGroup(tileCoords, ActionType.HarvestTiles);

  const events = actionEvents[ActionType.HarvestTiles];

  const action = new Action({
    id: actionId,
    type: ActionType.HarvestTiles,
    name: "Harvest",
    onStateChange: (state) => emit && state === ActionState.Queued && emit(events.scheduled, tileCoords),
    process: async () => {
      const packedPath = packCoordList(tileCoords);
      let submitStart: number;
      let confirmStart: number;

      const { submitted, confirmed } = txExecutor.makeRequest({
        txId: v4(),
        actionId,
        onBalanceTooLow: () => net.getFunds(),
        genTransaction: async (nonce, _) => {
          return net.contracts.dungeonFacet.harvestTiles(packedPath, {
            nonce,
            ...net.ethersOverrides,
            ...net.ethersOverridesPerTxType[TxType.HarvestTiles],
          });
        },
        onSubmitting: () => {
          submitStart = Date.now();
          emit && emit(events.txSubmitting, tileCoords);
          action.setProgress(0.33);
        },
        onSubmitted: () => {
          const submitDuration = Date.now() - submitStart;
          emit && emit(events.txSubmitted, tileCoords);
          movingAverages.txSubmit.addStat(submitDuration);
          confirmStart = Date.now();
          action.setProgress(0.66);
        },
        onConfirmed: () => {
          const confirmDuration = Date.now() - confirmStart;
          emit && emit(events.txConfirmed, tileCoords);
          movingAverages.txConfirm.addStat(confirmDuration);
        },
      });

      try {
        await submitted;
        const receipt = await confirmed;
        if (receipt.status === 0) {
          throw new Error("Reverted");
        }
        // Optimistic update

        // const harvestableAmount = extendedDungeon.getHarvestableAmount(tiles, upgrade);
        // const amount = Array.from(harvestableAmount.values()).reduce((acc, curr) => {
        //   return acc + curr.individual + curr.boost;
        // }, 0);
        // const player = extendedDungeon.players.get(player);
        // if (player) {
        //   if (upgrade === TileUpgrade.GOLD_GENERATOR) {
        //     optimisticallyIncreaseResourceOfPlayerInRegion(
        //       amount,
        //       Resource.GOLD,
        //       tileCoordToRegionCoord(tilesRaw[0])
        //     );
        //   } else if (upgrade === TileUpgrade.SOUL_GENERATOR) {
        //     optimisticallyIncreaseResourceOfPlayerInRegion(
        //       amount,
        //       Resource.SOULS,
        //       tileCoordToRegionCoord(tilesRaw[0])
        //     );
        //   }
        // }
      } catch (e) {
        emit && emit(events.failed, tileCoords);
        // Rethrow the error to catch it again in the action queue
        throw e;
      }
    },
  });
  return action;
};
