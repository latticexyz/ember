import { useState, useEffect } from "react";
import { useGameManager } from "../../Hooks/useGameManager";
import { TxExecutorEvent, SnarkEvent, ActionState } from "../../../_types/GlobalTypes";

export enum ActionStep {
  SnarkScheduled = "snark scheduled",
  SnarkProving = "snark proving",
  TxScheduled = "tx scheduled",
  TxSubmitting = "tx submitting",
  TxSubmitted = "tx submitted",
  TxConfirmed = "tx confirmed",
}

interface ActionSteps {
  [actionId: string]: ActionStep;
}

interface EventListener<T> {
  eventName: T;
  listener: (...props: any[]) => any;
}

export function useActionSteps(): ActionSteps {
  const [actionSteps, setActionSteps] = useState<ActionSteps>({});
  const gm = useGameManager();

  const setActionStep = (actionId: string, step: ActionStep) => {
    setActionSteps((current) => ({ ...current, [actionId]: step }));
  };

  const removeActionStep = (actionId: string) => {
    setActionSteps(({ [actionId]: _, ...rest }) => rest);
  };

  useEffect(() => {
    if (!gm) return;

    const actionListeners: EventListener<ActionState>[] = [
      {
        eventName: ActionState.Done,
        listener: removeActionStep,
      },
      {
        eventName: ActionState.Failed,
        listener: removeActionStep,
      },
      {
        eventName: ActionState.Cancelled,
        listener: removeActionStep,
      },
    ];

    const txListeners: EventListener<TxExecutorEvent>[] = [
      {
        eventName: TxExecutorEvent.TxScheduled,
        listener: (_, actionId) => setActionStep(actionId, ActionStep.TxScheduled),
      },
      {
        eventName: TxExecutorEvent.TxSubmitting,
        listener: (_, actionId) => setActionStep(actionId, ActionStep.TxSubmitting),
      },
      {
        eventName: TxExecutorEvent.TxSubmitted,
        listener: (_, actionId) => setActionStep(actionId, ActionStep.TxSubmitted),
      },
      {
        eventName: TxExecutorEvent.TxConfirmed,
        listener: (_, actionId) => setActionStep(actionId, ActionStep.TxConfirmed),
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
  }, [gm]);

  return actionSteps;
}
