import React from "react";
import styled from "styled-components";
import { colors } from "../../theme";

export const CircularProgress: React.FC<{ progress: number }> = ({ progress }) => {
  return (
    <Circular>
      <Inner></Inner>
      <Circle>
        <BarLeft>
          <Progress progress={progress < 0.5 ? progress * 2 : 1} />
        </BarLeft>
        <BarRight>
          <Progress progress={progress < 0.5 ? 0 : (progress - 0.5) * 2} right />
        </BarRight>
      </Circle>
    </Circular>
  );
};

const SIZE = 6;

const Circular = styled.div`
  height: ${SIZE}px;
  width: ${SIZE}px;
  position: relative;
  transform: scale(2);
`;
const Inner = styled.div`
  position: absolute;
  z-index: 6;
  top: 50%;
  left: 50%;
  height: ${SIZE * 0.8}px;
  width: ${SIZE * 0.8}px;
  margin: -${SIZE * 0.4}px 0 0 -${SIZE * 0.4}px;
  background: ${colors.almostblack};
  border-radius: ${SIZE}px;
`;
const Circle = styled.div``;
const Bar = styled.div`
  position: absolute;
  height: 100%;
  width: 100%;
  background: ${colors.darkgray};
  border-radius: ${SIZE}px;
  clip: rect(0px, ${SIZE}px, ${SIZE}px, ${SIZE * 0.5}px);
`;
const BarLeft = styled(Bar)``;
const BarRight = styled(Bar)`
  transform: rotate(180deg);
  z-index: 3;
`;
const Progress = styled.div<{ progress: number; right?: boolean }>`
  position: absolute;
  height: 100%;
  width: 100%;
  border-radius: ${SIZE}px;
  clip: rect(0px, ${SIZE * 0.5}px, ${SIZE}px, 0px);
  background: ${colors.valid};
  z-index: ${(p) => (p.right ? 0 : 1)};
  transform: rotate(${(p) => Math.min(p.progress * 180, 180)}deg);
  transition: transform 100ms ease;
`;
