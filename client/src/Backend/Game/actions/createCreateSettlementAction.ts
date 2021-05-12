import { Action } from "./Action";
import { ActionType, WorldCoord, TxType, ActionState, ResourceType } from "../../../_types/GlobalTypes";
import { v4 } from "uuid";
import { ActionCreator } from "./types";
import { getActionId } from "../../Utils/Ids";
import { actionEvents } from "./events";
import { coordToId } from "../../Utils/PackedCoords";
import { CreatureSpecies, Resource } from "../../../_types/ContractTypes";

interface CreateCreateSettlementData {
  regionCoord: WorldCoord;
}

export const createCreateSettlementAction: ActionCreator<CreateCreateSettlementData, Action<boolean | null>> = (
  { regionCoord },
  context
) => {
  const { emit, txExecutor, net, movingAverages, extendedDungeon, constants, player } = context;

  const actionId = getActionId(regionCoord, ActionType.CreateSettlement);
  const events = actionEvents[ActionType.CreateSettlement];
  const numberOfSettlementsOwnedByPlayer = [...extendedDungeon.settlements.values()].filter(
    (s) => s.owner === player
  ).length;
  const priceIncrease =
    constants.gameConstants.SETTLEMENT_PRICE_PERCENT_INCREASE_PER_UNIT[numberOfSettlementsOwnedByPlayer - 1] / 100;
  const goldCost = Math.floor(priceIncrease * constants.gameConstants.SETTLEMENT_PRICE_PER_LEVEL[0][Resource.GOLD]);
  const soulCost = Math.floor(priceIncrease * constants.gameConstants.SETTLEMENT_PRICE_PER_LEVEL[0][Resource.SOULS]);
  const MAX_NUMBER_OF_SETTLEMENTS = constants.gameConstants.SETTLEMENT_PRICE_PERCENT_INCREASE_PER_UNIT.length;

  const action = new Action({
    id: actionId,
    type: ActionType.CreateSettlement,
    name: `Create Settlement`,
    costByResource: {
      [ResourceType.Gold]: goldCost,
      [ResourceType.Soul]: soulCost,
    },
    onStateChange: (state) => state === ActionState.Queued && emit && emit(events.scheduled),
    requirement: () => {
      const goldBalance = extendedDungeon.players.get(player)?.gold;
      const soulsBalance = extendedDungeon.players.get(player)?.souls;
      const creaturesInRegion = extendedDungeon.getCreaturesInRegion(regionCoord);
      if (!creaturesInRegion.find((c) => c.species === CreatureSpecies.HERO && c.owner === player)) {
        return false;
      }

      if (
        goldBalance != null &&
        soulsBalance != null &&
        (goldBalance < goldCost || soulsBalance < soulCost) &&
        numberOfSettlementsOwnedByPlayer < MAX_NUMBER_OF_SETTLEMENTS
      ) {
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
          return net.contracts.settlementFacet.createSettlement(coordToId(regionCoord), {
            nonce,
            ...net.ethersOverrides,
            ...net.ethersOverridesPerTxType[TxType.CreateSettlement],
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
