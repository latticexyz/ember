import { ActionCreator } from "./types";
import { Action } from "./Action";
import { ActionType, ActionState } from "../../../_types/GlobalTypes";
import { getMetaActionId } from "../../Utils/Ids";
import { notNull } from "../../Utils/Utils";

interface ActionGraph {
  actions: Action<any>[];
  next?: ActionGraph[];
}

interface CreateMetaActionData {
  actionGraph: ActionGraph;
  requirement?: () => boolean;
  name?: string;
}

function countActions({ actions, next }: ActionGraph): number {
  const nextLength = next
    ? next.reduce<number>((sum, actionGraph) => {
      return sum + countActions(actionGraph);
    }, 0)
    : 0;
  return actions.length + nextLength;
}

export const createMetaAction: ActionCreator<CreateMetaActionData, Action<boolean>> = (
  { actionGraph, requirement, name = "MetaAction" },
  { actionQueue }
) => {
  const metaActionId = getMetaActionId(actionGraph.actions);
  const numActions = countActions(actionGraph);
  const metaAction = new Action({
    type: ActionType.Meta,
    id: metaActionId,
    name,
    ignoreConcurrency: true,
    requirement,
    process: async () => {
      let processed = 0;
      let processing = 0;
      let done: () => void;
      const promise = new Promise<void>((resolve) => (done = resolve));

      async function processNext({ actions, next }: ActionGraph) {
        processing++;
        const actionsDone = actions
          .map(async (action) => {
            action.parent = metaActionId;
            if (!actionQueue.add(action)) return null;
            await action.done;
            processed++;
            metaAction.setProgress(processed / numActions);
          })
          .filter(notNull);

        metaAction.addChildren(actions.map((action) => action.id));

        await Promise.all(actionsDone);

        if (next) {
          for (const actionGraph of next) {
            processNext(actionGraph);
          }
        }
        processing--;
        if (processing === 0) done();
      }

      processNext(actionGraph);
      return promise;
    },
  });

  return metaAction;
};
