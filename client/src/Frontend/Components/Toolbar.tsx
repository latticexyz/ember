import React, { useState, useEffect, useMemo } from "react";
import { GameUI } from "./GameUI";
import styled from "styled-components";
import { observer } from "mobx-react-lite";
import { PlayerOverview } from "./PlayerOverview";
import { CameraShortcuts } from "./CameraShortcuts";
import BottomBar from "./Bottombar";
import { useUIState } from "../Hooks/useUIState";
import { useGameManager } from "../Hooks/useGameManager";
import { ButtonWrapper, PaddedButton } from "./Common/SkeuomorphicButton";

export const Toolbar: React.FC = observer(() => {
  const uiState = useUIState();
  const gm = useGameManager();
  if (!gm) return null;

  const balanceWarning = gm.net.balance < 0.001;

  return (
    <div id="toolbar">
      <div style={{ display: "flex", justifyContent: "center", alignItems: "Center" }}>
        <StyledBar />
      </div>
      <Container>
        <GameUI>
          <CameraShortcuts />
        </GameUI>
        <RowContainer>
          <Right>
            <PlayerOverview />
          </Right>
          <GameUI>
            <ButtonWrapper>
              <PaddedButton onClick={() => uiState.setFundsWindowOpened(!uiState.fundsWindowOpened)}>
                Funds{" "}{balanceWarning ? "⚠️" : ""}
              </PaddedButton>
            </ButtonWrapper>
          </GameUI>
          <GameUI>
            <ButtonWrapper>
              <PaddedButton onClick={() => uiState.setSettingsWindowOpened(!uiState.settingsWindowOpened)} >
                Settings
              </PaddedButton>
            </ButtonWrapper>
          </GameUI>
        </RowContainer>
      </Container>
    </div>
  );
});

const Container = styled.div`
  height: 100%;
  padding: 0 5px;
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
`;

const Right = styled.div`
  padding-right: 4px;
`;

const StyledBar = styled(BottomBar)`
  margin: 0 auto;
  // z-index: 999;
  text-align: center;
`;

const RowContainer = styled.div`
  margin-left: 16px;
  box-sizing: border-box;
  display: flex;
  flex-direction: row;
  position: relative;
  align-items: center;
`;
