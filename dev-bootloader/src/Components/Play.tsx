import { ethers } from "ethers";
import React, { useCallback } from "react";
import styled from "styled-components";
import { Deployment, DeploymentsManager } from "../deploymentsManager";
import { colors } from "../theme";
import { Text } from "./Common/Text";
import { Link } from "./Deployments";

interface Props {
  deployment: Deployment;
  playerAddress: string;
  overrideClientUrl?: string;
}

export const Play: React.FC<Props> = ({ deployment, playerAddress, overrideClientUrl }) => {
  const d = DeploymentsManager.getInstance();
  const getPrivateKey = useCallback(() => {
    return d.getBurnerWalletPkeyForCurrentPlayer(deployment.diamondAddress);
  }, [d, deployment]);
  const pkey = getPrivateKey();
  if (!pkey) {
    return (
      <Container>
        <Text>Error no pkey</Text>
      </Container>
    );
  }
  const clientUrl = overrideClientUrl ? overrideClientUrl : deployment.clientUrl;
  const searchParams = new URLSearchParams({
    chainId: deployment.chainId.toString(),
    address: playerAddress,
    diamondAddress: deployment.diamondAddress,
    privateKey: pkey,
  });
  const frameUrl = clientUrl + "?" + searchParams.toString();
  return (
    <Container>
      <StatusBar>
        <Text>
          <LatticeText>Lattice</LatticeText> connected to {deployment.name} ({deployment.diamondAddress}){" "}
          {overrideClientUrl && <RedText>DEV MODE (client: {overrideClientUrl})</RedText>}
        </Text>
        <Link
          onClick={() => {
            d.clearPlayedDeployment();
            d.loadDeployments();
          }}
        >
          disconnect
        </Link>
      </StatusBar>
      <LoadingFrame>
        <Text>loading the client at {clientUrl}...</Text>
      </LoadingFrame>
      <Frame seamless src={frameUrl} sandbox={"allow-scripts allow-same-origin allow-modals"} />
    </Container>
  );
};

const LatticeText = styled(Text)`
  color: ${colors.processing};
`;

const RedText = styled(Text)`
  color: ${colors.red};
`;

const Container = styled.div``;
const StatusBar = styled.div`
  padding-right: 5px;
  padding-left: 5px;
  background-color: ${colors.black};
  width: 100vw;
  position: absolute;
  top: 0;
  left: 0;
  z-index: 99;
  height: 25px;
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const Frame = styled.iframe`
  width: 100%;
  left: 0;
  position: absolute;
  z-index: 99;
  height: calc(100% - 25px);
  top: 25px;
`;

const LoadingFrame = styled.div`
  background-color: ${colors.almostblack};
  width: 100%;
  left: 0;
  position: absolute;
  z-index: 98;
  height: calc(100% - 25px);
  top: 25px;
  display: flex;
  align-items: center;
  justify-content: center;
`;
