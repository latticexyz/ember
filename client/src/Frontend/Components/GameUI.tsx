import React, { useRef } from "react";
import { UIManager } from "../UIManager";
import styled from "styled-components";
import { useEffect } from "react";
import { GAME_UI_CLASSNAME } from "../Utils/Utils";

export const GameUI: React.FC<React.HTMLProps<HTMLDivElement> & { styled?: boolean }> = ({
  styled,
  style,
  children,
  ...props
}) => {
  useEffect(() => {
    return () => {
      const currentlyOverReactUI = document.querySelectorAll(`.${GAME_UI_CLASSNAME}:hover`).length > 0;
      if (!currentlyOverReactUI) UIManager.getInstance().leaveReact();
    };
  }, []);

  const dragging = useRef(false);

  return (
    <div
      {...props}
      className={GAME_UI_CLASSNAME}
      style={{ ...style, pointerEvents: "all" }}
      onMouseEnter={() => {
        UIManager.getInstance().enterReact();
      }}
      onMouseLeave={() => {
        !dragging.current && UIManager.getInstance().leaveReact();
      }}
      onMouseDownCapture={() => {
        dragging.current = true;
      }}
      onMouseUpCapture={() => {
        dragging.current = false;
      }}
    >
      <Container styled={styled}>{children}</Container>
    </div>
  );
};

const Container = styled.div<{ styled?: boolean }>`
  ${(p) =>
    p.styled
      ? `
      border-radius: 2px;
`
      : ""}
`;
