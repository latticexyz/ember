import { observer } from "mobx-react-lite";
import React from "react";
import styled from "styled-components";
import { colors, fonts } from "../../theme";
import { TileDelayedActionType } from "../../_types/ContractTypes";
import { WorldCoord } from "../../_types/GlobalTypes";
import { useGameManager } from "../Hooks/useGameManager";
import { useUIState } from "../Hooks/useUIState";
import { ConfirmDelayedActionData, UIManager } from "../UIManager";
import { Text } from "./Common/Text";
import { ContextMenu } from "./ContextMenu";

interface Props {
  viewportCoord: WorldCoord;
}
export const ConfirmDelayedAction: React.FC<Props> = observer(({ viewportCoord }) => {
  const uiState = useUIState();
  const gm = useGameManager();
  if (!gm) return <></>;

  const data = uiState.confirmDelayedActionData!;
  const coordString = data.coords.map((coord) => `(${coord.x},${coord.y})`).join(", ");
  const confirmationTextForceMine = `Are you sure you want to force mine ${coordString}?`;
  const confirmationTextUnwall = `Are you sure you want to destroy the wall on ${coordString} ?`;
  const delay =
    gm.constants.gameConstants.DELAYED_ACTIONS_MIN_SECOND_DELAY[data.delayedActionType][
    data.playerControlsRegion ? 0 : 1
    ];
  return (
    <ContextMenu coord={viewportCoord}>
      <Container>
        <TextContainer>
          <SmallText>
            {data.delayedActionType === TileDelayedActionType.FORCE_MINE
              ? confirmationTextForceMine
              : confirmationTextUnwall}
          </SmallText>
          <SmallText>You will have to wait {delay}s before being able to finish this action</SmallText>
        </TextContainer>
        <ButtonRow>
          <tr>
            <Button
              onClick={() => {
                UIManager.getInstance().leaveReact();
                uiState.setConfirmDelayedActionData(null);
                // remove the mobx proxy
                const unproxiedCoords = data.coords.map(({ x, y }) => ({ x, y }));
                for (const coord of unproxiedCoords) {
                  if (data.delayedActionType === TileDelayedActionType.UNWALL) {
                    gm.initiateUnwallTile(coord);
                  } else if (data.delayedActionType === TileDelayedActionType.FORCE_MINE) {
                    gm.initiateForceMineTile(coord);
                  } else {
                    console.warn("Unimplemented");
                  }
                }
              }}
            >
              Yes
            </Button>
          </tr>
        </ButtonRow>
      </Container>
    </ContextMenu>
  );
});

const TextContainer = styled.div`
  display: flex;
  padding: 10px;
  flex-direction: column;
`;

const Container = styled.div`
  border: 2px solid ${colors.uiForeground};
  width: 200px;
  height: 100%;
  display: flex;
  flex-direction: column;
`;

const SmallText = styled(Text)`
  font-size: 10pt;
`;

const ButtonRow = styled.table`
  border-collapse: collapse;
  width: 100%;
  border-style: hidden;
  border-top: 2px solid ${colors.uiForeground};
`;

const Button = styled.td`
  font-family: ${fonts.regular};
  border: 2px solid ${colors.uiForeground};
  padding: 13px;
  color: ${colors.white};
  text-align: center;
  transition: all 200ms ease;
  user-select: none;
  cursor: pointer;
  font-size: 11pt;

  :hover {
    background-color: ${colors.uiForeground};
    color: #000;
  }
`;
