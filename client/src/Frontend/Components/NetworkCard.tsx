import React from "react";
import { useGameManager } from "../Hooks/useGameManager";
import styled from "styled-components";
import { Text } from "./Common/Text";
import { FPSMeter } from "./FPSMeter";
import { GameUI } from "./GameUI";
import { NetworkError } from "./NetworkError";
import { NetworkStatus } from "./NetworkStatus";
import { observer } from "mobx-react-lite";

export const NetworkCard: React.FC = observer(() => {
  const gm = useGameManager();
  if (!gm) return <></>;

  return (
    <GameUI>
      <NetworkError />
      <Status>
        <NetworkStatus />
        <FPSMeter />
        <Text>
          Block# {gm.net.blockNumber}{" "}
          <Link
            onClick={() => {
              window.open(`${gm.net.getExplorerUrl()}/block/${gm.net.blockNumber}`, '_blank');
            }}
          >
            ↗️
          </Link>
        </Text>
      </Status>
    </GameUI>
  );
});

const Link = styled.span`
  cursor: pointer;
`

const Status = styled.div`
  position: absolute;
  display: flex;
  flex-direction: column;
  left: 8px;
  top: 8px;
  > div {
    margin-bottom: 8px;
  }
`;
