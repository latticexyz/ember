import React, { useState, useCallback, useMemo, useRef, useLayoutEffect } from "react";
import styled from "styled-components";
import { GameUI } from "../GameUI";
import { colors, fonts, hexColors } from "../../../theme";
import { useEffect } from "react";
import { Tooltip, TooltipDirection } from "../Tooltips";

export interface WindowProps {
  id: string;
  defaultPosition: { x: number; y: number };
  fadeIn?: boolean;
}

export const MetaWindow: React.FC<WindowProps> = ({ children, id, defaultPosition, fadeIn }) => {
  const [fading, setFading] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number>(0);
  const [tabs, setTabs] = useState<React.ReactChild[]>([]);
  const [lastTabIndex, setLastTabIndex] = useState<number>(0);

  useEffect(() => {
    if (fadeIn) {
      setTimeout(() => setFading(true), 10);
    }
  }, [fadeIn]);

  useEffect(() => {
    // every time the children change, put tabs in a new window
    const newTabs = React.Children.toArray(children).filter((child) => child);
    // if a new window is opened, focus the active index to that window
    if (tabs.length < newTabs.length) {
      setLastTabIndex(activeIndex);
      setActiveIndex(newTabs.length - 1);
    } else if (tabs.length > newTabs.length) {
      // if a window has been closed, focus the last tab
      if (lastTabIndex < newTabs.length) {
        setActiveIndex(lastTabIndex);
      }
      setLastTabIndex(0);
    }
    setTabs(newTabs as React.ReactChild[]);
  }, [children]);

  const toolbarHeight = useMemo(() => {
    const toolbar = document.getElementById("toolbar");
    const tbh = toolbar ? toolbar.clientHeight : 75; // approximate toolbar height
    return tbh;
  }, []);

  return (
    <Container id={id} fadeIn={fadeIn} fading={fading} defaultPosition={defaultPosition}>
      <GameUI styled>
        <Tooltip direction={TooltipDirection.Right} text="ESC or Right-Click to Close" margin={8}>
          <Bar className={"zk-window-handle"}>
            {tabs.length > 0 &&
              tabs.map((child, index) => {
                return (
                  <TabContainer
                    id={(child as React.ReactElement)?.props.windowId}
                    active={activeIndex === index}
                    onClick={() => {
                      setLastTabIndex(activeIndex);
                      setActiveIndex(index);
                    }}
                  >
                    {(child as React.ReactElement)?.props.title}
                  </TabContainer>
                );
              })}
          </Bar>
        </Tooltip>
        <ChildContainer toolbarHeight={toolbarHeight}>{(tabs.length > 0 && tabs[activeIndex]) || null}</ChildContainer>
      </GameUI>
    </Container>
  );
};

const ChildContainer = styled.div<{ toolbarHeight?: number }>`
  height: 100%;
  max-height: calc(100vh - (${(p) => (p.toolbarHeight || 75) + 133}px));
  overflow-y: auto;
`;

const Container = styled.div<{
  toolbarHeight?: number;
  defaultPosition: { x: number; y: number };
  fadeIn?: boolean;
  fading?: boolean;
}>`
  display: inline-block;
  border-top: 1px solid #958d7a;
  position: absolute;
  transition: opacity 200ms ease;
  opacity: ${(p) => (p.fadeIn ? 0 : 1)};
  border-radius: 2px;
  overflow: hidden;
  top: ${(p) => p.defaultPosition.y}px;
  left: ${(p) => p.defaultPosition.x + 16}px;

  ${(p) => {
    if (p.fading) {
      return `
        opacity: 1; 
      `;
    }
  }}
`;

const Bar = styled.div`
  display: flex;
  height: 100%;
  width: 100%;
  max-height: 33px;
`;
const TabContainer = styled.button<{ active: boolean }>`
  color: #fff;
  font-family: ${fonts.regular};
  background: ${(p) => (p.active ? "#282B33" : "#1b1d21")};
  padding: 8px;
  border: none;
  text-decoration: none;
  cursor: pointer;
  &:hover {
    background: ${(p) => (p.active ? "#383C46" : "#323339")};
  }
  &:focus-visible {
    outline: none;
  }
`;
