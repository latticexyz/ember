import React, { useState, useMemo } from "react";
import { Text } from "../../Common/Text";
import styled from "styled-components";
import { useGameManager } from "../../../Hooks/useGameManager";
import { InfoModal } from "../../Common/InfoModal";
import { CreatureSpecies, CreatureType, CreatureStat, Resource } from "../../../../_types/ContractTypes";
import { DetailsList, ItemType, DetailListItem } from "../../Common/DetailsList";
import { Player, WorldCoord } from "../../../../_types/GlobalTypes";
import { creatureSpeciesToName, creatureTypeToName } from "../../../../Backend/Game/Naming";
import { creatureToSpritesheet } from "./constants";
import { getCreatureEffect } from "../InteractDetails/Utils/getCreatureEffect";
import { observer } from "mobx-react-lite";
import { tileCoordToRegionCoord } from "../../../../Backend/Utils/Utils";
import { Lifebar } from "../CreatureOverview/Components/Lifebar";
import { colors } from "../../../../theme";
import { ChainTimeUpdate } from "../InteractDetails/Components/ChainTimeUpdate";
import { Space } from "../../Common/Space";
import { Spritesheet } from "../../Spritesheet";
import { SoundManager, SoundType } from "../../../../Renderer/manager/SoundManager";

const AVAILABLE_CREATURE_TYPES = [
  CreatureType.NORMAL,
  CreatureType.RED,
  CreatureType.BLACK,
  CreatureType.BLUE,
  CreatureType.UNIQUE,
];
const AVAILABLE_CREATURE_SPECIES = [CreatureSpecies.BALANCED];

