import { observer } from "mobx-react-lite";
import React, { useEffect, useState } from "react";
import styled from "styled-components";
import copy from "clipboard-copy";
import humanizeDuration from "humanize-duration";
import { ethers } from "ethers";
import { useGameManager } from "../../../../Hooks/useGameManager";
import { Text } from "../../../Common/Text";
import { colors, fonts } from "../../../../../theme";
import { Input } from "../../../Common/Input";
import { Space } from "../../../Common/Space";
import { TxExecutor } from "../../../../../Backend/Game/TxExecutor";
import { sleep } from "../../../../../Backend/Utils/Utils";

export const FundWindow = observer(() => {
  const gm = useGameManager();
  const [tab, setTab] = useState(2);
  if (!gm) {
    return null;
  }
  // In the presence of a legit faucet, we don't need the 'bank'.
  const bank = false;
  const l2 = gm.net.featureFlags.bridge;
  const faucet = gm.net.featureFlags.faucet;
  const balanceText = l2 ? `Balance on L2 (${gm.net.chainName})` : "Balance";
  const balanceTooLow = gm.net.balance < TxExecutor.MIN_BALANCE_ETH;
  return (
    <Container>
      {balanceTooLow && (
        <Warning>
          Your balance is critically low. Request a drip via the faucet to keep playing.
        </Warning>
      )}
      <DetailHeadline>
        burner wallet ({gm.net.getImpersonatorAddress().substring(0, 6)}{" "}
        <TextButton
          onClick={() => {
            copy(gm.net.getImpersonatorAddress());
          }}
        >
          copy
        </TextButton>
        {" | "}
        <TextButton
          onClick={() => {
            window.open(`${gm.net.getExplorerUrl()}/address/${gm.net.getImpersonatorAddress()}`, '_blank');
          }}
        >
          view 🔗
        </TextButton>
        )
      </DetailHeadline>
      <Text>
        {balanceText}: ${gm.net.balance.toFixed(7)}
      </Text>
      <Tabs>
        {l2 && (
          <Tab selected={tab === 0} onClick={() => setTab(0)}>
            Bridge
          </Tab>
        )}
        {bank && <Tab selected={tab === 1} onClick={() => setTab(1)}>
          Bank
        </Tab>}
        {faucet && (
          <Tab selected={tab === 2} onClick={() => setTab(2)}>
            Faucet
          </Tab>
        )}
      </Tabs>
      {l2 && tab === 0 ? <L2Details /> : null}
      {tab === 1 ? <BankDetails /> : null}
      {faucet && tab === 2 ? <FaucetDetails /> : null}
    </Container>
  );
});

const BankDetails = observer(() => {
  const gm = useGameManager();
  const [isDripping, setIsDripping] = useState(false);
  const [error, setError] = useState<string | undefined>("");
  if (!gm) {
    return null;
  }
  const sinceLastDrip = Math.floor(Math.max(0, (Date.now() - (gm.bank.lastDrip ? gm.bank.lastDrip : 0)) / 1000)) * 1000;
  const canDrip = sinceLastDrip > (gm.bank.timeBetweenDrip ? gm.bank.timeBetweenDrip : 0);
  return (
    <>
      <Text>Time between drips: {humanizeDuration(gm.bank.timeBetweenDrip)}</Text>
      <Text>
        {gm.bank.lastDrip && gm.bank.lastDrip > 0
          ? `Your last drip was at ${humanizeDuration(sinceLastDrip)} ago. You have requested a total of \$${gm.bank.totalDrip
          }.`
          : "You have never claimed a drip"}
      </Text>
      <Text>Drip amount: ${gm.bank.dripAmount}</Text>
      {error && <Error>error: {error}</Error>}
      <Space h={10} />
      <Button
        disabled={isDripping || !canDrip}
        onClick={async () => {
          setIsDripping(true);
          try {
            await gm.bank.getDrip();
            setError(undefined);
          } catch (e) {
            console.error("error while dripping");
            setError(e.toString());
          } finally {
            setIsDripping(false);
          }
        }}
      >
        {!(canDrip && !isDripping) ? (!canDrip ? "can't drip yet" : "requesting...") : "drip $" + gm.bank.dripAmount}
      </Button>
    </>
  );
});

const FaucetDetails = observer(() => {
  const gm = useGameManager();
  const [isDripping, setIsDripping] = useState(false);
  const [error, setError] = useState<string | undefined>("");
  if (!gm) {
    return null;
  }
  return (
    <>
      {error && <Error>error: {error}</Error>}
      <Button
        disabled={isDripping}
        onClick={async () => {
          setIsDripping(true);
          try {
            const balanceBefore = await gm.net.getBalance(gm.net.getImpersonatorAddress());
            await gm.net.featureFlags.faucet!.getDripFromFaucet(gm.net.getImpersonatorAddress(), gm.net);
            let attempts = 100;
            while (attempts > 0) {
              await gm.net.refreshBalance();
              if (gm.net.balance > balanceBefore) {
                break;
              } else {
                attempts--;
                await sleep(1000);
              }
            }
            setError(undefined);
          } catch (e) {
            console.error("error while dripping");
            setError(e.toString());
          } finally {
            setIsDripping(false);
          }
        }}
      >
        {isDripping ? "requesting..." : "request from faucet"}
      </Button>
    </>
  );
});

