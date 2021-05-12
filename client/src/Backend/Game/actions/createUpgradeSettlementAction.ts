import { Action } from "./Action";
import { ActionType, WorldCoord, TxType, ActionState, ResourceType } from "../../../_types/GlobalTypes";
import { v4 } from "uuid";
import { ActionCreator } from "./types";
import { getActionId } from "../../Utils/Ids";
import { actionEvents } from "./events";
import { coordToId } from "../../Utils/PackedCoords";
import { Resource } from "../../../_types/ContractTypes";

interface CreateUpgradeSettlementData {
  regionCoord: WorldCoord;
}

export const createUpgradeSettlementAction: ActionCreator<CreateUpgradeSettlementData, Action<boolean | null>> = (
  { regionCoord },
  context
) => {
  const { emit, txExecutor, net, movingAverages, extendedDungeon, constants, player } = context;

  const actionId = getActionId(regionCoord, ActionType.UpgradeSettlement);
  const events = actionEvents[ActionType.UpgradeSettlement];
  const settlement = extendedDungeon.settlements.get(regionCoord);
  if (!settlement) {
    throw new Error("no settlement on this region");
  }
  const numberOfSettlementsOwnerByPlayer = [...extendedDungeon.settlements.values()].filter(
    (s) => s.owner === player
  ).length;
  const priceIncrease =
    constants.gameConstants.SETTLEMENT_PRICE_PERCENT_INCREASE_PER_UNIT[numberOfSettlementsOwnerByPlayer - 1] / 100;
  const goldCost = Math.floor(
    priceIncrease * constants.gameConstants.SETTLEMENT_PRICE_PER_LEVEL[settlement.level + 1][Resource.GOLD]
  );
  const soulCost = Math.floor(
    priceIncrease * constants.gameConstants.SETTLEMENT_PRICE_PER_LEVEL[settlement.level + 1][Resource.SOULS]
  );

  const action = new Action({
    id: actionId,
    type: ActionType.UpgradeSettlement,
    name: `Upgrade Settlement`,
    costByResource: {
      [ResourceType.Gold]: goldCost,
      [ResourceType.Soul]: soulCost,
    },
    onStateChange: (state) => state === ActionState.Queued && emit && emit(events.scheduled),
    requirement: () => {
      const goldBalance = extendedDungeon.players.get(player)?.gold;
      const soulsBalance = extendedDungeon.players.get(player)?.souls;

      if (goldBalance != null && soulsBalance != null && (goldBalance < goldCost || soulsBalance < soulCost)) {
        return false;
      }
      return true;
    },
    process: async () => {
      emit && emit(events.started);

      let submitStart: number;
      let confirmStart: number;

      const { submitted, confirmed } = txExecutor.makeRequest({
        txId: v4(),
        actionId,
        onBalanceTooLow: () => net.getFunds(),
        genTransaction: async (nonce, _) => {
          return net.contracts.settlementFacet.upgradeSettlement(coordToId(regionCoord), {
            nonce,
            ...net.ethersOverrides,
            ...net.ethersOverridesPerTxType[TxType.UpgradeSettlement],
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
