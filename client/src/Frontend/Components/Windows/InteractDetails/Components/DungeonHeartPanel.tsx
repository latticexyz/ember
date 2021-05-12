import React from "react";
import { Portrait } from "../../../Portrait";
import { InteractData } from "../../../../UIManager";
import styled from "styled-components";
import { useGameManager } from "../../../../Hooks/useGameManager";

const PortraitWrapper = styled.div`
  margin-bottom: 10px;
`;

export const DungeonHeartPanel: React.FC<{ data: InteractData }> = ({ data }) => {
  const gm = useGameManager();
  if (!gm) return null;

  const playerAddress = gm.extendedDungeon.getTileAt(data.selectedCoords[0]).owner;

  return (
    <PortraitWrapper>
      <Portrait address={playerAddress} />
    </PortraitWrapper>
  );
};
