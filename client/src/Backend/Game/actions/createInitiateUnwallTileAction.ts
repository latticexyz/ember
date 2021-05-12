import { ActionCreator } from "./types";
import { Action } from "./Action";
import { WorldCoord, ActionType } from "../../../_types/GlobalTypes";
import { assert } from "./utils";
import { noDelayedActionOnTile } from "./assertions";
import { createUnwallTileAction } from "./createUnwallTileAction";
import { TileDelayedActionType } from "../../../_types/ContractTypes";

interface CreateInitiateUnwallTileActionData {
  coord: WorldCoord;
}

export const createInitiateUnwallTileAction: ActionCreator<
  CreateInitiateUnwallTileActionData,
  Action<WorldCoord[] | null>
> = ({ coord }, context) => {
  const action = createUnwallTileAction(
    {
      requirement: () => {
        const { pass } = assert([noDelayedActionOnTile(coord, TileDelayedActionType.UNWALL, context)]);
        return pass;
      },
      coord,
      type: ActionType.InitiateUnwallTile,
    },
    context
  );

  return action;
};
