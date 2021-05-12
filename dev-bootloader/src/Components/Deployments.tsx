import { useAccount, useChainId, useProvider } from "@web3-react/core";
import { observer } from "mobx-react-lite";
import React, { useEffect } from "react";
import humanizeDuration from "humanize-duration";
import styled from "styled-components";
import { CHAIN_INFO } from "../chains";
import { DeploymentsManager, OnboardingSteps } from "../deploymentsManager";
import { hooks, metaMask } from "../metamask";
import { colors, fonts } from "../theme";
import { Text } from "./Common/Text";
import { switchToNetwork } from "../utils/switchToNetwork";

const isNumber = (val) => "number" === typeof val;

const COLOR_LOCAL = colors.pastelGreen;
const COLOR_OFFICIAL = colors.processing;

export const Deployments: React.FC = observer(() => {
  const d = DeploymentsManager.getInstance();
  const account = useAccount(hooks);
  const chainId = useChainId(hooks);
  const provider = metaMask.provider;
  const web3Provider = useProvider(metaMask, hooks);

  const processError = (e: any) => {
    let message = e.message;
    if (e.data?.message) {
      message += ". details: " + e.data.message;
    }
    d.setOnboardingError(message);
  };

  const play = async () => {
    try {
      //@ts-ignore
      await d.play(d.selectedDeployment, true);
    } catch (e) {
      processError(e);
    }
  };

  useEffect(() => {
    if (account && d.playerAddress !== account) {
      d.setPlayerAddress(account);
      d.loadDeployments();
    }
    if (chainId) {
      d.setChainId(chainId);
      if (d.selectedDeployment) {
        d.refreshOnboardingStep();
      }
    }
  }, [account, chainId, d]);
  if (d.loadingDeployments) {
    return (
      <Loading>
        <TextLoading>Loading deployments...</TextLoading>
      </Loading>
    );
  }
  return (
    <Container>
      {d.loadedDeployment.map((ld, i) => (
        <DeploymentContainer key={i} local={ld.local} official={!ld.local && ld.official}>
          {ld.local && <Badge textColor={COLOR_LOCAL}>Local</Badge>}
          {!ld.local && ld.official && <Badge textColor={COLOR_OFFICIAL}>Official</Badge>}
          <DeploymentName>{ld.name.substr(0, 25)}</DeploymentName>
          <TextTitle>chain: </TextTitle>
          <Text>
            {CHAIN_INFO[ld.chainId]?.label} ({ld.chainId})
          </Text>
          <TextTitle>client url: </TextTitle>
          <Text>{ld.clientUrl}</Text>
          <TextTitle>diamond address: </TextTitle>
          <Text>{ld.diamondAddress}</Text>
          <TextTitle>status: </TextTitle>
          <Text>
            {isNumber(ld.playerJoinedTimestamp)
              ? ld.playerJoinedTimestamp! > 0
                ? "player has joined " +
                  humanizeDuration(Date.now() - ld.playerJoinedTimestamp! * 1000, { round: true, largest: 2 }) +
                  " ago"
                : "player hasn't joined yet"
              : "loading..."}
          </Text>
          {ld.error && (
            <>
              <TextTitleError>error: </TextTitleError>
              <TextError>{ld.error}</TextError>
            </>
          )}
          <Button
            disabled={false}
            style={{ marginTop: 10, width: 100 }}
            onClick={async () => {
              await d.selectDeployment(ld);
              if (d.onboardingStep === OnboardingSteps.CAN_PLAY) {
                play();
              }
            }}
          >
            Play
          </Button>
        </DeploymentContainer>
      ))}
      {d.selectedDeployment && provider && web3Provider ? (
        <ModalContainer>
          <Modal>
            <Title>
              action needed{" "}
              <Button disabled={false} onClick={() => d.clearSelectedDeployment()}>
                x
              </Button>
            </Title>
            <TextTitle style={{ marginBottom: 10 }}>
              step {d.onboardingStep! + 1} / {OnboardingSteps.CAN_PLAY + 1}
            </TextTitle>
            {d.onboardingError && (
              <>
                <TextTitleError>onboarding error: </TextTitleError>
                <TextError>{d.onboardingError}</TextError>
              </>
            )}
            {d.onboardingStepLoading && (
              <>
                <TextLoading>loading... please wait</TextLoading>
              </>
            )}
            {d.onboardingLoadingMessage && (
              <>
                <TextLoading>{d.onboardingLoadingMessage}</TextLoading>
              </>
            )}
            {d.onboardingStep === OnboardingSteps.NEED_CORRECT_CHAIN_ID && (
              <Text>
                Incorrect chain Id selected ({chainId} is selected).{" "}
                <Link
                  onClick={async () => {
                    try {
                      await switchToNetwork({ provider: provider!, chainId: d.selectedDeployment!.chainId });
                      d.refreshOnboardingStep();
                    } catch (e) {
                      processError(e);
                    }
                  }}
                >
                  switch to {d.selectedDeployment.chainId}
                </Link>
              </Text>
            )}
            {d.onboardingStep === OnboardingSteps.NEED_BURNER_WALLET && (
              <Text>
                You currently do not have a burner wallet for this specific deployment. The private keys of this burner
                wallet will be saved in local storage.{" "}
                <Link
                  onClick={async () => {
                    try {
                      d.createBurnerWalletForSelectedDeployment();
                      d.refreshOnboardingStep();
                    } catch (e) {
                      processError(e);
                    }
                  }}
                >
                  create a burner wallet for this deployment
                </Link>
              </Text>
            )}
            {d.onboardingStep === OnboardingSteps.NEED_BURNER_WALLET_IMPERSONATION && (
              <>
                <Text>
                  Your burner wallet is not allowed to impersonate you. This will require a transaction from your
                  wallet.
                </Text>
                <Link
                  onClick={async () => {
                    try {
                      //@ts-ignore
                      await d.allowBurnerWalletToImpersonate(web3Provider!);
                      d.refreshOnboardingStep();
                    } catch (e) {
                      processError(e);
                    }
                  }}
                >
                  allow my burner wallet to impersonate me
                </Link>
              </>
            )}
            {d.onboardingStep === OnboardingSteps.CAN_PLAY && (
              <>
                <Text>You are all set!</Text>
                <Link onClick={play}>play</Link>
              </>
            )}
          </Modal>
        </ModalContainer>
      ) : null}
    </Container>
  );
});