export const SummonCreatures = observer(({ coord }: { coord: WorldCoord }) => {
  const gm = useGameManager();

  const [selectedIndex, setSelectedIndex] = useState(0);
  const selectedCreature = useMemo(() => {
    const species = selectedIndex % AVAILABLE_CREATURE_SPECIES.length;
    const creatureType = Math.floor(selectedIndex / AVAILABLE_CREATURE_SPECIES.length);
    return { species, creatureType };
  }, [selectedIndex]);

  const summonSelected = () => {
    if (!gm) return;
    gm.spawnCreature(coord, selectedCreature.species, selectedCreature.creatureType);
    SoundManager.register(SoundType.ACTION);
  };

  const gridItems: React.ReactElement[] = [];

  for (const creatureType of AVAILABLE_CREATURE_TYPES) {
    for (const creatureSpecies of AVAILABLE_CREATURE_SPECIES) {
      const index = creatureType * AVAILABLE_CREATURE_SPECIES.length + creatureSpecies;
      gridItems.push(
        <GridImage
          key={"creaure-portrait-" + index}
          selected={selectedIndex === index}
          onClick={() => setSelectedIndex(index)}
        >
          <Spritesheet spriteWidth={24} imgPath={creatureToSpritesheet[creatureSpecies][creatureType]} nFrames={4} />
        </GridImage>
      );
    }
  }

  const constants = gm?.constants.gameConstants;
  const player = gm?.extendedDungeon.players.get(gm.address) as Player;

  const isUnique = selectedCreature.creatureType === CreatureType.UNIQUE;
  const maxLife = constants ? constants.CREATURES_BASE_STAT_PER_SPECIES[selectedCreature.species][CreatureStat.LIFE] *
    (isUnique ? constants.CREATURES_UNIQUE_STAT_MULTIPLIER : 1) : 0;
  const attack = constants ?
    constants.CREATURES_BASE_STAT_PER_SPECIES[selectedCreature.species][CreatureStat.ATK] *
    (isUnique ? constants.CREATURES_UNIQUE_STAT_MULTIPLIER : 1) : 0;
  const goldPrice = constants ? constants.CREATURES_PRICE[selectedCreature.species][selectedCreature.creatureType][Resource.GOLD] : 0;
  const soulsPrice = constants ? constants.CREATURES_PRICE[selectedCreature.species][selectedCreature.creatureType][Resource.SOULS] : 0;
  const canPay = player.gold >= goldPrice && player.souls >= soulsPrice;
  const exceedsPopulation = player.population + 1 > player.maxPopulation;

  const regionCoord = tileCoordToRegionCoord(coord);
  const creaturesInRegion = gm ? gm.extendedDungeon.getCreaturesInRegion(regionCoord) : [];
  const timeSinceSummon = gm ? gm.net.predictedChainTime - gm.extendedDungeon.getLastSpawnTimestampInRegion(regionCoord) : 0;
  const secondsToWait = constants ? Math.max(0, constants.CREATURES_MIN_SECOND_DELAY_BETWEEN_SPAWN - timeSinceSummon) : 0;

  const effect = constants ? getCreatureEffect(selectedCreature, constants) : null;
  const effectItems: DetailListItem[] =
    effect === null
      ? []
      : [
        { type: ItemType.Headline, title: "Effect" },
        { type: ItemType.Text, value: effect },
      ];

  const details = (
    <DetailsList
      details={[
        {
          type: ItemType.Headline,
          title: "Species",
        },
        {
          type: ItemType.Text,
          value: `${creatureTypeToName[selectedCreature.creatureType]} ${creatureSpeciesToName[selectedCreature.species]
            }`,
        },
        {
          type: ItemType.Headline,
          title: "Stats",
        },
        { type: ItemType.Detail, title: "Attack", value: attack },
        { type: ItemType.Detail, title: "Life", value: maxLife },
        ...effectItems,
        {
          type: ItemType.Headline,
          title: "Price",
        },
        { type: ItemType.Detail, title: "Gold", value: goldPrice },
        { type: ItemType.Detail, title: "Souls", value: soulsPrice },
      ]}
    />
  );

  const buttonTitle = useMemo(() => {
    if (!canPay) {
      return "Not enough resources";
    }

    if (exceedsPopulation) {
      return "Population limit reached";
    }

    if (creaturesInRegion.length >= 8) {
      return "Region contains 8 creatures";
    }

    if (secondsToWait > 0) {
      return "Queue summon";
    }

    return "Summon";
  }, [secondsToWait, canPay, creaturesInRegion.length, exceedsPopulation]);

  const progressBarValue = useMemo(() => {
    if (!constants) return 0;
    return constants.CREATURES_MIN_SECOND_DELAY_BETWEEN_SPAWN - secondsToWait;
  }, [secondsToWait, constants]);
  const progressBarMax = constants ? constants.CREATURES_MIN_SECOND_DELAY_BETWEEN_SPAWN : 0;

  return (
    <InfoModal
      title={"Summon creatures"}
      body={
        <Container>
          <CreatureGrid>{gridItems}</CreatureGrid>
          {details}
          {secondsToWait <= 0 ? undefined : (
            <ProgressbarContainer>
              <Subheadline>Wait until next spawn</Subheadline>
              <LifeBarContainer>
                <Lifebar
                  value={progressBarValue}
                  max={progressBarMax}
                  horizontal
                  innerColor={colors.uiForeground}
                />
                <Space h={5} />
                <ChainTimeUpdate />
              </LifeBarContainer>
            </ProgressbarContainer>
          )}
        </Container>
      }
      actions={[
        {
          title: buttonTitle,
          onClick: canPay && !exceedsPopulation && creaturesInRegion.length < 8 ? summonSelected : undefined,
        },
      ]}
    />
  );
});

const Container = styled.div``;

const CreatureGrid = styled.div`
  display: grid;
  margin-left: 8px;
  grid-auto-flow: column;
  justify-content: start;
  margin-bottom: 5px;
`;

const GridImage = styled.div<{ selected: boolean }>`
  opacity: ${(p) => (p.selected ? 1 : 0.3)};
  cursor: pointer;
  transition: opacity 200ms ease;
  margin-top: 12px;
  margin-bottom: 12px;
  margin-right: 24px;

  :hover {
    opacity: ${(p) => (p.selected ? 1 : 0.7)};
  }
`;

const PortraitImage = styled.img`
  width: 50px;
  margin-right: 10px;
`;

const Subheadline = styled(Text)`
  color: ${colors.lightgray};
  font-size: 12px;
  display: block;
  margin-bottom: 5px;
`;

const ProgressbarContainer = styled.div`
  width: 100%;
  margin: 20px 0 -10px 0;
`;

const LifeBarContainer = styled.div`
  display: grid;
  grid-template-columns: 1fr 5px auto;
  align-items: center;
  height: 10px;
`;
