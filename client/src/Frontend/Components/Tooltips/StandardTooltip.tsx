import React, { useLayoutEffect, useRef, useState } from "react";
import styled from "styled-components";
import { TooltipDirection } from ".";
import { fonts } from "../../../theme";
import { DirectionInfo, getPosition } from "../../Utils/Positioning";

// A generic tooltip layout that's good for most use cases

export interface Props {
  title?: string;
  text: string;
  direction: TooltipDirection;
  parent: DOMRect;
  shortcut?: string;
  expandedText?: string;
  icon?: string;
  stats?: [string, number][];
  margin?: number;
}

export const StandardTooltip: React.FC<Props> = ({
  title,
  text,
  direction,
  parent,
  shortcut,
  stats,
  margin,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dir, setDir] = useState<DirectionInfo>();
  useLayoutEffect(() => {
    if (containerRef.current && parent) {
      const containerRect = containerRef.current.getBoundingClientRect();
      const x = getPosition(parent, containerRect, direction, "game-overlay", margin);
      if (x) {
        setDir(x);
      }
    }
  }, []);
  return (
    <Container ref={containerRef} top={dir?.top} left={dir?.left} transform={dir?.transform}>
      {title && (
        <>
          <Header>
            <TitleContainer>
              <HeaderText>{title}</HeaderText>
            </TitleContainer>
            {shortcut && <Shortcut>[{shortcut}]</Shortcut>}
          </Header>
          <Separator />
        </>
      )}
      <DescContainer>
        <Description>{text}</Description>
      </DescContainer>
      {stats && <Separator />}
      {stats &&
        stats.map(([stat, value], i) => (
          <StatContainer>
            <Label>{stat}</Label>
            <Stat>{value}</Stat>
          </StatContainer>
        ))}
    </Container>
  );
};

const Container = styled.div<{ top?: number; left?: number; transform?: string }>`
  padding: 8px;
  background: rgba(6, 10, 4, 0.85);
  border: 1px solid rgba(82, 73, 37, 1);
  box-shadow: 0px -1px 10px rgba(0, 0, 0, 0.04), 0px 3px 10px rgba(0, 0, 0, 0.05), 0px 12px 16px rgba(0, 0, 0, 0.14);
  font-family: ${fonts.regular};
  left: ${(p) => (p.left ? p.left + "px" : 0)};
  top: ${(p) => (p.top ? p.top + "px" : 0)};
  transform: ${(p) => (p.transform ? p.transform : "")};
  position: absolute;
  display: flex;
  flex-direction: column;
  max-width: 300px;
  z-index: 999;
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  color: #fff;
`;
const TitleContainer = styled.div`
  display: flex;
`;

const HeaderText = styled.span``;

const Shortcut = styled.span``;

const Separator = styled.hr`
  border: 1px solid #211d13;
  width: 100%;
`;

const DescContainer = styled.div`
  height: 100%;
  font-size: 12px;
`;

const Description = styled.p`
  color: rgba(255, 255, 255, 0.6);
`;

const StatContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const Label = styled.span`
  color: #d7cbac;
`;

const Stat = styled.span`
  color: #d7cbac;
`;
