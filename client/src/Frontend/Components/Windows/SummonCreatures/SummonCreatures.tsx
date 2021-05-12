import React, { useState, useMemo } from "react";
import { Text } from "../../Common/Text";
import styled from "styled-components";
import { useGameManager } from "../../../Hooks/useGameManager";
import { InfoModal } from "../../Common/InfoModal";
import { CreatureSpecies, CreatureType, CreatureStat, Resource } from "../../../../_types/ContractTypes";
import { DetailsList, ItemType, DetailListItem } from "../../Common/DetailsList";
import { Player, WorldCoord } from "../../../../_types/GlobalTypes";
import { creatureSpeciesToName, creatureTypeToName } from "../../../../Backend/Game/Naming";
import { creatureToReactSpritesheet } from "./constants";
import { getCreatureEffect } from "../InteractDetails/Utils/getCreatureEffect";
import { observer } from "mobx-react-lite";
import { tileCoordToRegionCoord } from "../../../../Backend/Utils/Utils";
import { colors } from "../../../../theme";
import { Spritesheet } from "../../Spritesheet";
import { SoundManager, SoundType } from "../../../../Renderer/manager/SoundManager";
import { creature } from "../../../../Assets/tools";

const AVAILABLE_CREATURES: { species: CreatureSpecies; creatureType: CreatureType; level: number }[] = [
  {
    species: CreatureSpecies.BALANCED,
    creatureType: CreatureType.NORMAL,
    level: 0,
  },
  {
    species: CreatureSpecies.BALANCED,
    creatureType: CreatureType.RED,
    level: 0,
  },
  {
    species: CreatureSpecies.BALANCED,
    creatureType: CreatureType.BLACK,
    level: 0,
  },
  {
    species: CreatureSpecies.BALANCED,
    creatureType: CreatureType.BLUE,
    level: 0,
  },
  {
    species: CreatureSpecies.BALANCED,
    creatureType: CreatureType.UNIQUE,
    level: 0,
  },
  {
    species: CreatureSpecies.HERO,
    creatureType: CreatureType.UNIQUE,
    level: 0,
  },
];

export const SummonCreatures = observer(({ coord }: { coord: WorldCoord }) => {
  const gm = useGameManager();

  const [selectedIndex, setSelectedIndex] = useState(0);
  const selectedCreature = useMemo(() => {
    return AVAILABLE_CREATURES[selectedIndex];
  }, [selectedIndex]);

  const summonSelected = () => {
    if (!gm) return;
    gm.spawnCreature(coord, selectedCreature.species, selectedCreature.creatureType);
    SoundManager.register(SoundType.ACTION);
  };

  const gridItems: React.ReactElement[] = [];

  for (const [index, { creatureType, species: creatureSpecies }] of AVAILABLE_CREATURES.entries()) {
    gridItems.push(
      <GridImage
        key={"creaure-portrait-" + index}
        selected={selectedIndex === index}
        onClick={() => setSelectedIndex(index)}
      >
        <Spritesheet spriteWidth={24} imgPath={creatureToReactSpritesheet[creatureSpecies][creatureType]} nFrames={4} />
      </GridImage>
    );
  }

  const constants = gm?.constants.gameConstants;
  const player = gm?.extendedDungeon.players.get(gm.address) as Player;

  const isUnique = selectedCreature.creatureType === CreatureType.UNIQUE;
  const maxLife = constants ?
    constants.CREATURES_BASE_STAT_PER_SPECIES[selectedCreature.species][CreatureStat.LIFE][selectedCreature.level] *
    (isUnique ? constants.CREATURES_UNIQUE_STAT_MULTIPLIER : 1) : 0;
  const attack = constants ?
    constants.CREATURES_BASE_STAT_PER_SPECIES[selectedCreature.species][CreatureStat.ATK][selectedCreature.level] *
    (isUnique ? constants.CREATURES_UNIQUE_STAT_MULTIPLIER : 1) : 0;
  const goldPrice = constants ? constants.CREATURES_PRICE[selectedCreature.species][selectedCreature.creatureType][Resource.GOLD] : 0;
  const soulsPrice = constants ? constants.CREATURES_PRICE[selectedCreature.species][selectedCreature.creatureType][Resource.SOULS] : 0;
  const canPay = player.gold >= goldPrice && player.souls >= soulsPrice;
  const exceedsPopulation = player.population + 1 > player.maxPopulation;

  const creatures = gm ? gm.extendedDungeon.creatures.values() : [];
  const creaturesWithSameSpeciesOwnedByPlayer = [...creatures].filter(
    (c) => c.owner === player.player && selectedCreature.species === c.species
  ).length;
  const exceedsMaxAmount =
    constants && creaturesWithSameSpeciesOwnedByPlayer >= constants.MAX_CREATURES_PER_SPECIES_AND_TYPES[selectedCreature.species][selectedCreature.creatureType];

  const regionCoord = tileCoordToRegionCoord(coord);
  const settlement = gm ? gm.extendedDungeon.getSettlement(coord).settlement : null;
  const creaturesInRegion = gm ? gm.extendedDungeon.getCreaturesInRegion(regionCoord) : [];

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

    if (exceedsMaxAmount) {
      return "Too many creatures of that type already";
    }

    if (exceedsPopulation) {
      return "Population limit reached";
    }

    if (creaturesInRegion.length >= 8) {
      return "Region contains 8 creatures";
    }

    if (settlement && settlement.energy === 0) {
      return "Queue summon";
    }

    return "Summon";
  }, [canPay, creaturesInRegion.length, exceedsPopulation, settlement, exceedsMaxAmount]);

  return (
    <InfoModal
      title={"Summon creatures"}
      body={
        <Container>
          <CreatureGrid>{gridItems}</CreatureGrid>
          {details}
        </Container>
      }
      actions={[
        {
          title: buttonTitle,
          onClick:
            canPay && !exceedsPopulation && !exceedsMaxAmount && creaturesInRegion.length < 8
              ? summonSelected
              : undefined,
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
  width: 48px;
  height: 48px;

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
