import React, { useEffect } from "react";
import styled from "styled-components";
import { observer } from "mobx-react-lite";
import { useState } from "react";
import { EthAddress } from "../../../../_types/GlobalTypes";
import { useGameManager } from "../../../Hooks/useGameManager";
import { PlayerOverviewCard } from "./Components/PlayerOverviewCard";
import { Input } from "../../Common/Input";

interface Prop {
  showSearch: boolean;
}

export const PlayerOverviewDetails: React.FC<Prop> = observer(({ showSearch }) => {
  const gm = useGameManager();
  const [query, setQuery] = useState<string>("");

  if (!gm) return null;

  const nq = gm.services.nameQueue;

  const filteredPlayers = !query
    ? [...gm.extendedDungeon.players.keys()]
    : [...gm.extendedDungeon.players.keys()].filter(
      (player) =>
        player.toString().toLowerCase().includes(query.toLowerCase()) ||
        nq.getPlayerInfoFromAddress(player).nickname?.toLowerCase().includes(query.toLowerCase()) ||
        nq.getPlayerInfoFromAddress(player).ens?.toLowerCase().includes(query.toLowerCase())
    );

  return (
    <ExpandContainer>
      {showSearch && <Input placeholder="Search" onChange={(e) => setQuery(e.target.value)} />}
      {filteredPlayers.map((addr: EthAddress, id: number) => (
        <PlayerOverviewCard addr={addr} key={id} showSearch={showSearch} />
      ))}
    </ExpandContainer>
  );
});

const ExpandContainer = styled.div`
  display: flex;
  flex-direction: column;
  padding: 15px;
  background-color: #1c181e;
  opacity: 0.8;
`;
