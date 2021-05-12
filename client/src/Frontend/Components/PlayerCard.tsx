import React from "react";
import styled from "styled-components";
import copy from "clipboard-copy";
import { ResourceType } from "../../_types/GlobalTypes";
import { observer } from "mobx-react-lite";
import { ResourceAmount } from "./Common/ResourceAmount";
import { Text } from "./Common/Text";
import { GameUI } from "./GameUI";
import { useGameManager } from "../Hooks/useGameManager";
import { Portrait } from "./Portrait";
import { Coin } from "./Common/Coin";
import { Soul } from "./Common/Soul";
import { Dai } from "./Common/Dai";
import { Population } from "./Common/Population";
import { UIManager } from "../UIManager";
import { colors } from "../../theme";
import { TooltipDirection, Tooltip } from "./Tooltips";
import heroPanel from "../../Assets/img/heroPanel.png";
import { ManaBar } from "./ManaBar";
import { AddressWithExplorer } from "./Common/renderAddress";

export const PlayerCard: React.FC = observer(() => {
  const gm = useGameManager();
  const ui = UIManager.getInstance();

  if (!gm) return null;

  const nq = gm.services.nameQueue;

  return (
    <GameUI styled>
      <img style={{ zIndex: 0, position: "absolute" }} width={220} src={heroPanel} />
      <AddressContainer>
        <Text>
          <AddressWithExplorer
            address={gm.address}
            you={false}
            nq={nq}
            explorerUrl={gm.net.getExplorerUrl()}
          />
        </Text>
      </AddressContainer>
      <PortraitContainer>
        <Portrait address={gm.address} />
      </PortraitContainer>
      <Row>
        <ResourceContainer>
          <Tooltip title="Gold" text="Gold pays for upgrades and creature summons" direction={TooltipDirection.Left}>
            <StatRow>
              <ResourceAmount
                type={ResourceType.Gold}
                amount={gm.extendedDungeon.players.get(gm.address)?.gold || 0}
                maxAmount={gm.extendedDungeon.players.get(gm.address)?.maxGold || 0}
              />
              <Coin style={{ height: 40, verticalAlign: "bottom" }} />
            </StatRow>
          </Tooltip>

          <Tooltip title="Souls" text="Souls are used to summon creatures" direction={TooltipDirection.Left}>
            <StatRow>
              <ResourceAmount
                type={ResourceType.Soul}
                amount={gm.extendedDungeon.players.get(gm.address)?.souls || 0}
                maxAmount={gm.extendedDungeon.players.get(gm.address)?.maxSouls || 0}
              />
              <Soul style={{ height: 40, verticalAlign: "bottom" }} />
            </StatRow>
          </Tooltip>

          <Tooltip
            title="Population"
            text="The total number of creatures in your dungeon"
            direction={TooltipDirection.Left}
          >
            <StatRow>
              <ResourceAmount
                type={ResourceType.Population}
                amount={gm.extendedDungeon.players.get(gm.address)?.population || 0}
                maxAmount={gm.extendedDungeon.players.get(gm.address)?.maxPopulation || 0}
              />
              <Population style={{ height: 40, verticalAlign: "bottom" }} />
            </StatRow>
          </Tooltip>

          <Tooltip title="Currency" text="Pays for transactions" direction={TooltipDirection.Left}>
            <StatRow>
              <ResourceAmount
                type={ResourceType.Dai}
                amount={Math.round(gm.net.balance * 10000) / 10000}
              />
              <Dai style={{ height: 40, verticalAlign: "bottom" }} />
            </StatRow>
          </Tooltip>
          <ManaBar
            amount={gm.extendedDungeon.players.get(gm.address)?.mana || 0}
            maxAmount={gm.constants.gameConstants.MAX_MANA || 0}
            regen={gm.constants.gameConstants.NUMBER_OF_SECONDS_FOR_ONE_MANA_REGEN}
            title="Mana"
            text="The resource used for mining, claiming and upgrading tiles."
            direction={TooltipDirection.Left}
          />
        </ResourceContainer>
      </Row>
    </GameUI>
  );
});

const Row = styled.div`
  display: grid;
  grid-template-columns: 1fr auto;
  grid-gap: 10px;
  align-items: center;
`;

const StatRow = styled.div`
  display: grid;
  padding: 5px;
  grid-auto-flow: column;
  justify-content: flex-end;
  grid-gap: 20px;
  background-color: #1c181e;
`;

const AddressContainer = styled.div`
  padding: 10px;
  padding-left: 15px;
  width: 220px;
  z-index: 2;
  position: absolute;
`;

const PortraitContainer = styled.div`
  padding: 10px;
  padding-left: 115px;
  padding-top: 75px;
  width: 220px;
  z-index: 1;
  position: absolute;
`;

const ResourceContainer = styled.div`
  padding-right: 30px;
  padding-bottom: 20px;
  padding-left: 40px;
  display: grid;
  justify-content: space-between;
  grid-auto-flow: row;
  padding-top: 185px;
  opacity: 0.8;
`;

const TextButton = styled(Text) <{ warning?: boolean }>`
  font-size: 10pt;
  font-weight: 600;
  cursor: pointer;
  color: ${(p) => (p.warning ? colors.warning : "white")};
`;

const TextButtonUnderlined = styled(TextButton) <{ warning?: boolean }>`
  text-decoration: underline;
  text-decoration-color: ${(p) => (p.warning ? colors.warning : "white")};
`;