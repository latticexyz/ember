import React, { useState, useMemo, useEffect, useCallback } from "react";
import GameManager from "../../Backend/Game/GameManager";
import { TxExecutorEvent, ActionState, ActionType, SnarkEvent } from "../../_types/GlobalTypes";
import styled from "styled-components";
import { Text } from "./Common/Text";
import { Timer } from "./Timer";
import { colors } from "../../theme";
import { GameUI } from "./GameUI";
import { UIManager } from "../UIManager";
import { isOverGameUI } from "../Utils/Utils";

export enum ActionStep {
  SnarkScheduled = "SnarkScheduled",
  SnarkProving = "SnarkProving",
  TxScheduled = "TxScheduled",
  TxSubmitting = "TxSubmitting",
  TxSubmitted = "TxSubmitted",
  TxConfirmed = "TxConfirmed",
}

export interface ActionData {
  state: ActionState;
  step?: ActionStep;
  id: string;
  title?: string;
  createdAt: number;
  name: string;
}

const ActionTitles = {
  [ActionType.MineTile]: "mine tile",
  [ActionType.InitPlayer]: "init player",
};

const ActionStepText = {
  [ActionStep.SnarkScheduled]: "snark scheduled",
  [ActionStep.SnarkProving]: "snark proving",
  [ActionStep.TxScheduled]: "tx scheduled",
  [ActionStep.TxSubmitting]: "tx submitting",
  [ActionStep.TxSubmitted]: "tx submitted",
  [ActionStep.TxConfirmed]: "tx confirmed",
};

interface EventListener<T> {
  eventName: T;
  listener: (...props: any[]) => any;
}

type Actions = { [id: string]: ActionData };

const FADE_DELAY = 3000;
const VISIBLE_ACTION_LIMIT = 10;

export const ActionQueue: React.FC = () => {
  const [actions, setActions] = useState<Actions>({});
  const [visibleActionLimit, setVisibleActionLimit] = useState<number | undefined>(VISIBLE_ACTION_LIMIT);

  const orderedActions = useMemo(() => {
    const unorderedActions = Object.values(actions);
    const sortedByState = unorderedActions.sort((a, b) => {
      const order = {
        [ActionState.Done]: 0,
        [ActionState.Failed]: 1,
        [ActionState.Processing]: 2,
        [ActionState.Queued]: 3,
      };
      return order[a.state] < order[b.state] ? -1 : 1;
    });

    const sortedByStep = sortedByState.sort((a, b) => {
      const order = {
        [ActionStep.TxConfirmed]: 0,
        [ActionStep.TxSubmitted]: 1,
        [ActionStep.TxSubmitting]: 2,
        [ActionStep.TxScheduled]: 3,
        [ActionStep.SnarkProving]: 4,
        [ActionStep.SnarkScheduled]: 5,
      };

      if (!a.step) return 1;
      if (!b.step) return -1;
      return order[a.step] < order[b.step] ? -1 : 1;
    });

    return sortedByStep;
  }, [actions]);

  const gm = useMemo(() => GameManager.getInstance(), []);

  const removeEvent = (actionId: string) => {
    setActions((prevActions) => {
      const { [actionId]: _, ...newActions } = prevActions;
      return newActions;
    });
  };

  const queueEvent = useCallback((action: Partial<ActionData> & { id: string }) => {
    const { id, state } = action;
    setActions((prevActions) => {
      const prevAction = prevActions[id];
      return {
        ...prevActions,
        [id]: { ...(prevAction || {}), ...action },
      };
    });

    if (state === ActionState.Done || state === ActionState.Failed) {
      setTimeout(() => removeEvent(id), FADE_DELAY);
    }
  }, []);

  useEffect(() => {
    const actionListeners: EventListener<ActionState>[] = [
      {
        eventName: ActionState.Queued,
        listener: (actionId, type, name) => {
          queueEvent({
            id: actionId,
            state: ActionState.Queued,
            title: ActionTitles[type],
            name,
          });
        },
      },
      {
        eventName: ActionState.Processing,
        listener: (actionId) => {
          queueEvent({
            id: actionId,
            state: ActionState.Processing,
            createdAt: Date.now(),
          });
        },
      },
      {
        eventName: ActionState.Done,
        listener: (actionId) => {
          queueEvent({
            id: actionId,
            state: ActionState.Done,
          });
        },
      },
      {
        eventName: ActionState.Failed,
        listener: (actionId) => {
          queueEvent({
            id: actionId,
            state: ActionState.Failed,
          });
        },
      },
      {
        eventName: ActionState.Cancelled,
        listener: removeEvent,
      },
    ];

    const txListeners: EventListener<TxExecutorEvent>[] = [
      {
        eventName: TxExecutorEvent.TxScheduled,
        listener: (_, actionId) =>
          queueEvent({
            id: actionId,
            step: ActionStep.TxScheduled,
          }),
      },
      {
        eventName: TxExecutorEvent.TxSubmitting,
        listener: (_, actionId) =>
          queueEvent({
            id: actionId,
            step: ActionStep.TxSubmitting,
          }),
      },
      {
        eventName: TxExecutorEvent.TxSubmitted,
        listener: (_, actionId) =>
          queueEvent({
            id: actionId,
            step: ActionStep.TxSubmitted,
          }),
      },
      {
        eventName: TxExecutorEvent.TxConfirmed,
        listener: (_, actionId) =>
          queueEvent({
            id: actionId,
            step: ActionStep.TxConfirmed,
          }),
      },
    ];

    actionListeners.forEach((listener) => gm.actionQueue.addListener(listener.eventName, listener.listener));
    txListeners.forEach((listener) => gm.actionContext.txExecutor.addListener(listener.eventName, listener.listener));

    return () => {
      actionListeners.forEach((listener) => gm.actionQueue.removeListener(listener.eventName, listener.listener));
      txListeners.forEach((listener) =>
        gm.actionContext.txExecutor.removeListener(listener.eventName, listener.listener)
      );
    };
  }, [gm.actionContext.txExecutor, gm.actionQueue, queueEvent]);

  return (
    <ActionQueueList
      actions={orderedActions}
      limit={visibleActionLimit}
      onMouseEnter={() => {
        setVisibleActionLimit(undefined);
      }}
      onMouseLeave={() => {
        setVisibleActionLimit(VISIBLE_ACTION_LIMIT);
      }}
      onCancel={gm.cancelAction.bind(gm)}
    />
  );
};

