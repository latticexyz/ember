import { Action } from "./Action";
import { ActionState, DungeonEvent } from "../../../_types/GlobalTypes";
import { ActionType, WorldCoord, TxType, Region } from "../../../_types/GlobalTypes";
import { v4 } from "uuid";
import { ActionCreator } from "./types";
import { DungeonFacetEvent } from "../../../_types/ContractTypes";
import { assert } from "./utils";
import { playerIsInitialized, regionIsMined, playerControlsRegion } from "./assertions";
import { getActionId } from "../../Utils/Ids";
import { actionEvents } from "./events";
import { coordToId } from "../../Utils/PackedCoords";

interface CreateClaimResourcesData {
  regionCoord: WorldCoord;
}

export const createClaimResourcesAction: ActionCreator<CreateClaimResourcesData, Action<boolean | null>> = (
  { regionCoord },
  context
) => {
  const { extendedDungeon: extendedDungeon, emit, txExecutor, net, movingAverages, player, constants } = context;

  const actionId = getActionId(regionCoord, ActionType.ClaimResources);
  const events = actionEvents[ActionType.ClaimResources];

  const action = new Action({
    id: actionId,
    type: ActionType.ClaimResources,
    name: `Claiming region resources ${regionCoord.x}/${regionCoord.y}`,
    onStateChange: (state) => emit && state === ActionState.Queued && emit(events.scheduled),
    requirement: () => {
      const { pass } = assert([regionIsMined(regionCoord, context), playerControlsRegion(regionCoord, context)]);
      return pass;
    },
    process: async () => {
      emit && emit(events.started, regionCoord);
      const regionId = coordToId(regionCoord);

      let submitStart: number;
      let confirmStart: number;

      const { submitted, confirmed } = txExecutor.makeRequest({
        txId: v4(),
        actionId,
        onBalanceTooLow: () => net.getFunds(),
        genTransaction: async (nonce, _) => {
          return net.contracts.dungeonFacet.claimResourcesOnRegion(regionId, {
            nonce,
            ...net.ethersOverrides,
            ...net.ethersOverridesPerTxType[TxType.ClaimResourcesOnRegion],
          });
        },
        onSubmitting: () => {
          submitStart = Date.now();
          emit && emit(events.txSubmitting, regionCoord);
          action.setProgress(0.33);
        },
        onSubmitted: () => {
          const submitDuration = Date.now() - submitStart;
          emit && emit(events.txSubmitted, regionCoord);
          movingAverages.txSubmit.addStat(submitDuration);
          confirmStart = Date.now();
          action.setProgress(0.66);
        },
        onConfirmed: () => {
          const confirmDuration = Date.now() - confirmStart;
          emit && emit(events.txConfirmed, regionCoord);
          movingAverages.txConfirm.addStat(confirmDuration);
        },
      });

      try {
        await submitted;
        const receipt = await confirmed;
        if (receipt.status === 0) {
          throw new Error("Reverted");
        }

        // Optimistic Update
        const oldRegion = extendedDungeon.regions.get(regionCoord);
        const oldPlayer = extendedDungeon.players.get(player);

        if (oldRegion && oldPlayer) {
          const soulsClaimed = Math.min(oldPlayer.maxSouls - oldPlayer.souls, oldRegion.souls);
          const goldClaimed = Math.min(oldPlayer.maxGold - oldPlayer.gold, oldRegion.gold);
          const region: Region = {
            ...oldRegion,
            souls: oldRegion.souls - soulsClaimed,
            gold: oldRegion.gold - goldClaimed,
          };
          extendedDungeon.setPlayer(player, {
            ...oldPlayer,
            souls: oldPlayer.souls + soulsClaimed,
            gold: oldPlayer.gold + goldClaimed,
          });
          extendedDungeon.setRegion(regionCoord, region);
          extendedDungeon.emit(DungeonEvent.RegionUpdated, region, regionCoord);
        }
      } catch (e) {
        emit && emit(events.failed, regionCoord);
        // Rethrow the error to catch it again in the action queue
        throw e;
      }
    },
  });

  return action;
};
