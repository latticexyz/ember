import React from "react";
import styled from "styled-components";
import { observer } from "mobx-react-lite";
import { EthAddress } from "../../../../_types/GlobalTypes";
import { PlayerOverviewCard } from "./Components/PlayerOverviewCard";
import { colors } from "../../../../theme";
import { useUIState } from "../../../Hooks/useUIState";
import { Text } from "../../Common/Text";

export const PlayersInViewportOverview: React.FC = observer(() => {
  const { playersInViewport } = useUIState();
  return (
    <ExpandContainer>
      {playersInViewport.size > 0 ? (
        [...playersInViewport].map((addr: EthAddress, id: number) => (
          <PlayerOverviewCard addr={addr} key={id} showSearch={false} />
        ))
      ) : (
        <Text color={colors.white}>No players in viewport</Text>
      )}
    </ExpandContainer>
  );
});

const ExpandContainer = styled.div`
  display: flex;
  flex-direction: column;
  padding: 15px;
  border: 2px solid ${colors.uiForeground};
`;
