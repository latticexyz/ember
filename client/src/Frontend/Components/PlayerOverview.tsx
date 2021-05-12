import { observer } from "mobx-react-lite";
import React, { useEffect } from "react";
import { useState } from "react";
import { EthAddress } from "../../_types/GlobalTypes";
import { Portrait } from "./Portrait";
import styled from "styled-components";
import { useUIState } from "../Hooks/useUIState";
import { useGameManager } from "../Hooks/useGameManager";
import { getColorFromEthAddress } from "../../Renderer/utils/colors";
import { colors } from "../../theme";
import { GameUI } from "./GameUI";
import { ChevronDown, ChevronUp } from "./Common/Chevron";
import { ButtonWrapper, PaddedButton } from "./Common/SkeuomorphicButton";
import { TooltipDirection, Tooltip } from "./Tooltips";

const PORTRAIT_SIZE = 50;

export const PlayerOverview: React.FC = observer(() => {
  const gm = useGameManager();
  const ui = useUIState();

  const [expandedFromClick, setExpandedFromClick] = useState<boolean>(false);
  const { playersInViewport } = useUIState();

  useEffect(() => {
    if (ui.showPlayerOverview.open && !expandedFromClick) {
      setExpandedFromClick(true);
    }
    if (!ui.showPlayerOverview.open && expandedFromClick) {
      setExpandedFromClick(false);
    }
  }, [ui.showPlayerOverview]);

  if (!gm) return null;

  return (
    <GameUI>
      <CollapsedRow>
        {Array.from(playersInViewport)
          .slice(0, 5)
          .map((addr: EthAddress, id: number) => {
            const info = gm.services.nameQueue.getPlayerInfoFromAddress(addr);
            let playerDisplay = `${addr.substring(0, 19)}...`;
            if (info.nickname) {
              playerDisplay = info.nickname
            }
            if (info.ens) {
              playerDisplay = info.ens;
            }
            return (
              <Tooltip title="" text={playerDisplay} direction={TooltipDirection.Top}>
                <Portrait
                  key={id}
                  playerColor={addr === gm.address ? colors.playerColor : getColorFromEthAddress(addr).rgba}
                  address={addr}
                  width={PORTRAIT_SIZE}
                />
              </Tooltip>
            )
          }
          )}
        <ButtonWrapper>
          <PaddedButton
            onClick={async () => {
              if (!expandedFromClick) {
                ui.setShowPlayerOverview(true, true);
                setExpandedFromClick(true);
              } else {
                ui.setShowPlayerOverview(false);
                setExpandedFromClick(false);
              }
            }}
          >
            {expandedFromClick ? <ChevronDown /> : <ChevronUp />}
          </PaddedButton>
        </ButtonWrapper>
      </CollapsedRow>
    </GameUI>
  );
});

const CollapsedRow = styled.div`
  display: flex;
  float: right;
  height: 100%;
  min-height: ${PORTRAIT_SIZE}px;
`;

const ToggleExpand = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #494949;
  padding: 0 4px;
  cursor: pointer;
  transition: background-color 0.2s ease-in-out;
  &:hover {
    background-color: ${colors.greyed};
  }
`;
