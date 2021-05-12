import { ActionCreator } from "./types";
import { Action } from "./Action";
import { WorldCoord, ActionType } from "../../../_types/GlobalTypes";
import { createWallTileAction } from "./createWallTileAction";
import { getMinimumDelayToCompleteDelayedAction } from "../../Utils/Utils";
import { TileDelayedActionType } from "../../../_types/ContractTypes";

interface CreateCompleteWallTileActionData {
  coord: WorldCoord;
  submittedTimestamp: number;
}

export const createCompleteWallTileAction: ActionCreator<CreateCompleteWallTileActionData, Action<boolean | null>> = (
  { coord, submittedTimestamp },
  context
) => {
  return createWallTileAction(
    {
      coord,
      type: ActionType.CompleteWallTile,
      requirement: () => {
        const minimumDelay = getMinimumDelayToCompleteDelayedAction(
          { coord, submittedTimestamp, initiator: context.player, delayedActionType: TileDelayedActionType.WALL },
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
};
