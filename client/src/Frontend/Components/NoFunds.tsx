import React from "react";
import styled from "styled-components";
import { colors } from "../../theme";
import { observer } from "mobx-react-lite";
import { Text } from "./Common/Text";
import { useGameManager } from "../Hooks/useGameManager";
import { Portrait } from "./Portrait";

const ImportantText = styled(Text)`
  color: ${colors.warning};
`;

export const NoFunds: React.FC = observer(() => {
  const gm = useGameManager();
  if (!gm) {
    return null;
  }

  return (
    <Container>
      <TopRow>
        <SmallText>
          {gm.net.chainName} ({gm.net.chainId})
        </SmallText>
        <SmallText>block# {gm.net.blockNumber}</SmallText>
      </TopRow>
      <Row>
        <Portrait address={gm?.address} />
        <Text>{gm.address}</Text>
      </Row>
      <Row>
        <SmallText>Balance: </SmallText>
        <Text>{gm.net.balance} xDai</Text>
      </Row>
      <Row>
        <ImportantText>
          This deployment does not support GSN. Please fund your account with at least 0.02 xDai
        </ImportantText>
      </Row>
    </Container>
  );
});

const SmallText = styled(Text)`
  font-size: 10pt;
`;

const Stat = styled(Text)`
  display: block;
`;

const Row = styled.div`
  display: grid;
  grid-template-columns: 1fr auto;
  margin-top: 10px;
  grid-gap: 10px;
  align-items: center;
`;

const StatRow = styled.div`
  display: grid;
  grid-auto-flow: column;
  justify-content: space-between;
  grid-gap: 10px;
  padding: 3px;
`;

const TopRow = styled.div`
  grid-gap: 30px;
  display: grid;
  justify-content: space-between;
  grid-auto-flow: column;
`;

const Container = styled.div`
  padding: 10px;
  width: 500px;
`;
