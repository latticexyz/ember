import { ActionCreator } from "./types";
import { Action } from "./Action";
import { WorldCoord, ActionType } from "../../../_types/GlobalTypes";
import { assert } from "./utils";
import { noDelayedActionOnTile } from "./assertions";
import { createWallTileAction } from "./createWallTileAction";
import { TileDelayedActionType } from "../../../_types/ContractTypes";

interface CreateInitiateWallTileActionData {
  coord: WorldCoord;
}

export const createInitiateWallTileAction: ActionCreator<CreateInitiateWallTileActionData, Action<boolean | null>> = (
  { coord },
  context
) => {
  return createWallTileAction(
    {
      requirement: () => {
        const { pass } = assert([noDelayedActionOnTile(coord, TileDelayedActionType.WALL, context)]);
        return pass;
      },
      coord,
      type: ActionType.InitiateWallTile,
    },
    context
  );
};
