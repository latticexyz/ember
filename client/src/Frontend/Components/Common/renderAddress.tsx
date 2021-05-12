import React from "react";
import { ethers } from "ethers";
import { getColorFromEthAddress } from "../../../Renderer/utils/colors";
import { EthAddress } from "../../../_types/GlobalTypes";
import { Text } from "./Text";
import { ColorKey, colors } from "../../../Renderer/constants";
import { NameQueue, QueueRequestType } from "../../../Backend/Utils/NameQueue";
import { Tooltip, TooltipDirection } from "../Tooltips";
import styled from "styled-components";
import { useGameManager } from "../../Hooks/useGameManager";
import { useMemo } from "react";
import { observer } from "mobx-react-lite";

export const PlayerName = ({
  address,
  nickname,
  ens,
  you,
}: {
  address: EthAddress;
  nickname: string | undefined;
  ens: string | undefined;
  you: boolean;
}) => {
  // all possible states:
  // no ens and no nickname -> render address
  // nickname but no ens -> render nickname
  // nickname and ens -> render nickname
  // ens but no nickname -> render ens
  let mainContent: string[] = [];

  if (nickname) {
    mainContent.unshift(nickname);
  }
  if (ens) {
    mainContent.unshift(ens);
  }
  mainContent.unshift(address.substring(0, 19));
  const thingToRender = mainContent[mainContent.length - 1];
  const tooltipContent = mainContent.length > 1 ? mainContent[mainContent.length - 2] : undefined;

  return (
    <>
      {tooltipContent ? (
        <Tooltip direction={TooltipDirection.Top} text={tooltipContent}>
          <Text>
            {thingToRender}...
            {you && " (you)"}
          </Text>
        </Tooltip>
      ) : (
        <Text>
          {thingToRender}...
          {you && " (you)"}
        </Text>
      )}
    </>
  );
};

export const Address = observer(({ address, you, nq }: { address: EthAddress; you: boolean; nq: NameQueue }) => {
  const info = nq.getPlayerInfoFromAddress(address);
  if (address === ethers.constants.AddressZero) {
    return <Text>no one</Text>;
  } else {
    return (
      <Container>
        <AddressColorSquare address={address} />
        <PlayerName address={address} nickname={info.nickname} ens={info.ens} you={you} />
        {!info.ens && !info.nickname && (
          <Tooltip direction={TooltipDirection.Top} text="Refresh ENS">
            <RefreshBtn
              onClick={() =>
                nq.add({
                  address,
                  reqType: [QueueRequestType.ENS],
                })
              }
            >
              <RefreshIcon />
            </RefreshBtn>
          </Tooltip>
        )}
      </Container>
    );
  }
});

export const AddressWithExplorer = observer(({ address, you, nq, explorerUrl }: { address: EthAddress; you: boolean; nq: NameQueue, explorerUrl: string }) => {
  const info = nq.getPlayerInfoFromAddress(address);
  if (address === ethers.constants.AddressZero) {
    return <Text>no one</Text>;
  } else {
    return (
      <Container>
        <AddressColorSquare address={address} />
        <PlayerName address={address} nickname={info.nickname} ens={info.ens} you={you} />
        <ExplorerLink onClick={() => {
          window.open(`${explorerUrl}/address/${address}`, '_blank');
        }}>🔗</ExplorerLink>
      </Container>
    );
  }
});

// Need this because of the way getTileDetails and getRegionDetails are rendered.
// Using a mobX wrapped component in the above will break for some reason.
export const UnobservedAddress = ({ address, you, nq }: { address: EthAddress; you: boolean; nq: NameQueue }) => {
  const info = nq.getPlayerInfoFromAddress(address);
  if (address === ethers.constants.AddressZero) {
    return <Text>no one</Text>;
  } else {
    return (
      <Container>
        <AddressColorSquare address={address} />
        <PlayerName address={address} nickname={info.nickname} ens={info.ens} you={you} />
        {!info.ens && !info.nickname && (
          <Tooltip direction={TooltipDirection.Top} text="Refresh ENS">
            <RefreshBtn
              onClick={() =>
                nq.add({
                  address,
                  reqType: [QueueRequestType.ENS],
                })
              }
            >
              <RefreshIcon />
            </RefreshBtn>
          </Tooltip>
        )}
      </Container>
    );
  }
};

