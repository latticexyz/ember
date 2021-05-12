import { observer } from "mobx-react-lite";
import React from "react";
import { useMemo } from "react";
import styled from "styled-components";
import { creature, mine, upgrade } from "../../Assets/tools";
import { colors, fonts } from "../../theme";
import { ActionTypeToContractActionType } from "../../Backend/Utils/Utils";
import { useGameManager } from "../Hooks/useGameManager";
import { useSelectionManager } from "../Hooks/useSelectionManager";
import { UIManager } from "../UIManager";
import { Button, ButtonWrapper } from "./Common/SkeuomorphicButton";
import { DroppedResources } from "./DroppedResources";
import { GameUI } from "./GameUI";
import { Tooltip, TooltipDirection } from "./Tooltips";
import { ActionType as ContractActionType } from "../../_types/ContractTypes";

interface Toast {
  text: string;
  action: string;
  icon: "*.png";
}

export const ToastItem: React.FC<Toast> = ({ text, action, icon }) => {
  return (
    <ButtonWrapper row={false}>
      <Button className="btn-content" onClick={() => UIManager.getInstance().sendSingleActionMessage(action)}>
        <Icon src={icon} />
        <ToastText>{text}</ToastText>
      </Button>
    </ButtonWrapper>
  );
};

export const InputStatusToast = observer(() => {
  const gm = useGameManager();
  const selectionManager = useSelectionManager();

  const hasRegionResources = useMemo(() => {
    if (!selectionManager) return false;
    if (!gm) return false;

    const firstSelectedRegion = selectionManager.firstSelectedRegion;
    if (!firstSelectedRegion) return false;

    const reg = gm.extendedDungeon.regions.get(firstSelectedRegion);
    if (reg) {
      return reg.souls > 0 || reg.gold > 0;
    }
    return false;
  }, [gm && gm.net.blockNumber]);

  const upgradeManaCost = gm?.constants.gameConstants.MANA_PER_ACTION_TYPE[ContractActionType.UPGRADE] || 0;
  const mineManaCost = gm?.constants.gameConstants.MANA_PER_ACTION_TYPE[ContractActionType.MINE] || 0;

  if (!selectionManager) return null;
  const {
    selectedCoords,
    mineableCoords,
    upgradeableCoords,
    forceMineCoords,
    selectedCreatureIds,
  } = selectionManager;
  if (selectedCoords.length === 0) return null

  return (
    <GameUI>
      {selectedCoords.length > 0 &&
        (mineableCoords.length > 0 ||
          upgradeableCoords.length > 0 ||
          hasRegionResources ||
          forceMineCoords.length > 0 ||
          selectedCreatureIds.size > 0) && (
          <StatusContainer>
            <Header>
              <HeaderText>Execute</HeaderText>
              <Tooltip
                text={
                  selectedCreatureIds.size > 0
                    ? `RMB to move creatures, M for MultiMove, ESC to cancel`
                    : `E to execute all, ESC/RMB to cancel`
                }
                direction={TooltipDirection.Right}
                margin={8}
              >
                <HoverContainer>
                  <QuestionMark />
                </HoverContainer>
              </Tooltip>
            </Header>
            <InfoContainer>
              {mineableCoords.length > 0 && (
                <ToastItem text={`Mine ${mineableCoords.length} tiles
                (${mineableCoords.length}x${mineManaCost}=${mineableCoords.length * mineManaCost} Mana)`} action="mine" icon={mine} />
              )}

              {
                upgradeableCoords.length > 0 && (
                  <ToastItem text={`Upgrade ${upgradeableCoords.length} tiles
                (${upgradeableCoords.length}x${upgradeManaCost}=${upgradeableCoords.length * upgradeManaCost} Mana)`} action="upgrade" icon={upgrade} />
                )
              }

              {
                selectedCreatureIds.size > 0 && (
                  <ToastItem text={`${selectedCreatureIds.size} creatures selected`} action="creature" icon={creature} />
                )
              }
              {
                forceMineCoords.length > 0 && (
                  <ToastItem text={`Force mine ${forceMineCoords.length} tiles`} action="forceMine" icon={mine} />
                )
              }
            </InfoContainer >
            <DroppedResources />
          </StatusContainer >
        )}
    </GameUI >
  );
});

