import { ActionCreator } from "./types";
import { Action } from "./Action";
import { WorldCoord, ActionType, TxType, PlayerStatus } from "../../../_types/GlobalTypes";
import { v4 } from "uuid";
import { assert } from "./utils";
import { playerIsWhitelisted } from "./assertions";
import { actionEvents } from "./events";
import { coordToId } from "../../Utils/PackedCoords";

interface SpecialRegionActionData {
  regionCoord: WorldCoord;
}

export const createSpecialRegionAction: ActionCreator<SpecialRegionActionData, Action<WorldCoord[] | null>> = (
  { regionCoord },
  context
) => {
  const { emit, movingAverages, txExecutor, net, player } = context;
  const { pass, error } = assert([playerIsWhitelisted(context)]);
  if (!pass) throw new Error(error);

  const actionId = v4();
  const events = actionEvents[ActionType.InitPlayer];

  return new Action({
    id: actionId,
    type: ActionType.InitPlayer,
    name: "Initialize",
    process: async () => {
      try {
        emit && emit(events.started, player, regionCoord);

        const { submitted, confirmed } = txExecutor.makeRequest({
          txId: v4(),
          actionId,
          onBalanceTooLow: () => net.getFunds(),
          genTransaction: async (nonce, _) => {
            return net.contracts.dungeonFacet.initializePlayer(coordToId(regionCoord), {
              nonce,
              ...net.ethersOverrides,
              ...net.ethersOverridesPerTxType[TxType.InitializePlayer],
            });
          },
        });

        const submitStart = Date.now();
        await submitted;
        const submitDuration = Date.now() - submitStart;
        movingAverages.txSubmit.addStat(submitDuration);

        emit && emit(events.txSubmitted, player, regionCoord);

        const confirmStart = Date.now();
        const receipt = await confirmed;
        if (receipt.status === 0) {
          throw new Error("Reverted");
        }
        const confirmDuration = Date.now() - confirmStart;
        movingAverages.txConfirm.addStat(confirmDuration);

        emit && emit(events.txConfirmed, player, regionCoord);

        context.setPlayerStatus(PlayerStatus.INITIALIZED);
      } catch (e) {
        console.error(e);
        emit && emit(events.failed, String(e));
      }
    },
  });
};
