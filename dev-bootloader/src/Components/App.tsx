import React from "react";
import styled from "styled-components";
import { Connection } from "./Connection";
import { Deployments } from "./Deployments";
import { useAccount } from "@web3-react/core";
import { hooks } from "../metamask";
import { Text } from "./Common/Text";
import { observer } from "mobx-react-lite";
import { DeploymentsManager } from "../deploymentsManager";
import { Play } from "./Play";

export const App: React.FC = observer(() => {
  const account = useAccount(hooks);
  const deployments = DeploymentsManager.getInstance();
  return (
    <Container>
      <Connection />
      {account ? (
        <Deployments />
      ) : (
        <NoDeployments>
          <Text>Connect to Metamask to see the deployments</Text>
        </NoDeployments>
      )}
      {deployments.playedDeployment && account && (
        <Play
          deployment={deployments.playedDeployment}
          overrideClientUrl={deployments.overrideClientUrl || undefined}
          playerAddress={account}
        />
      )}
      <button style={{ position: "absolute", bottom: 5, left: 5 }} onClick={() => deployments.toggleDevMode()}>
        turn {deployments.overrideClientUrl ? "off" : "on"} dev mode
      </button>
    </Container>
  );
});

const Container = styled.div`
  width: 100vw;
  height: 100vh;
`;

const NoDeployments = styled.div`
  width: 100vw;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
`;
