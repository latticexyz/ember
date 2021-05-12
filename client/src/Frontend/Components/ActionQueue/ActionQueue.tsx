import React, { useState, useMemo } from "react";
import { useGameManager } from "../../Hooks/useGameManager";
import { observer } from "mobx-react-lite";
import { useEffect } from "react";
import { Action } from "../../../Backend/Game/actions/Action";
import { ActionState } from "../../../_types/GlobalTypes";
import { ActionCard } from "./ActionCard";
import { useCallback } from "react";
import { notNull } from "../../../Backend/Utils/Utils";
import { GameUI } from "../GameUI";
import styled from "styled-components";
import { useActionSteps, ActionStep } from "./useActionSteps";

export const ActionQueue: React.FC = observer(() => {
  const gm = useGameManager();
  const [actions, setActions] = useState<{ [id: string]: Action<any> }>({});
  const actionSteps = useActionSteps();

  const topLevelActionIds = useMemo(
    () =>
      Object.values(actions)
        .filter((action) => !action.parent)
        .map((action) => action.id),
    [actions]
  );

  const sortByStateAndStep = useCallback(
    (actionIds: string[]) => {
      const sortedByStep = actionIds.slice().sort((a, b) => {
        const order = {
          [ActionStep.TxConfirmed]: 0,
          [ActionStep.TxSubmitted]: 1,
          [ActionStep.TxSubmitting]: 2,
          [ActionStep.TxScheduled]: 3,
          [ActionStep.SnarkProving]: 4,
          [ActionStep.SnarkScheduled]: 5,
        };

        if (!actionSteps[a]) return 1;
        if (!actionSteps[b]) return -1;
        return order[actionSteps[a]] < order[actionSteps[b]] ? -1 : 1;
      });
      const sortedByState = sortedByStep.sort((a, b) => {
        const order = {
          [ActionState.Done]: 0,
          [ActionState.Failed]: 1,
          [ActionState.Processing]: 2,
          [ActionState.Queued]: 3,
        };
        const actionA = actions[a];
        const actionB = actions[b];
        if (!actionA) return 1;
        if (!actionB) return -1;
        return order[actionA.state] < order[actionB.state] ? -1 : 1;
      });

      return sortedByState;
    },
    [actionSteps, actions]
  );

  const renderActionCards = useCallback(
    (actionIds: string[]) => {
      if (actionIds.length === 0) return;

      const sortedActionIds = sortByStateAndStep(actionIds);

      return sortedActionIds
        .map((id) => actions[id])
        .filter(notNull)
        .map((action) => {
          return (
            <ActionCard
              action={action}
              step={actionSteps[action.id]}
              key={`ActionCard-${action.id}`}
              onCancel={() => {
                gm?.cancelAction(action.id);
              }}
            >
              {renderActionCards(action.children)}
            </ActionCard>
          );
        });
    },
    [actionSteps, actions, gm, sortByStateAndStep]
  );

  useEffect(() => {
    if (!gm) return;
    const trackAction = (action: Action<any>) => {
      setActions((current) => ({ ...current, [action.id]: action }));
    };

    const removeActionWithDelay = (actionId: string) => {
      setTimeout(() => removeAction(actionId), 2000);
    };

    const removeAction = (actionId: string) => {
      setActions((current) => {
        const { [actionId]: _, ...actions } = current;
        return actions;
      });
    };

    gm?.actionQueue.on(ActionState.Queued, trackAction);
    gm?.actionQueue.on(ActionState.Cancelled, removeAction);
    gm?.actionQueue.on(ActionState.Failed, removeActionWithDelay);
    gm?.actionQueue.on(ActionState.Done, removeActionWithDelay);
    return () => {
      gm?.actionQueue.removeListener(ActionState.Queued, trackAction);
      gm?.actionQueue.removeListener(ActionState.Cancelled, removeAction);
      gm?.actionQueue.removeListener(ActionState.Failed, removeActionWithDelay);
      gm?.actionQueue.removeListener(ActionState.Done, removeActionWithDelay);
    };
  }, [gm]);

  return (
    <GameUI>
      <Container>{renderActionCards(topLevelActionIds)}</Container>
    </GameUI>
  );
});

const Container = styled.div`
  display: inline-block;
  max-height: 600px;
  overflow: auto;
  text-align: right;
  margin-top: 8px;
`;
