import { ActionCreator } from "./types";
import { Action } from "./Action";
import { WorldCoord, ActionType, } from "../../../_types/GlobalTypes";
import { getActionId } from "../../Utils/Ids";
import { createTileAction } from "./createTileAction";
import { assert } from "./utils";
import { tileIsUnmined } from "./assertions";

interface CreateMineTileActionData {
  coord: WorldCoord;
}

export const createMineTileAction: ActionCreator<CreateMineTileActionData, Action<WorldCoord[] | null>> = (
  { coord },
  context
) => {
  const actionId = getActionId(coord, ActionType.MineTile);

  const mineTileAction = createTileAction(
    {
      actionId,
      type: ActionType.MineTile,
      name: `Mine ${coord.x}/${coord.y}`,
      coord: coord,
      requirement: () => {
        const { pass } = assert([tileIsUnmined(coord, context)]);
        return pass;
      },
    },
    context
  );

  return mineTileAction;
};
