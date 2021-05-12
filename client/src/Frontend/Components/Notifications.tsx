import React, { useState, useEffect } from "react";
import styled from "styled-components";
import { GameUI } from "./GameUI";
import { NotificationType, Notification } from "../NotificationManager";
import { colors } from "../../theme";
import { Text } from "./Common/Text";
import { useNotificationState } from "../Hooks/useNotificationState";
import { observer } from "mobx-react-lite";
import { isOverGameUI } from "../Utils/Utils";
import { UIManager } from "../UIManager";

export const Notifications: React.FC = observer(() => {
  const state = useNotificationState();
  const [expand, setExpand] = useState(false);

  return (
    <GameUI styled={false}>
      <Container onMouseEnter={() => setExpand(true)} onMouseLeave={() => setExpand(false)}>
        {state.notifications
          .filter((_, index) => expand || index === 0)
          .map((notification) => (
            <NotificationElement {...notification} />
          ))}
      </Container>
    </GameUI>
  );
});

const NotificationElement = ({ id, type, stale, text, onAction }: Notification) => {
  const state = useNotificationState();
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
    <NotificationContainer key={id} type={type} stale={stale}>
      {onAction ? (
        <NotificationButton onClick={onAction}>{text}</NotificationButton>
      ) : (
        <NotificationDetail>{text}</NotificationDetail>
      )}
      <NotificationButton onClick={() => state.removeNotification(id)}>x</NotificationButton>
    </NotificationContainer>
  );
};

const Container = styled.div`
  height: 100px;
`;

const NotificationDetail = styled.div`
  display: inline-block;
  padding: 3px;
  margin: 3px;
  border-radius: 2px;
  background-color: rgb(255 255 255 / 18%);
`;

const NotificationButton = styled(NotificationDetail)`
  cursor: pointer;

  :hover {
    background-color: rgb(255 255 255 / 25%);
  }

  :active {
    background-color: rgb(255 255 255 / 33%);
  }
`;

const NotificationContainer = styled(Text)<{
  type?: NotificationType;
  stale?: boolean;
}>`
  background-color: ${(p) => typeToColor(p.type)};
  margin: 2px 0;
  padding: 2px;
  border-radius: 3px;
  display: block;
  font-size: 12px;
  transition: opacity 500ms ease;
  ${(p) => (p.stale ? "opacity: 0.5;" : "")}
  :hover {
    opacity: 1;
  }
`;

function typeToColor(nType?: NotificationType) {
  if (nType === NotificationType.Info) {
    // return colors.lightgray;
  }

  if (nType === NotificationType.Warning) {
    return colors.warning;
  }

  if (nType === NotificationType.Critical) {
    return colors.invalid;
  }

  return "rgb(10 10 10/ 10%)";
}