const AddressColorSquare = ({ address }: { address: EthAddress }) => {
  const gm = useGameManager();
  if (!gm) return null;
  const playerColor = useMemo(() => {
    return gm.extendedDungeon.player === address
      ? "#" + colors[ColorKey.Player]!.toString(16)
      : getColorFromEthAddress(address).rgba;
  }, []);
  return <ColorSquare color={playerColor} />;
};

const RefreshIcon = () => {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M1.90321 7.29677C1.90321 10.341 4.11041 12.4147 6.58893 12.8439C6.87255 12.893 7.06266 13.1627 7.01355 13.4464C6.96444 13.73 6.69471 13.9201 6.41109 13.871C3.49942 13.3668 0.86084 10.9127 0.86084 7.29677C0.860839 5.76009 1.55996 4.55245 2.37639 3.63377C2.96124 2.97568 3.63034 2.44135 4.16846 2.03202L2.53205 2.03202C2.25591 2.03202 2.03205 1.80816 2.03205 1.53202C2.03205 1.25588 2.25591 1.03202 2.53205 1.03202L5.53205 1.03202C5.80819 1.03202 6.03205 1.25588 6.03205 1.53202L6.03205 4.53202C6.03205 4.80816 5.80819 5.03202 5.53205 5.03202C5.25591 5.03202 5.03205 4.80816 5.03205 4.53202L5.03205 2.68645L5.03054 2.68759L5.03045 2.68766L5.03044 2.68767L5.03043 2.68767C4.45896 3.11868 3.76059 3.64538 3.15554 4.3262C2.44102 5.13021 1.90321 6.10154 1.90321 7.29677ZM13.0109 7.70321C13.0109 4.69115 10.8505 2.6296 8.40384 2.17029C8.12093 2.11718 7.93465 1.84479 7.98776 1.56188C8.04087 1.27898 8.31326 1.0927 8.59616 1.14581C11.4704 1.68541 14.0532 4.12605 14.0532 7.70321C14.0532 9.23988 13.3541 10.4475 12.5377 11.3662C11.9528 12.0243 11.2837 12.5586 10.7456 12.968L12.3821 12.968C12.6582 12.968 12.8821 13.1918 12.8821 13.468C12.8821 13.7441 12.6582 13.968 12.3821 13.968L9.38205 13.968C9.10591 13.968 8.88205 13.7441 8.88205 13.468L8.88205 10.468C8.88205 10.1918 9.10591 9.96796 9.38205 9.96796C9.65819 9.96796 9.88205 10.1918 9.88205 10.468L9.88205 12.3135L9.88362 12.3123C10.4551 11.8813 11.1535 11.3546 11.7585 10.6738C12.4731 9.86976 13.0109 8.89844 13.0109 7.70321Z"
        fill="currentColor"
        fillRule="evenodd"
        clipRule="evenodd"
      ></path>
    </svg>
  );
};

const RefreshBtn = styled.div`
  cursor: pointer;
  transition: all 0.2s ease-in-out;
  display: flex;
  align-items: center;
  border-radius: 4px;
  &:hover {
    background-color: rgba(255, 255, 255, 0.2);
  }
`;

const ColorSquare = styled.div<{ color: string }>`
  width: 10px;
  height: 10px;
  background-color: ${(props) => props.color};
`;

const Container = styled.div`
  display: flex;
  align-items: center;
  gap: 3px;
`;

const ExplorerLink = styled.span`
  font-size: 12px;
  &:hover {
    cursor: pointer;
  }
`;
