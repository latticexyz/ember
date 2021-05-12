import { ActionCreator } from "./types";
import { Action } from "./Action";
import { WorldCoord, ActionType } from "../../../_types/GlobalTypes";
import { getActionId } from "../../Utils/Ids";
import { createTileAction } from "./createTileAction";
import { assert } from "./utils";
import { tileIsMined, tileIsNotOwnedByPlayer } from "./assertions";

interface CreateClaimTileActionData {
  coord: WorldCoord;
}

export const createClaimTileAction: ActionCreator<CreateClaimTileActionData, Action<WorldCoord[] | null>> = (
  { coord },
  context
) => {
  const actionId = getActionId(coord, ActionType.ClaimTile);

  const claimTileAction = createTileAction(
    {
      actionId,
      type: ActionType.ClaimTile,
      name: `Claim ${coord.x}/${coord.y}`,
      coord: coord,
      requirement: () => {
        const { pass } = assert([tileIsMined(coord, context), tileIsNotOwnedByPlayer(coord, context)]);
        return pass;
      },
    },
    context
  );

  return claimTileAction;
};
