import React from "react";
import styled from "styled-components";
import { playerPortraits } from "../../Assets/portraits";
import { EthAddress } from "../../_types/GlobalTypes";
import { useGameManager } from "../Hooks/useGameManager";
import { UIManager } from "../UIManager";
import { getIndexFromEthAddress } from "../Utils/Utils";

const getPortraitFromEthAddress = (address: EthAddress): string => {
  const maxIndex = Object.keys(playerPortraits).length - 1;
  const index = getIndexFromEthAddress(address, maxIndex);
  return playerPortraits[Object.keys(playerPortraits)[index]];
};

interface Prop {
  address: EthAddress;
  width?: number;
  playerColor?: string;
}

const Container = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  cursor: pointer;
`;

const PortraitImage = styled.img<{ width?: number; playerColor?: string }>`
  width: ${(p) => (p.width ? p.width + "px" : "60px")};
  margin-right: 10px;
  border: ${(p) => (p.playerColor ? `3px solid ${p.playerColor}` : "none")};
`;

export const Portrait: React.FC<Prop> = ({ address, width, playerColor }) => {
  const gm = useGameManager();
  if (!gm) return null;
  return (
    <Container
      title="Click to view dungeon heart"
      onClick={async () => {
        const dhCoord = await gm.extendedDungeon.getPlayerDungeonHeart(address);
        UIManager.getInstance().jumpToCoord(dhCoord);
      }}
    >
      <PortraitImage playerColor={playerColor} width={width} src={getPortraitFromEthAddress(address)} />
    </Container>
  );
};
