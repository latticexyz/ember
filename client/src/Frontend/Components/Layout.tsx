import React from "react";
import styled from "styled-components";

interface LayoutInterface {
  leftOverlay?: React.ReactChild;
  rightOverlay?: React.ReactChild;
  header?: React.ReactChild;
  footer?: React.ReactChild;
  center?: React.ReactChild;
  dragMenu?: React.ReactChild;
  game?: React.ReactChild;
  absolute?: React.ReactChild;
}

export const Layout: React.FC<LayoutInterface> = ({
  leftOverlay,
  rightOverlay,
  header,
  footer,
  center,
  dragMenu,
  game,
  absolute,
}) => {
  return (
    <>
      <Game>{game}</Game>
      <Overlay id="game-overlay">
        <Grid>
          <Header>{header}</Header>
          <LeftOverlay>{leftOverlay}</LeftOverlay>
          <RightOverlay>{rightOverlay}</RightOverlay>
          <Center>{center}</Center>
          <DragMenu>{dragMenu}</DragMenu>
          <Footer>{footer}</Footer>
        </Grid>
        {absolute}
      </Overlay>
    </>
  );
};

const Overlay = styled.div`
  width: 100vw;
  height: 100vh;
  position: absolute;
  top: 0;
  left: 0;
  pointer-events: none;
`;

const Game = styled.div`
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
`;

const Grid = styled.div`
  height: 100vh;
  position: relative;
  display: grid;
  grid-template:
    "header header header" auto
    "left center right" 1fr
    "dragMenu . ." min-content
    "footer footer footer" auto / 1fr auto auto;
`;

const Header = styled.div`
  grid-area: header;
`;

const DragMenu = styled.div`
  grid-area: dragMenu;
`;

const LeftOverlay = styled.div`
  grid-area: left;
`;

const RightOverlay = styled.div`
  grid-area: right;
  overflow: auto;
  pointer-events: all;
  align-self: start;
`;

const Footer = styled.div`
  grid-area: footer;
`;

const Center = styled.div`
  grid-area: center;
`;
