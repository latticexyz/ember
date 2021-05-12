import { observer } from "mobx-react-lite";
import React from "react";
import styled from "styled-components";
import { spritesheets } from "../../Assets/spritesheets";
import { colors, fonts } from "../../theme";
import { UpgradeItem, WorldCoord } from "../../_types/GlobalTypes";
import { useGameManager } from "../Hooks/useGameManager";
import { useUIState } from "../Hooks/useUIState";
import { InteractType, UIManager } from "../UIManager";
import { GameUI } from "./GameUI";
import { Tooltip, TooltipDirection } from "./Tooltips";
import { Spritesheet } from "./Spritesheet";
import { useToolInfo, NAMES } from "../Hooks/useToolInfo";

const UpgradesToSpriteSheetsParam = new Map([
  [UpgradeItem.GoldStorage, { nFrames: 1, imgPath: spritesheets.goldStorage }],
  [UpgradeItem.GoldGenerator, { nFrames: 8, imgPath: spritesheets.goldGenerator }],
  [UpgradeItem.Lair, { nFrames: 8, imgPath: spritesheets.lair }],
  [UpgradeItem.SoulStorage, { nFrames: 8, imgPath: spritesheets.soulStorage }],
  [UpgradeItem.Wall, { nFrames: 1, imgPath: spritesheets.wall }],
  [UpgradeItem.SoulGenerator, { nFrames: 8, imgPath: spritesheets.soulGenerator }],
  [UpgradeItem.TrainingRoom, { nFrames: 8, imgPath: spritesheets.trainingRoom }],
]);

interface UpgradeBtnProps {
  upgradeItem: UpgradeItem;
  regionCoord: WorldCoord;
  upgradeKey: number;
  spritesheetParams: { nFrames: number; imgPath: string };
}

const UpgradeBtn: React.FC<UpgradeBtnProps> = ({ upgradeItem, upgradeKey, spritesheetParams, regionCoord }) => {
  const toolInfo = useToolInfo(regionCoord);
  if (!toolInfo) return null;
  const stats: [string, number][] = toolInfo.NUMBER_OF_INSTANCES[upgradeItem]
    ? [
      [`Gold price (${toolInfo.NUMBER_OF_INSTANCES[upgradeItem]} instances)`, toolInfo.PRICES[upgradeItem]],
      ["Initial price", toolInfo.INITIAL_PRICE[upgradeItem]],
    ]
    : [["Gold price", toolInfo.PRICES[upgradeItem]]];

  const { interactData } = useUIState();
  const doesHaveHarvestableResource = interactData.type === InteractType.HarvestableGroundResources;

  return (
    <Tooltip
      title={NAMES[upgradeItem]}
      text={toolInfo.INFO_TEXT[upgradeItem]}
      stats={stats}
      direction={TooltipDirection.Top}
      shortcut={(upgradeKey + 1).toString()}
      margin={8}
    >
      {upgradeItem === UpgradeItem.SoulGenerator && !doesHaveHarvestableResource
        ?
        <UpgradeContainerUnavailable>
          <UpgradeContent className="upgrade-content">
            <Spritesheet spriteWidth={24} {...spritesheetParams} timePerFrame={"0.8s"} />
          </UpgradeContent>
        </UpgradeContainerUnavailable>
        :
        <UpgradeContainer
          onClick={() => {
            UIManager.getInstance().sendUpgradeMessage(upgradeItem);
            UIManager.getInstance().state.setShowHotbar(false, { x: 0, y: 0 });
          }}
        >
          <UpgradeContent className="upgrade-content">
            <Spritesheet spriteWidth={24} {...spritesheetParams} timePerFrame={"0.8s"} />
          </UpgradeContent>
        </UpgradeContainer>
      }
    </Tooltip >
  );
};

const BottomBar = observer(() => {
  const gm = useGameManager();
  const { showHotbar, regionCoord } = useUIState();

  if (!gm) return null;
  if (!showHotbar) return null;

  return (
    <GameUI>
      <Container>
        {[...UpgradesToSpriteSheetsParam.entries()].map(([upgrade, spritesheetParams], i) => (
          <MetaContainer key={"upgrade-" + i}>
            <UpgradeBtn
              upgradeItem={upgrade}
              upgradeKey={i}
              spritesheetParams={spritesheetParams}
              regionCoord={regionCoord}
            />
          </MetaContainer>
        ))}
      </Container>
    </GameUI>
  );
});

const Container = styled.div`
  display: flex;
  align-items: center;
  border-radius: 4px;
  animation: goUp 0.2s cubic-bezier(0.445, 0.05, 0.55, 0.95);
  @keyframes goUp {
    0% {
      transform: translate(0, 100px);
    }
    100% {
      transform: translate(0, 0px);
    }
  }
`;

const MetaContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
`;

const KeyHint = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  padding: 4px;
  max-width: 24px;
  max-height: 24px;
  border-radius: 4px;
  width: 100%;
  height: 100%;
  color: ${colors.white};
  font-family: ${fonts.regular};
  background-color: #404040;
  border: 1px solid rgba(255, 255, 255, 0.4);
  margin-bottom: 4px;
`;

const UpgradeContainer = styled.div`
 	display: flex;
  align-items: center:
  justify-content: center;
  padding: 4px;
  background: linear-gradient(180deg, #969696 0%, #6D6D6D 100%);
  border-radius: 5px;
  margin: 8px;
	transition: all .2s ease-in-out;
	border-bottom: 1px solid #2c2c2c;
  cursor: pointer;
	&:hover {
		background: linear-gradient(180deg, #9392CA 0%, #4B4B6C 100%);
		box-shadow: 0px 0px 24px -6px #818DFF;
    
    .upgrade-content {
      background: #8a89ca;
      border-bottom: 2px solid #1f244e;
      border-top: 2px solid #d0cfff;
      border-left: 2px solid #313c62;
      border-right: 2px solid #313c62;
    }
	}
`;

const UpgradeContainerUnavailable = styled.div`
 	display: flex;
  align-items: center:
  justify-content: center;
  padding: 4px;
  background: linear-gradient(180deg, #969696 0%, #6D6D6D 100%);
  border-radius: 5px;
  margin: 8px;
	transition: all .2s ease-in-out;
	border-bottom: 1px solid #2c2c2c;
  cursor: pointer;
  opacity: 0.3;
`;

const UpgradeContent = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  max-width: 48px;
  width: 48px;
  height: auto;
  border-radius: 4px;
  background-color: #545454;
  border-bottom: 2px solid #2c2c2c;
  border-top: 2px solid #bebebe;
  border-left: 2px solid #686868;
  border-right: 2px solid #686868;
  padding: 8px;
  color: ${colors.white};
  transition: 0.2s ease-in-out;
  &:hover {
    background: #8a89ca;
    border-bottom: 2px solid #1f244e;
    border-top: 2px solid #d0cfff;
    border-left: 2px solid #313c62;
    border-right: 2px solid #313c62;
  }
`;

export default BottomBar;
