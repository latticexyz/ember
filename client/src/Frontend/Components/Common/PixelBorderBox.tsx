import React, { ReactChild } from "react";
import styled from "styled-components";
import { ReactChildren } from "react";
import { colors } from "../../../theme";

interface Props {
  children: ReactChild | ReactChildren;
  innerColor?: string;
  outerColor?: string;
  backgroundColor?: string;
  primary?: boolean;
  flex?: boolean;
}

const Box = styled.div<{ color?: string; flex?: boolean }>`
  ${(p) => (p.flex ? "flex: 1;" : "")}
  border-left-width: 3px;
  border-right-width: 3px;
  border-left-color: ${(p) => (p.color ? p.color : colors.borderBoxOuter)};
  border-right-color: ${(p) => (p.color ? p.color : colors.borderBoxOuter)};
  border-top-color: rgba(0, 0, 0, 0);
  border-bottom-color: rgba(0, 0, 0, 0);
  padding: 3px;
  border-style: solid;
`;

const BoxInner = styled.div<{
  color?: string;
  flex?: boolean;
  backgroundColor?: string;
}>`
  ${(p) => (p.flex ? "flex: 1;" : "")}
`;

const BoxContainerFlex = styled.div`
  flex: 1;
  cursor: pointer;
`;

const BorderTopBottom = styled.div<{ color?: string }>`
  height: 3px;
  background-color: ${(p) => (p.color ? p.color : colors.borderBoxOuter)};
  margin: 0 3px;
`;

const PixelBorderBox = ({ children, innerColor, outerColor, backgroundColor, primary }: Props) => {
  const Outer = BoxContainerFlex;

  const inner = primary ? "rgba(244,111,111,1.0)" : (innerColor as string);
  const outer = primary ? "rgba(244,111,111,0.5)" : (outerColor as string);

  return (
    <Outer>
      <BorderTopBottom color={outer} />

      <Box color={outer} flex={true}>
        <BoxInner color={inner}>{children}</BoxInner>
      </Box>

      <BorderTopBottom color={outer} />
    </Outer>
  );
};

export default PixelBorderBox;