export const ActionQueueList: React.FC<{
  actions: ActionData[];
  limit?: number;
  onMouseEnter?: () => any;
  onMouseLeave?: () => any;
  onCancel?: (actionId: string) => void;
}> = ({ actions, limit, onMouseEnter, onMouseLeave, onCancel }) => {
  return (
    <GameUI>
      <ActionQueueListContainer onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
        {actions.slice(0, limit).map((action, index) => {
          const isFirstProcessing =
            action.state === ActionState.Processing &&
            (index === 0 || actions[index - 1].state != ActionState.Processing);
          const isLastProcessing =
            action.state === ActionState.Processing &&
            (index === actions.length - 1 || actions[index + 1].state != ActionState.Processing);

          return (
            <Action
              key={"action-" + index}
              action={action}
              first={isFirstProcessing}
              last={isLastProcessing}
              limit={limit}
              index={index}
              // TODO: "this" is undefined
              onCancel={() => onCancel && onCancel(action.id)}
            />
          );
        })}
      </ActionQueueListContainer>
    </GameUI>
  );
};

function getActionText(state?: ActionState, step?: ActionStep) {
  if (state === ActionState.Failed) {
    return "failed";
  }
  if (step) {
    return ActionStepText[step];
  }
  if (state === ActionState.Queued) {
    return "planned";
  }
  if (state === ActionState.Processing) {
    return "processing";
  }

  return "done";
}

function getActionTimer(state?: ActionState, createdAt?: number) {
  if (createdAt && state !== ActionState.Failed && state !== ActionState.Queued && state !== ActionState.Done) {
    return <ActionDetail>{<Timer start={createdAt} />}</ActionDetail>;
  }
}

const Action: React.FC<{
  action: ActionData;
  first?: boolean;
  last?: boolean;
  limit?: number;
  index?: number;
  onCancel?: () => void;
}> = React.memo(({ action: { id, state, step, title, createdAt, name }, first, last, limit, index, onCancel }) => {
  useEffect(() => {
    return () => {
      setTimeout(() => {
        if (!isOverGameUI()) {
          UIManager.getInstance().leaveReact();
        }
      }, 100);
    };
  }, []);

  return (
    <div>
      <ActionContainer state={state} step={step} first={first} last={last} limit={limit} index={index}>
        <ActionDetail>{name}</ActionDetail>
        <ActionDetail>{getActionText(state, step)}</ActionDetail>
        {getActionTimer(state, createdAt)}
        {onCancel && <ActionButton onClick={onCancel}>x</ActionButton>}
      </ActionContainer>
    </div>
  );
});

const ActionQueueListContainer = styled.div`
  display: inline-block;
  max-height: 100%;
  overflow: auto;
  text-align: right;
`;

function actionToColor(state?: ActionState, step?: ActionStep) {
  if (state === ActionState.Failed) {
    return colors.invalid;
  }

  if (step === ActionStep.SnarkProving) {
    return colors.snarking;
  }
  if (step === ActionStep.TxScheduled) {
    return colors.txScheduled;
  }
  if (step === ActionStep.TxSubmitting) {
    return colors.txSubmitting;
  }
  if (step === ActionStep.TxSubmitted || step === ActionStep.TxConfirmed) {
    return colors.txConfirming;
  }
  return "rgb(10 10 10/ 75%)";
}

const FADE_INDICES = 5;
const ActionContainer = styled(Text)<{
  first?: boolean;
  last?: boolean;
  state?: ActionState;
  step?: ActionStep;
  limit?: number;
  index?: number;
}>`
  background-color: ${(p) => actionToColor(p.state, p.step)};
  margin: 2px 0;
  padding: 2px;
  border-radius: 3px;
  display: inline-block;
  font-size: 12px;
  user-select: none;
  ${(p) =>
    p.limit && p.index != null && p.index >= p.limit - FADE_INDICES
      ? `opacity: ${(p.limit - p.index) / FADE_INDICES};`
      : ""}
`;

const ActionDetail = styled.div`
  display: inline-block;
  padding: 3px;
  margin: 3px;
  border-radius: 2px;
  background-color: rgb(255 255 255 / 18%);
`;

const ActionButton = styled(ActionDetail)`
  cursor: pointer;

  :hover {
    background-color: rgb(255 255 255 / 25%);
  }

  :active {
    background-color: rgb(255 255 255 / 33%);
  }
`;
