import React, { useState, useEffect, useRef } from "react";
import { Action } from "../../../Backend/Game/actions/Action";
import { observer } from "mobx-react-lite";
import styled from "styled-components";
import { colors, fonts } from "../../../theme";
import { useMemo } from "react";
import { ActionState, ActionType } from "../../../_types/GlobalTypes";
import { isOverGameUI } from "../../Utils/Utils";
import { UIManager } from "../../UIManager";
import { ActionStep } from "./useActionSteps";
import { CircularProgress } from "../CircularProgress";

export const ActionCard: React.FC<{
  action: Action<any>;
  onCancel: () => void;
  step?: ActionStep;
}> = observer(({ action, children, onCancel, step }) => {
  const [expanded, setExpanded] = useState(false);
  const actionRowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return () => {
      setTimeout(() => {
        if (!isOverGameUI()) {
          UIManager.getInstance().leaveReact();
        }
      }, 100);
    };
  }, []);

  const tag = useMemo(() => {
    if (step) return step;
    return action.state;
  }, [action.state, step]);

  const cancellable = useMemo(() => {
    // TODO: Remove the next if statement once cancelling delayed actions is supported by the contract
    if ([ActionType.CompleteForceMineTile, ActionType.CompleteUnwallTile].includes(action.type)) {
      return false;
    }
    return !([ActionState.Done, ActionState.Failed].includes(action.state) || Boolean(step));
  }, [action.state, step]);

  useEffect(() => {
    if (!actionRowRef.current) return;
    const currentWidth = actionRowRef.current.clientWidth;
    actionRowRef.current.style.minWidth = `${currentWidth}px`;
  }, [action.state, step, action.name]);

  return (
    <Container>
      <ActionRow ref={actionRowRef}>
        <Inner onClick={children ? () => setExpanded(!expanded) : undefined}>
          <LoadingBarBox>
            <CircularProgress progress={action.progress} />
          </LoadingBarBox>
          <ActionTitle clickable={Boolean(children)}>{action.name}</ActionTitle>

          <Tag state={action.state} step={step}>
            {tag}
          </Tag>
        </Inner>
        <CancelButton onClick={cancellable ? onCancel : undefined} clickable={cancellable}>
          x
        </CancelButton>
      </ActionRow>
      {children && expanded && (
        <ChildrenOuter>
          <ChildrenBackground>
            <Children>{children}</Children>
          </ChildrenBackground>
        </ChildrenOuter>
      )}
    </Container>
  );
});

const Container = styled.div`
  margin: 0 0 4px 0;
  user-select: none;
  border-radius: 3px;
  overflow: hidden;
`;

const ActionRow = styled.div`
  display: grid;
  grid-template-columns: 1fr auto;
`;

const CancelButton = styled.div<{ clickable?: boolean }>`
  background-color: ${colors.darkgray};
  z-index: 1;
  color: ${colors.white};
  font-family: ${fonts.regular};
  padding-left: 13px;
  margin-left: -10px;
  padding-right: 3px;
  font-size: 12px;
  line-height: 22px;
  transition: all 200ms ease;
  border-radius: 3px;

  ${(p) =>
    p.clickable
      ? `
  cursor: pointer;
  :hover {
    background-color: ${colors.red};
  }
  :active {
    opacity: 0.6;
  }
  `
      : `
  color: ${colors.greyed};
      `}
`;

const Inner = styled.div`
  display: grid;
  background-color: ${colors.almostblack};
  grid-gap: 4px;
  align-items: center;
  border-radius: 3px;
  z-index: 2;
  grid-template-columns: auto auto 1fr;
  justify-items: end;
  padding: 4px;
`;

const Tag = styled.div<{ state: ActionState; step?: ActionStep }>`
  font-family: ${fonts.regular};
  font-size: 9px;
  border-radius: 2px;
  color: ${colors.lightgray};
  background-color: ${(p) => actionToColor(p.state, p.step)};
  padding: 2px 3px;
`;

const LoadingBarBox = styled.div`
  padding: 0 3px;
`;

const ActionTitle = styled.div<{ clickable?: boolean }>`
  font-family: ${fonts.regular};
  font-size: 11px;
  color: ${colors.defaultText};
  border-radius: 2px;
  display: inline-block;
  align-items: center;

  ${(p) =>
    p.clickable
      ? `
  font-weight: bold;
  cursor: pointer;

  :hover {
    opacity: 0.9;
  }

  :active {
    opacity: 0.8;
  }
  `
      : ""}
`;

const Children = styled.div`
  margin: 4px 0 0 4px;
  border-left: 2px solid ${colors.darkgray};
  border-radius: 4px;
  padding: 0 4px;
`;

const ChildrenOuter = styled.div`
  display: grid;
  justify-content: end;
`;

const ChildrenBackground = styled.div`
  background-color: ${colors.almostblack};
  border-radius: 4px;
`;

function actionToColor(state?: ActionState, step?: ActionStep) {
  if (state === ActionState.Failed) {
    return colors.failed;
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
  if (state === ActionState.Processing) {
    return colors.processing;
  }
  if (state === ActionState.Done) {
    return colors.done;
  }
  if (state === ActionState.Queued) {
    return colors.queued;
  }

  return colors.darkgray;
}
