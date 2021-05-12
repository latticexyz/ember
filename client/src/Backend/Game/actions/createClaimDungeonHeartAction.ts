import { Action } from "./Action";
import { ActionType, WorldCoord, GameManagerEvent, TxType, TileId, ActionState } from "../../../_types/GlobalTypes";
import { v4 } from "uuid";
import { ActionCreator } from "./types";
import { TileUpgrade } from "../../../_types/ContractTypes";
import { BigNumberish } from "@ethersproject/bignumber";
import { assert } from "./utils";
import { regionIsMined, playerControlsRegion } from "./assertions";
import { getActionId } from "../../Utils/Ids";
import { actionEvents } from "./events";
import { packCoords } from "../../Utils/PackedCoords";
import { BigNumber } from "ethers";
import { regionCoordToCenterTileCoords } from "../../Utils/Utils";

interface CreateClaimDungeonHeartData {
  regionCoord: WorldCoord;
}

export const createClaimDungeonHeartAction: ActionCreator<CreateClaimDungeonHeartData, Action<boolean | null>> = (
  { regionCoord },
  context
) => {
  const { emit, txExecutor, net, movingAverages } = context;

  const actionId = getActionId(regionCoord, ActionType.ClaimDungeonHeart);
  const events = actionEvents[ActionType.ClaimDungeonHeart];

  const action = new Action({
    id: actionId,
    type: ActionType.ClaimDungeonHeart,
    name: `Claim Dungeon Heart`,
    onStateChange: (state) => state === ActionState.Queued && emit && emit(events.scheduled),
    requirement: () => {
      const { pass } = assert([regionIsMined(regionCoord, context), playerControlsRegion(regionCoord, context)]);
      return pass;
    },
    process: async () => {
      emit && emit(events.started);
      const dungeonHeartTiles = regionCoordToCenterTileCoords(regionCoord);
      const packedDungeonHeart: BigNumber = packCoords(dungeonHeartTiles);

      let submitStart: number;
      let confirmStart: number;

      const { submitted, confirmed } = txExecutor.makeRequest({
        txId: v4(),
        actionId,
        onBalanceTooLow: () => net.getFunds(),
        genTransaction: async (nonce, _) => {
          return net.contracts.dungeonFacet.claimDungeonHeart(packedDungeonHeart, {
            nonce,
            ...net.ethersOverrides,
            ...net.ethersOverridesPerTxType[TxType.ClaimDungeonHeart],
          });
        },
        onSubmitting: () => {
          submitStart = Date.now();
          emit && emit(events.txSubmitting);
          action.setProgress(0.33);
        },
        onSubmitted: () => {
          const submitDuration = Date.now() - submitStart;
          emit && emit(events.txSubmitted);
          movingAverages.txSubmit.addStat(submitDuration);
          confirmStart = Date.now();
          action.setProgress(0.66);
        },
        onConfirmed: () => {
          const confirmDuration = Date.now() - confirmStart;
          emit && emit(events.txConfirmed);
          movingAverages.txConfirm.addStat(confirmDuration);
        },
      });

      try {
        await submitted;
        const receipt = await confirmed;
        if (receipt.status === 0) {
          throw new Error("Reverted");
        }
      } catch (e) {
        emit && emit(events.failed);
        // Rethrow the error to catch it again in the action queue
        throw e;
      }
    },
  });
  return action;
};
