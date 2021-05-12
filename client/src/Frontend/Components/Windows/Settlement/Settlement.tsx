import React, { useState, useMemo } from "react";
import { Text } from "../../Common/Text";
import styled from "styled-components";
import { useGameManager } from "../../../Hooks/useGameManager";
import { InfoModal } from "../../Common/InfoModal";
import { CreatureSpecies, Resource } from "../../../../_types/ContractTypes";
import { DetailsList, ItemType } from "../../Common/DetailsList";
import { Player, WorldCoord } from "../../../../_types/GlobalTypes";
import { observer } from "mobx-react-lite";
import { tileCoordToRegionCoord } from "../../../../Backend/Utils/Utils";
import { action } from "mobx";

export const Settlement = observer(({ coord }: { coord: WorldCoord }) => {
  const gm = useGameManager();

  if (!gm) return null;

  const regionCoord = tileCoordToRegionCoord(coord);

  const constants = gm.constants.gameConstants;
  const player = gm.extendedDungeon.players.get(gm.address) as Player;
  const settlement = gm.extendedDungeon.settlements.get(regionCoord);
  const creaturesInRegion = gm.extendedDungeon.getCreaturesInRegion(regionCoord);
  if (!settlement) {
    return null;
  }

  const numberOfSettlementsOwnerByPlayer = [...gm.extendedDungeon.settlements.values()].filter(
    (s) => s.owner === gm.address
  ).length;
  const priceIncrease =
    constants.SETTLEMENT_PRICE_PERCENT_INCREASE_PER_UNIT[numberOfSettlementsOwnerByPlayer - 1] / 100;
  const goldPrice =
    settlement.level < 2
      ? Math.floor(priceIncrease * constants.SETTLEMENT_PRICE_PER_LEVEL[settlement.level + 1][Resource.GOLD])
      : 0;
  const soulsPrice =
    settlement.level < 2
      ? Math.floor(priceIncrease * constants.SETTLEMENT_PRICE_PER_LEVEL[settlement.level + 1][Resource.SOULS])
      : 0;
  const canPay = player.gold >= goldPrice && player.souls >= soulsPrice;
  const cantUpgradeFurther = settlement.level >= 2;
  const hasHero = creaturesInRegion.find((c) => c.species === CreatureSpecies.HERO && c.owner === gm.address);

  const details = (
    <DetailsList
      details={[
        {
          type: ItemType.Headline,
          title: "Next Upgrade",
        },
        {
          type: ItemType.Detail,
          title: "Level",
          value: settlement.level + 2,
        },
        { type: ItemType.Detail, title: "Gold cost", value: goldPrice > 0 ? goldPrice : "∞" },
        { type: ItemType.Detail, title: "Souls cost", value: soulsPrice > 0 ? soulsPrice : "∞" },
      ]}
    />
  );

  const buttonTitle = useMemo(() => {
    if (!canPay) {
      return "Not enough resources";
    }

    if (cantUpgradeFurther) {
      return "Settlement at highest level";
    }

    return `Upgrade Settlement`;
  }, [canPay, cantUpgradeFurther]);
  const actions: {
    title: string;
    subtitle?: React.ReactChild;
    onClick?: () => void;
  }[] = [];
  actions.push({
    title: buttonTitle,
    onClick: canPay && !cantUpgradeFurther ? () => gm.upgradeSettlement(regionCoord) : undefined,
  });
  actions.push({
    title: `Destroy Settlement ${!hasHero ? "(need hero!)" : ""}`,
    onClick: hasHero
      ? () => {
          if (confirm("Destroy settlement?")) {
            gm.destroySettlement(regionCoord);
          }
        }
      : undefined,
  });

  return <InfoModal title={"Ugprade Settlement"} body={<Container>{details}</Container>} actions={actions} />;
});

const Container = styled.div``;
