import { ActionCreator } from "./types";
import { Action } from "./Action";
import { WorldCoord, ActionType } from "../../../_types/GlobalTypes";
import { createForceMineTileAction } from "./createForceMineTileAction";
import { getMinimumDelayToCompleteDelayedAction } from "../../Utils/Utils";
import { TileDelayedActionType } from "../../../_types/ContractTypes";

interface CreateCompleteForceMineTileActionData {
  coord: WorldCoord;
  submittedTimestamp: number;
}

export const createCompleteForceMineTileAction: ActionCreator<
  CreateCompleteForceMineTileActionData,
  Action<WorldCoord[] | null>
> = ({ coord, submittedTimestamp }, context) => {
  const action = createForceMineTileAction(
    {
      coord,
      type: ActionType.CompleteForceMineTile,
      requirement: () => {
        const minimumDelay = getMinimumDelayToCompleteDelayedAction(
          { coord, submittedTimestamp, initiator: context.player, delayedActionType: TileDelayedActionType.FORCE_MINE },
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
