import { observer } from "mobx-react-lite";
import React from "react";
import styled from "styled-components";
import { colors, fonts } from "../../theme";
import { useGameManager } from "../Hooks/useGameManager";
import Network, { NetworkStatus as NS } from "../../Backend/ETH/Network";
import { FullScreenContainer } from "./Common/FullScreenContainer";
import { Text } from "./Common/Text";
import { GameUI } from "./GameUI";

export const NetworkError: React.FC = observer(() => {
  const gm = useGameManager();
  if (!gm) return <></>;

  if (gm.net.networkStatus === NS.ERROR) {
    return (
      <GameUI>
        <FullScreenContainer>
          <Container>
            <TextContainer>
              <BigText>Your client has networking issues</BigText>
              <Text>
                Your connection with the node might have dropped or it might be overloaded. You should reload this page
                and try again.
              </Text>
            </TextContainer>
            <ButtonRow>
              <tr>
                <Button
                  onClick={() => {
                    window.location.reload();
                  }}
                >
                  Reload
                </Button>
              </tr>
            </ButtonRow>
          </Container>
        </FullScreenContainer>
      </GameUI>
    );
  } else {
    return null;
  }
});

const TextContainer = styled.div`
  display: flex;
  padding: 10px;
  flex-direction: column;
`;

const Container = styled.div`
  border: 2px solid ${colors.uiForeground};
  background-color: ${colors.almostblack};
  width: 40%;
  max-width: 1000px;
  height: 200px;
  display: grid;
  grid-auto-flow: row;
  grid-template-rows: 1fr auto;
`;

const BigText = styled(Text)`
  font-size: 15pt;
  font-weight: 300;
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
