import React, { useState } from "react";
import styled from "styled-components";
import { EthAddress, RegionId, WorldCoord } from "../../../../../_types/GlobalTypes";
import { Portrait } from "../../../Portrait";
import { Text } from "../../../Common/Text";
import { Space } from "../../../Common/Space";
import { getColorFromEthAddress } from "../../../../../Renderer/utils/colors";
import { useGameManager } from "../../../../Hooks/useGameManager";
import { Input } from "../../../Common/Input";
import { colors } from "../../../../../theme";
import { Address } from "../../../Common/renderAddress";
import { QueueRequest, QueueRequestType } from "../../../../../Backend/Utils/NameQueue";
import { observer } from "mobx-react-lite";
import { Coin } from "../../../Common/Coin";
import { Soul } from "../../../Common/Soul";

interface Props {
  addr: EthAddress;
  showSearch: boolean;
}

export const PlayerOverviewCard: React.FC<Props> = observer(({ addr, showSearch }) => {
  const [currentNickname, setCurrentNickname] = useState<string | undefined>();
  const [editingNickname, setEditingNickname] = useState<boolean>(false);
  const gm = useGameManager();

  if (!gm) return null;

  const nq = gm.services.nameQueue;
  function onDeleteNickname() {
    nq.add({
      address: addr,
      reqType: [QueueRequestType.NICKNAME],
      nickname: undefined,
    });
  }
  const dungeonOwner = gm.extendedDungeon.players.get(addr);

  return (
    <OverviewCard>
      <NameRow>
        <Portrait
          width={50}
          address={addr}
          playerColor={addr === gm.address ? "rgb(170, 76, 54)" : getColorFromEthAddress(addr).rgba}
        />
        <UpperRow>
          <Address address={addr} you={gm.extendedDungeon.player === addr} nq={nq} />
          {dungeonOwner &&
            <SmallBoldText>
              <Coin style={{ height: 15, verticalAlign: "top" }} />
              {" "}
              {dungeonOwner.gold}
              {" "}
              <Soul style={{ height: 15, verticalAlign: "bottom" }} />{" "}
              {dungeonOwner.gold}
            </SmallBoldText>
          }
          {showSearch && !nq.getPlayerInfoFromAddress(addr)?.nickname && (
            <SmallText onClick={() => setEditingNickname(true)}>Edit</SmallText>
          )}
        </UpperRow>
      </NameRow>
      {
        editingNickname ? (
          <div>
            <Input placeholder="Nickname" onChange={(e) => setCurrentNickname(e.target.value)} />
            <Space h={8} />
            <SmallText
              onClick={() => {
                if (currentNickname && currentNickname !== "") {
                  nq.add({
                    address: addr,
                    reqType: [QueueRequestType.NICKNAME],
                    nickname: currentNickname,
                  } as QueueRequest);
                }
                setEditingNickname(false);
              }}
            >
              Set Nickname
            </SmallText>
            <Space h={8} />
            <SmallText
              onClick={() => {
                setEditingNickname(false);
              }}
            >
              Cancel
            </SmallText>
          </div>
        ) : (
          nq.getPlayerInfoFromAddress(addr)?.nickname &&
          showSearch && (
            <span style={{ display: "flex", alignItems: "center", gap: "8px", justifyContent: "space-between" }}>
              <SmallText onClick={() => setEditingNickname(true)}>Edit Nickname</SmallText>
              <SmallText onClick={() => onDeleteNickname()}>Delete Nickname</SmallText>
            </span>
          )
        )
      }
    </OverviewCard >
  );
});

const OverviewCard = styled.div`
  display: flex;
  flex-direction: column;
  margin: 8px auto 0 auto;
  width: 100%;
  background-color: #1c181e;
`;

const UpperRow = styled.div`
  display: flex;
  flex-direction: column;
`;

const NameRow = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  margin: 8px 0;
`;

const SmallText = styled(Text)`
  font-size: 10pt;
  color: ${colors.white};
  cursor: pointer;
`;

const SmallBoldText = styled(SmallText)`
  font-weight: 600;
  /* cursor: pointer; */
`;