const L2Details = () => {
  const gm = useGameManager();
  const getBalance = async () => {
    if (!gm) {
      return 0;
    }
    try {
      if (!gm.net.featureFlags.bridge) {
        return 0;
      }
      const balance = parseFloat(
        ethers.utils.formatEther(await gm.net.featureFlags.bridge.getL1Balance(gm.net.getImpersonatorAddress()))
      );
      setBalance(balance); // set State
    } catch (err) {
      console.error(err.message);
    }
  };
  useEffect(() => {
    getBalance();
    const interval = setInterval(() => {
      getBalance();
    }, 20000);

    return () => clearInterval(interval);
  }, []);
  const [balance, setBalance] = useState(-1);
  if (!gm) {
    return null;
  }
  if (!gm.net.featureFlags.bridge) {
    return null;
  }
  return (
    <>
      <Text>Balance on L1: {balance >= 0 ? "$" + balance.toFixed(4) : "loading..."}</Text>
      <Space h={10} />
      <Bridge balance={balance} refreshBalance={() => getBalance()} />
    </>
  );
};

const Bridge = ({ balance, refreshBalance }) => {
  const gm = useGameManager();
  const [isBridging, setIsBridging] = useState(false);
  const [amount, setAmount] = useState("");
  const [logs, setLogs] = useState<string[]>([]);
  const [error, setError] = useState<string | undefined>("");
  const addLog = (l: string) => {
    setLogs((currentLogs) => currentLogs.concat([l]));
  };
  if (!gm) {
    return null;
  }
  if (!gm.net.featureFlags.bridge) {
    return null;
  }
  return (
    <>
      {error && <Error>error: {error}</Error>}
      <BridgeContainer>
        <Input placeholder="Amount" onChange={(e) => setAmount(e.target.value)} />
        <Button
          disabled={!(!isBridging && amount.length > 0 && parseFloat(amount) > 0 && parseFloat(amount) <= balance)}
          onClick={async () => {
            setIsBridging(true);
            try {
              await gm.net.bridge(parseFloat(amount), (l: string) => {
                addLog(l);
              });
              setError(undefined);
            } catch (e) {
              console.error("error while bridging");
              setError(e.toString());
            } finally {
              setIsBridging(false);
              refreshBalance();
            }
          }}
        >
          {isBridging ? "bridging..." : "bridge"}
        </Button>
      </BridgeContainer>
      {isBridging && (
        <LogContainer>
          {["logs:", ...logs].map((l) => (
            <SmallText>{l}</SmallText>
          ))}
        </LogContainer>
      )}
    </>
  );
};

const Container = styled.div`
  display: flex;
  flex-direction: column;
  max-width: 400px;
`;
const Tabs = styled.div`
  display: flex;
  flex-direction: row;
  margin-top: 10px;
  margin-bottom: 10px;
`;
const Tab = styled(Text) <{ selected: boolean }>`
  cursor: pointer;
  font-size: 10pt;
  margin-right: 10px;
  font-weight: 600;
  text-decoration: underline;
  color: ${(p) => (p.selected ? "white" : colors.lightgray)};
  text-decoration-color: ${(p) => (p.selected ? "white" : colors.lightgray)};
`;

const LogContainer = styled.div`
  display: flex;
  flex-direction: column;
  padding-top: 10px;
  overflow: auto;
  max-height: 300px;
`;
const BridgeContainer = styled.div`
  display: flex;
  flex-direction: row;
`;
const DetailHeadline = styled(Text)`
  color: ${colors.lightgray};
  font-size: 12px;
  :not(:first-child) {
    margin-top: 10px;
  }
`;
const SmallText = styled(Text)`
  font-size: 10px;
  color: ${colors.white};
`;
const Warning = styled(Text)`
  color: ${colors.warning};
`;
const Error = styled(Text)`
  font-size: 7pt;
  max-width: 90%;
  color: ${colors.invalid};
`;
const TextButton = styled(Text)`
  font-size: 10pt;
  font-weight: 600;
  cursor: pointer;
`;

const Button = styled.td<{ disabled: boolean }>`
  font-family: ${fonts.regular};
  border: 2px solid ${colors.uiForeground};
  padding: 8px;
  color: ${colors.white};
  text-align: center;
  transition: all 200ms ease;
  user-select: none;
  font-size: 12px;
  ${(p) =>
    !p.disabled &&
    `
    cursor: pointer;
  `}
  ${(p) =>
    p.disabled
      ? `
    background: repeating-linear-gradient(
      -45deg,
      #222,
      #222 1px,
      #333 10px,
      #333 20px
    );
    color: ${colors.greyed};
    
  `
      : ""}
  ${(p) =>
    !p.disabled &&
    `
    :hover {
      background-color: ${colors.uiForeground};
      color: #000;
    }
  `}
`;
