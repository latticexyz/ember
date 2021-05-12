import React from "react";
import styled from "styled-components";
import { colors } from "../../../../../theme";

export const Lifebar: React.FC<{ value: number; max: number; horizontal?: boolean; innerColor?: string }> = ({
  value,
  max,
  horizontal,
  innerColor,
}) => {
  const percent = value > max ? 100 : (value / max) * 100;
  return (
    <LifebarOuter horizontal={horizontal}>
      <LifebarInner percent={percent} horizontal={horizontal} color={innerColor} />
    </LifebarOuter>
  );
};

const LifebarOuter = styled.div<{ horizontal?: boolean }>`
  position: relative;
  border: 2px solid ${colors.uiForeground};
  ${(p) => (p.horizontal ? "height: 7px;" : "width: 8px;")}
`;

const LifebarInner = styled.div<{ percent: number; horizontal?: boolean; color?: string }>`
  position: absolute;
  bottom: 0;
  ${(p) => (p.horizontal ? `width: ${p.percent}%;` : `height: ${p.percent}%;`)}
  ${(p) => (p.horizontal ? `height: 100%;` : `width: 100%;`)}
  background-color: ${(p) => (p.color ? p.color : p.percent < 50 ? colors.invalid : colors.valid)};
  transition: all 300ms ease;
`;
