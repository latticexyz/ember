import React from "react";
import { GameUI } from "./GameUI";
import styled from "styled-components";
import { colors } from "../../theme";
import { WorldCoord } from "../../_types/GlobalTypes";

const WIDTH = 200;
const HEIGHT = 150;

interface Props {
  coord: WorldCoord;
  children: React.ReactNode;
}

export const ContextMenu: React.FC<Props> = ({ coord, children }) => {
  return (
    <GameUI>
      <Container {...getCoordsWithinViewport(coord)}>{children}</Container>
    </GameUI>
  );
};

const Container = styled.div<WorldCoord>`
  position: absolute;
  top: ${(p) => p.y}px;
  left: ${(p) => p.x}px;
  background-color: ${colors.uiBackground};
  backdrop-filter: blur(6px);
`;

function getCoordsWithinViewport({ x, y }: WorldCoord): WorldCoord {
  let transformedX = x;
  let transformedY = y;

  if (x + WIDTH > window.innerWidth) {
    transformedX = x - WIDTH;
  }

  if (y + HEIGHT > window.innerHeight) {
    transformedY = y - HEIGHT;
  }

  return { x: transformedX, y: transformedY };
}
