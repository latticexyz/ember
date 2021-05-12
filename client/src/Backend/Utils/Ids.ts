import { WorldCoord, ActionType } from "../../_types/GlobalTypes";
import { Action } from "../Game/actions/Action";

const DELIMITER = "/";

export function getActionId(coord: WorldCoord, type: ActionType) {
  return `${type}${DELIMITER}${coord.x}${DELIMITER}${coord.y}`;
}

export function getActionIdFromCoordGroup(coords: WorldCoord[], type: ActionType) {
  return `${type}${coords.reduce((acc, curr) => acc + DELIMITER + curr.x + DELIMITER + curr.y, "")}`;
}

export function getCoordsFromActionId(actionId: string) {
  const fragments = actionId.split(DELIMITER);
  return { x: Number(fragments[1]), y: Number(fragments[2]) };
}

export function getCreatureIdsFromActionId(actionId: string) {
  return actionId.split("/");
}

export function getActionIdFromCreatureIds(creatureIds: string[]) {
  return creatureIds.join("/");
}

export function getMetaActionId(actions: Action<any>[]): string {
  return `${ActionType.Meta}-${actions.map((action) => action.id).join("%")}`;
}
