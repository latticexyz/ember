import React, { useState, useEffect, useCallback } from "react";
import styled from "styled-components";
import { GameUI } from "./GameUI";
import { NotificationType, Notification } from "../NotificationManager";
import { colors } from "../../theme";
import { Text } from "./Common/Text";
import { useNotificationState } from "../Hooks/useNotificationState";
import { observer } from "mobx-react-lite";
import { isOverGameUI, pad } from "../Utils/Utils";
import { UIManager } from "../UIManager";
import { AnimatedText } from "./Common/AnimatedText";

export const NotificationsLog: React.FC = observer(() => {
  const state = useNotificationState();
  const [expand, setExpand] = useState(false);
  const [logged, setLogged] = useState<Notification[]>([]);
  const [toLog, setToLog] = useState<Notification[]>([]);
  const [typing, setTyping] = useState<boolean>(false);
  const [current, setCurrent] = useState<Notification>();
  const [showLog, setShowLog] = useState<boolean>(false);

  // Update todo list if new log comes in
  useEffect(() => {
    if (!showLog && state.notifications.length > 0) {
      setShowLog(true);
    }
    const newToLog = state.notifications.filter((note) => {
      const isLogged = logged.find((n) => n.id === note.id);
      const isPlanned = toLog.find((n) => n.id === note.id);
      if (isLogged || isPlanned) {
        return false;
      }
      return true;
    });
    setToLog([...newToLog, ...toLog]);
    processToLog();
  }, [state.notifications]);

  const processToLog = useCallback(() => {
    if (!typing && toLog.length > 0) {
      setTyping(true);
      const nextToLog = toLog[0];
      setToLog(toLog.slice(1));
      setCurrent(nextToLog);
    }
  }, [toLog, typing]);

  const handleDoneTyping = useCallback(() => {
    setTyping(false);
    setLogged([current!, ...logged]);
    setCurrent(undefined);
  }, [current, logged]);

  useEffect(() => {
    if (!typing) {
      processToLog();
    }
  }, [processToLog, typing]);

  if (!showLog) return <></>;

  return (
    <GameUI styled>
      <Container onMouseEnter={() => setExpand(true)} onMouseLeave={() => setExpand(false)}>
        {current ? <NotificationElement {...current} animated onDoneTyping={handleDoneTyping} /> : null}
        {logged.map((notification) => (
          <NotificationElement {...notification} key={"notification-" + notification.id} />
        ))}
      </Container>
    </GameUI>
  );
});

const NotificationElement = ({
  id,
  type,
  stale,
  text,
  onAction,
  animated,
  time,
  onDoneTyping,
}: Notification & { animated?: boolean; onDoneTyping?: () => void }) => {
  useEffect(() => {
    return () => {
      setTimeout(() => {
        if (!isOverGameUI()) {
          UIManager.getInstance().leaveReact();
        }
      }, 100);
    };
  }, []);

  const date = new Date(time);
  const timeText = `${pad(date.getHours(), 2)}:${pad(date.getMinutes(), 2)}`;
  return (
    <NotificationContainer key={id} type={type} stale={stale}>
      <Time>{timeText}</Time>
      <Caret>
        {onAction ? (
          <NotificationButton onClick={onAction}>
            {animated ? <AnimatedText text={text} onDone={onDoneTyping} /> : text}
          </NotificationButton>
        ) : (
          <NotificationDetail>
            {animated ? <AnimatedText text={text} onDone={onDoneTyping} /> : text}
          </NotificationDetail>
        )}
      </Caret>
    </NotificationContainer>
  );
};

const Container = styled.div<{ expand?: boolean }>`
  max-height: 200px;
  width: 220px;
  overflow: auto;
  display: flex;
  flex-direction: column-reverse;
  margin: 10px 0;
  padding: 10px 0;
  ${(p) =>
    p.expand
      ? `
  max-height: 400px;
  `
      : ""}
`;

const NotificationDetail = styled.div`
  display: inline-block;
  padding: 3px;
`;

const Time = styled(NotificationDetail)`
  color: ${colors.lightgray};
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

const Caret = styled.span`
  :before {
    content: "> ";
  }
`;

const NotificationContainer = styled(Text)<{
  type?: NotificationType;
  stale?: boolean;
}>`
  display: block;
  font-size: 12px;
  transition: opacity 500ms ease;
  margin: 1px 8px;
  color: ${(p) => typeToColor(p.type)};

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

  return colors.white;
}
