import React, { useState } from "react";
import styled from "styled-components";
import { UseStore } from "zustand/esm";
import { Connector, Web3ReactState } from "@web3-react/types";
import { useChainId, useAccounts, useError, useActivating, useAccount } from "@web3-react/core";
import { metaMask, hooks } from "../metamask";
import { colors } from "../theme";
import { Text } from "./Common/Text";

function Status({
  connector,
  useConnector,
}: {
  connector: InstanceType<typeof Connector>;
  useConnector: UseStore<Web3ReactState>;
}) {
  const chainId = useChainId(useConnector);
  const accounts = useAccounts(useConnector);
  const account = useAccount(useConnector);
  const error = useError(useConnector);

  const connected = Boolean(chainId && accounts);

  return (
    <Text>
      {error ? (
        <>
          🛑 {error.name ?? "Error"}: {error.message}
        </>
      ) : connected ? (
        <>✅ Connected {account}</>
      ) : (
        <>⚠️ Disconnected</>
      )}
      {/* {chainId !== 200 ? (
        <button
          onClick={() => {
            switchToNetwork({ provider: connector.provider!, chainId: 200 });
          }}
        >
          Switch to AoX
        </button>
      ) : null} */}
    </Text>
  );
}

function Connect({ connector, useConnector }: { connector: Connector; useConnector: UseStore<Web3ReactState> }) {
  const activating = useActivating(useConnector);
  const error = useError(useConnector);

  const chainId = useChainId(useConnector);
  const accounts = useAccounts(useConnector);
  connector.provider;
  const connected = Boolean(chainId && accounts);

  if (error) {
    return (
      <button
        onClick={() => {
          connector.activate();
        }}
      >
        Try Again?
      </button>
    );
  } else if (connected) {
    return (
      <button
        onClick={() => {
          if (connector?.deactivate) {
            connector.deactivate();
          }
        }}
        disabled={connector.deactivate ? false : true}
      >
        {connector.deactivate ? "Disconnect" : "Connected"}
      </button>
    );
  } else {
    return (
      <button
        onClick={() => {
          if (!activating) {
            connector.activate();
          }
        }}
        disabled={activating ? true : false}
      >
        {activating ? "Connecting..." : "Activate"}
      </button>
    );
  }
}

export function Connection() {
  const connector = metaMask;
  const useConnector = hooks;
  return (
    <Container>
      <Left>
        <Status connector={connector} useConnector={useConnector} />
      </Left>
      <Middle>
        <Text>Lattice Dev Bootloader</Text>
      </Middle>
      <Right>
        <Connect connector={connector} useConnector={useConnector} />
      </Right>
    </Container>
  );
}

const Container = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  width: 100vw;
  height: 40px;
  justify-content: space-between;
`;
const Left = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  padding-left: 10px;
  height: 100%;
  width: 210px;
  background-color: ${colors.almostblack};
`;

const Right = styled.div`
  display: flex;
  flex-direction: row;
  height: 100%;
`;

const Middle = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: center;
  align-items: center;
  height: 100%;
  width: 100%;
  background-color: ${colors.almostblack};
`;
