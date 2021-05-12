import React from "react";
import { Creature } from "../../../../../_types/GlobalTypes";
import { Text } from "../../../Common/Text";
import styled from "styled-components";
import { colors } from "../../../../../theme";
import { DetailsList, ItemType, DetailListItem } from "../../../Common/DetailsList";
import { Lifebar } from "./Lifebar";
import { creatureSpeciesToName, creatureTypeToName } from "../../../../../Backend/Game/Naming";
import { useGameManager } from "../../../../Hooks/useGameManager";
import { CreatureStat, CreatureType, Resource } from "../../../../../_types/ContractTypes";
import { creatureToReactSpritesheet } from "../../SummonCreatures/constants";
import { getCreatureEffect } from "../../InteractDetails/Utils/getCreatureEffect";
import { Spritesheet } from "../../../Spritesheet";

export const CreatureListItem: React.FC<{ creature: Creature; boost: number; details?: boolean; onClick: () => void }> =
  ({ creature, details, boost, onClick }) => {
    const gm = useGameManager();

    if (!gm) return null;

    const constants = gm.constants.gameConstants;
    const isUnique = creature.creatureType === CreatureType.UNIQUE;
    const groupBoost = isUnique && boost > 0 ? constants.CREATURES_UNIQUE_GROUP_NEG_BOOST / 100 : boost;
    const maxLife =
      constants.CREATURES_BASE_STAT_PER_SPECIES[creature.species][CreatureStat.LIFE][creature.level] *
      (isUnique ? constants.CREATURES_UNIQUE_STAT_MULTIPLIER : 1);
    const spritesheet = creatureToReactSpritesheet[creature.species][creature.creatureType];
    const attack =
      constants.CREATURES_BASE_STAT_PER_SPECIES[creature.species][CreatureStat.ATK][creature.level] *
      (isUnique ? constants.CREATURES_UNIQUE_STAT_MULTIPLIER : 1);
    const souls = constants.CREATURES_PRICE[creature.species][creature.creatureType][Resource.SOULS];
    const effect = getCreatureEffect(creature, constants);
    const effectItems: DetailListItem[] =
      effect === null
        ? []
        : [
            { type: ItemType.Headline, title: "Effect" },
            { type: ItemType.Text, value: effect },
          ];

    if (details) {
      return (
        <DetailsContainer onClick={onClick}>
          <HeaderRow>
            <PortraitContainer>
              <Lifebar value={creature.life} max={maxLife} />
              <div style={{ marginLeft: "8px", marginRight: "12px" }}>
                <Spritesheet spriteWidth={24} nFrames={4} imgPath={spritesheet} />
              </div>
            </PortraitContainer>
            <HeadlineRow>
              <Subheadline>{`Level ${creature.level}`}</Subheadline>
              <Headline>
                {`${creatureTypeToName[creature.creatureType]} ${creatureSpeciesToName[creature.species]}`}
              </Headline>
            </HeadlineRow>
          </HeaderRow>
          <DetailsRow>
            <DetailsList
              details={[
                { type: ItemType.Headline, title: "Stats" },
                { type: ItemType.Detail, title: "Attack", value: attack },
                // { type: ItemType.Detail, title: "XP", value: 20 },
                { type: ItemType.Detail, title: "Group boost", value: `${groupBoost * 100}%` },
                { type: ItemType.Detail, title: "Life", value: `${creature.life}/${maxLife}` },
                { type: ItemType.Detail, title: "Souls", value: souls },
                ...effectItems,
              ]}
            />
          </DetailsRow>
        </DetailsContainer>
      );
    }

    return (
      <Container onClick={onClick}>
        <PortraitContainer>
          <Lifebar value={creature.life} max={maxLife} />
          <div style={{ marginLeft: "8px", marginRight: "12px", display: "flex", alignItems: "center" }}>
            <Spritesheet spriteWidth={24} nFrames={4} imgPath={spritesheet} />
          </div>
        </PortraitContainer>
        <HeadlineRow>
          <Headline>
            {`Level ${creature.level} ${creatureTypeToName[creature.creatureType]} ${
              creatureSpeciesToName[creature.species]
            }`}
          </Headline>
          <Subheadline>
            {`ATK: ${attack} ${boost > 0 ? `(${groupBoost > 0 ? "+" : ""}${groupBoost * 100}%)` : ""}`}
          </Subheadline>
          <Subheadline>{`Life: ${creature.life}/${maxLife}`}</Subheadline>
        </HeadlineRow>
      </Container>
    );
  };

const DetailsContainer = styled.div`
  transition: all 200ms ease;
  cursor: pointer;
  padding: 10px;
  border-radius: 2px;
  background-color: rgba(255, 255, 255, 0.1);

  :hover {
    background-color: rgba(255, 255, 255, 0.15);
  }
`;

const PortraitContainer = styled.div`
  display: grid;
  grid-auto-flow: column;
  grid-gap: 5px;
`;

const HeaderRow = styled.div`
  display: grid;
  grid-template-columns: auto auto auto;
  justify-content: start;
`;

const HeadlineRow = styled.div`
  display: grid;
  auto-flow: row;
  align-content: center;
`;

const DetailsRow = styled.div`
  margin-top: 10px;
  max-width: 200px;
`;

const Container = styled.div`
  display: grid;
  grid-template-columns: auto auto auto;
  justify-content: start;
  transition: all 200ms ease;
  cursor: pointer;
  padding: 2px 0px;
  border-radius: 2px;

  :hover {
    background-color: rgba(255, 255, 255, 0.1);
  }
`;

const Headline = styled(Text)`
  display: block;
  font-size: 13px;
`;
const Subheadline = styled(Text)`
  display: block;
  color: ${colors.lightgray};
  font-size: 12px;
`;

const PortraitImage = styled.img`
  width: 47px;
  margin-right: 10px;
`;
