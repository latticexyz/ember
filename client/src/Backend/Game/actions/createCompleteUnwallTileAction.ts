import { ActionCreator } from "./types";
import { Action } from "./Action";
import { WorldCoord, ActionType } from "../../../_types/GlobalTypes";
import { createUnwallTileAction } from "./createUnwallTileAction";
import { getMinimumDelayToCompleteDelayedAction } from "../../Utils/Utils";
import { TileDelayedActionType } from "../../../_types/ContractTypes";

interface CreateCompleteUnwallTileActionData {
  coord: WorldCoord;
  submittedTimestamp: number;
}

export const createCompleteUnwallTileAction: ActionCreator<
  CreateCompleteUnwallTileActionData,
  Action<WorldCoord[] | null>
> = ({ coord, submittedTimestamp }, context) => {
  const action = createUnwallTileAction(
    {
      coord,
      type: ActionType.CompleteUnwallTile,
      requirement: () => {
        const minimumDelay = getMinimumDelayToCompleteDelayedAction(
          { coord, submittedTimestamp, initiator: context.player, delayedActionType: TileDelayedActionType.UNWALL },
          context.extendedDungeon,
          context.player,
          context.constants
        );
        const delay = context.net.predictedChainTime - submittedTimestamp;
        return delay >= minimumDelay;
      },
    },
    context
  );

  return action;
};