const QuestionMark = () => {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M0.877075 7.49972C0.877075 3.84204 3.84222 0.876892 7.49991 0.876892C11.1576 0.876892 14.1227 3.84204 14.1227 7.49972C14.1227 11.1574 11.1576 14.1226 7.49991 14.1226C3.84222 14.1226 0.877075 11.1574 0.877075 7.49972ZM7.49991 1.82689C4.36689 1.82689 1.82708 4.36671 1.82708 7.49972C1.82708 10.6327 4.36689 13.1726 7.49991 13.1726C10.6329 13.1726 13.1727 10.6327 13.1727 7.49972C13.1727 4.36671 10.6329 1.82689 7.49991 1.82689ZM8.24993 10.5C8.24993 10.9142 7.91414 11.25 7.49993 11.25C7.08571 11.25 6.74993 10.9142 6.74993 10.5C6.74993 10.0858 7.08571 9.75 7.49993 9.75C7.91414 9.75 8.24993 10.0858 8.24993 10.5ZM6.05003 6.25C6.05003 5.57211 6.63511 4.925 7.50003 4.925C8.36496 4.925 8.95003 5.57211 8.95003 6.25C8.95003 6.74118 8.68002 6.99212 8.21447 7.27494C8.16251 7.30651 8.10258 7.34131 8.03847 7.37854L8.03841 7.37858C7.85521 7.48497 7.63788 7.61119 7.47449 7.73849C7.23214 7.92732 6.95003 8.23198 6.95003 8.7C6.95004 9.00376 7.19628 9.25 7.50004 9.25C7.8024 9.25 8.04778 9.00601 8.05002 8.70417L8.05056 8.7033C8.05924 8.6896 8.08493 8.65735 8.15058 8.6062C8.25207 8.52712 8.36508 8.46163 8.51567 8.37436L8.51571 8.37433C8.59422 8.32883 8.68296 8.27741 8.78559 8.21506C9.32004 7.89038 10.05 7.35382 10.05 6.25C10.05 4.92789 8.93511 3.825 7.50003 3.825C6.06496 3.825 4.95003 4.92789 4.95003 6.25C4.95003 6.55376 5.19628 6.8 5.50003 6.8C5.80379 6.8 6.05003 6.55376 6.05003 6.25Z"
        fill="currentColor"
        fillRule="evenodd"
        clipRule="evenodd"
        stroke="#958D7A"
      ></path>
    </svg>
  );
};

const HoverContainer = styled.div`
  height: 32px;
  width: 32px;
  border-radius: 4px;
  display: flex;
  justify-content: center;
  align-items: center;
  cursor: pointer;
  transition: 0.2s ease-in-out;
  &:hover {
    background-color: #3e3e3e;
  }
`;

const HeaderText = styled.p`
  font-size: 13px;
  font-weight: semibold;
  color: #fff;
  font-family: ${fonts.regular};
  width: 100%;
  margin: 0;
`;

const Header = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  width: 100%;
`;

const InfoContainer = styled.div``;

export const Icon = styled.img`
  max-width: 24px;
  width: 100%;
  height: auto;
`;

export const ToastText = styled.div`
  display: flex;
  margin-left: 8px;
  font-size: 11px;
  flex-direction: row;
  align-items: center;
  width: 100%;
`;

export const RegularText = styled(ToastText)`
  margin: 0 auto;
`;

const StatusContainer = styled.div`
  border-top: 1px solid #958d7a;
  margin-left: 8px;
  z-index: 997;
  color: ${colors.white};
  border-radius: 2px;
  font-family: ${fonts.regular};
  position: relative;
  min-height: 48px;
  background: rgba(17, 22, 34, 0.6);
  width: 240px;
  box-sizing: border-box;
  margin-bottom: 1rem;
  padding: 16px;
  display: grid;
  grid-gap: 8px;
  max-height: 800px;
  position: absolute;
  bottom: 5rem;
  left: 8px;
  overflow: hidden;
  direction: ltr;
  animation: openAnim 0.2s ease;
  @keyframes openAnim {
    0% {
      transform: translate(-50px, 0px);
      opacity: 0%;
    }
    50% {
      transform: translate(0px, 0px);
      opacity: 50%;
    }
    100% {
      transform: translate(0px, 0px);
      opacity: 100%;
    }
  }
`;
