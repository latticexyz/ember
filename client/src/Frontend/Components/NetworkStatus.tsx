import { useSpring, animated, SpringValue } from "@react-spring/web";
import { observer } from "mobx-react-lite";
import React from "react";
import styled from "styled-components";
import Network, { NetworkStatus as NS } from "../../Backend/ETH/Network";
import { GameContracts } from "../../Backend/ETH/NetworkConfig";
import { colors } from "../../theme";
import { TxType } from "../../_types/GlobalTypes";
import { useGameManager } from "../Hooks/useGameManager";
import { Text } from "./Common/Text";

const Column = styled.div`
  display: flex;
  flex-direction: column;
  align-items: baseline;
`;

const MessageContainer = styled(animated.div)`
  background-color: ${colors.evendarkergray};
  padding: 4px;
  margin-top: 4px;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
`;
const Message = styled(Text)`
  font-size: 10px;
`;
const ErrorMessage = styled(Message)`
  color: ${colors.pastelRed};
`;

const Container = styled.div`
  background-color: ${colors.evendarkergray};
  padding: 4px;
  display: flex;
  flex-direction: row;
  align-items: center;
`;

const Status = styled.div<{ net: Network<GameContracts, TxType> }>`
  width: 16px;
  height: 16px;
  margin-right: 10px;
  background-color: ${(p) => {
    const blockDifferences = p.net.blockNumber - p.net.syncedBlockNumber;
    if (p.net.reconnecting) {
      return colors.invalid;
    } else if (p.net.networkStatus === NS.ERROR) {
      return colors.invalid;
    } else if (blockDifferences > 5) {
      return colors.invalid;
    } else if (blockDifferences > 0) {
      return colors.warning;
    } else if (blockDifferences === 0) {
      return colors.valid;
    }
  }};
`;
export const NetworkStatus: React.FC = observer(() => {
  const gm = useGameManager();
  if (!gm)
    return (
      <Column>
        <Container>
          <Text>GameManager is not available.</Text>
        </Container>
      </Column>
    );

  const blockDifferences = (gm.net.blockNumber || 0) - (gm.net.syncedBlockNumber || 0);
  const outOfDateOpacity = blockDifferences > 1 ? 1 : 0;
  const props = useSpring({ opacity: outOfDateOpacity, config: { tension: 50 }, delay: 2000 });
  return (
    <>
      <Column>
        <Container>
          {<Status net={gm.net} />}
          <Text>{gm.net.chainName}</Text>
        </Container>
        {/** use a react spring here to delay showing this by 2000ms if it is rendered */}
        {blockDifferences > 1 && (
          <MessageContainer style={{ opacity: props.opacity.to({ range: [0, 0.9, 1.0], output: [0, 0, 1.0] }) }}>
            <Message>
              <ErrorMessage>Your client is out of date with the chain.</ErrorMessage> It is {blockDifferences} blocks
              behind
            </Message>
          </MessageContainer>
        )}
        {gm.net.networkStatus === NS.ERROR && (
          <MessageContainer>
            <Message>
              <ErrorMessage>Fatal network error</ErrorMessage>
            </Message>
          </MessageContainer>
        )}
        {gm.net.reconnecting && (
          <MessageContainer>
            <Message>
              <ErrorMessage>Reconnecting to chain....</ErrorMessage>
            </Message>
          </MessageContainer>
        )}
      </Column>
    </>
  );
});