const Badge = styled(Text)<{ textColor: string }>`
  position: absolute;
  right: 10px;
  top: 10px;
  background-color: ${(p) => p.textColor};
  padding: 3px;
  color: ${colors.black};
`;

const ModalContainer = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
  background-color: ${colors.uiBackground};
  backdrop-filter: blur(6px);
`;
const Modal = styled.div`
  width: 400px;
  padding: 15px;
  display: flex;
  flex-direction: column;
  border: 2px solid ${colors.uiForeground};
  background-color: ${colors.almostblack};
`;

const Container = styled.div`
  overflow: scroll;
  max-height: calc(100% - 40px);
  padding: 15px;
  width: 100%;
  display: grid;
  grid-template-columns: repeat(auto-fit, 350px);
  column-gap: 15px;
  row-gap: 15px;
`;

const Loading = styled.div`
  width: 100vw;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const DeploymentContainer = styled.div<{ local: boolean; official: boolean }>`
  position: relative;
  width: 100%;
  background-color: ${colors.almostblack};
  display: flex;
  flex-direction: column;
  ${(p) => {
    if (p.local || p.official) {
      return `border: 2px solid ${p.local ? COLOR_LOCAL : COLOR_OFFICIAL};`;
    }
  }}
  padding: 8px;
`;

const TextTitle = styled(Text)`
  color: ${colors.lightgray};
  font-size: 12px;
`;

const DeploymentName = styled(Text)`
  color: ${colors.white};
  text-decoration: underline;
  text-decoration-color: ${colors.lightgray};
  font-size: 17px;
  font-weight: 400;
`;

const Title = styled(Text)`
  margin-bottom: 10px;
  width: 100%;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  color: ${colors.lightgray};
  font-size: 17px;
`;

const TextTitleError = styled(TextTitle)`
  color: ${colors.invalid};
`;

const TextError = styled(Text)`
  color: ${colors.invalid};
`;

const TextLoading = styled(Text)`
  color: ${colors.processing};
`;

export const Link = styled(Text)`
  cursor: pointer;
  color: ${colors.white};
  text-decoration: underline;
  text-decoration-color: ${colors.white};
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
