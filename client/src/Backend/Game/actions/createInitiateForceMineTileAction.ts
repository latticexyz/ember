import { ActionCreator } from "./types";
import { Action } from "./Action";
import { WorldCoord, ActionType } from "../../../_types/GlobalTypes";
import { assert } from "./utils";
import { noDelayedActionOnTile } from "./assertions";
import { TileDelayedActionType } from "../../../_types/ContractTypes";
import { createForceMineTileAction } from "./createForceMineTileAction";

interface CreateInitiateForceMineTileActionData {
  coord: WorldCoord;
}

export const createInitiateForceMineTileAction: ActionCreator<
  CreateInitiateForceMineTileActionData,
  Action<WorldCoord[] | null>
> = ({ coord }, context) => {
  const action = createForceMineTileAction(
    {
      requirement: () => {
        const { pass } = assert([noDelayedActionOnTile(coord, TileDelayedActionType.FORCE_MINE, context)]);
        return pass;
      },
      coord,
      type: ActionType.InitiateForceMineTile,
    },
    context
  );

  return action;
};
