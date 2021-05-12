import React, { useMemo, useState } from "react";
import { observer } from "mobx-react-lite";
import styled from "styled-components";

import { InfoModal } from "../../../Common/InfoModal";
import { useGameManager } from "../../../../Hooks/useGameManager";
import { useUIState } from "../../../../Hooks/useUIState";
import { notNull } from "../../../../../Backend/Utils/Utils";
import { CreatureListItem } from "./CreatureListItem";
import { getCreatureGroupBoost } from "../../InteractDetails/Utils/getCreatureGroupBoost";
import { HeadlineRow, Headline, Subheadline } from "./Shared";

export const CreatureList: React.FC<{ title: string; creatureIds: string[], supportsMultiMove?: boolean }> = observer(({ creatureIds, title, supportsMultiMove }) => {
  const uiState = useUIState();
  const gm = useGameManager();

  const [detailIndex, setDetailIndex] = useState<number | null>(null);

  const creatures = useMemo(() => {
    if (!gm) return [];
    return creatureIds.map((id) => gm.extendedDungeon.creatures.get(id)).filter(notNull);
  }, [creatureIds, gm?.extendedDungeon.creatures]);

  const boosts = useMemo(
    () => {
      if (!gm) return [];
      return getCreatureGroupBoost(creatures, gm.constants.gameConstants)
    },
    [creatures, gm?.constants.gameConstants]
  );

  // Get a list of picked destination tiles for each selected creature. These are empty initially.
  const selectedDestinationsForCreatures = useMemo(() => {
    return creatureIds.map(id => {
      const destination = uiState.getDestinationForCreatureInMultiCreatureMove(id);
      const currentlySelectingId = uiState.getCurrentlySelectingCreatureId();
      if (destination !== undefined) {
        return `(${destination.x}, ${destination.y})`;
      } else {
        return id === currentlySelectingId ? `Selecting...` : 'TBD';
      }
    });
  }, [creatures, uiState.creatureMovementData.multiMoveCurrentlySelectedCreatureId]);

  const multiMoveCurrentlyPlanning = uiState.creatureMovementData.multiMoveCurrentlyPlanning;

  // If we support a multi-move, then we should add ability to select destination per-creature, but
  // only when we are in the middle of a multi-creature move.
  if (supportsMultiMove && multiMoveCurrentlyPlanning) {
    const creatureList = useMemo(() => {
      return creatures.map((creature, index) => (
        <MultiMoveContainer>
          <CreatureListItem
            key={"creature-list-item-" + index}
            creature={creature}
            boost={boosts[index]}
            details={creatures.length === 1 || index === detailIndex}
            onClick={() => {
              if (index === detailIndex) {
                setDetailIndex(null);
              } else {
                setDetailIndex(index);
              }
            }}
          />
          <CreatureDestinationContainer onClick={() => {
            uiState.startSelectingDestinationForCreatureInMultiCreatureMove(creatureIds[index]);
          }}>
            <HeadlineRow>
              <Headline>Destination</Headline>
              <Subheadline>
                {selectedDestinationsForCreatures[index]}
              </Subheadline>
            </HeadlineRow>
          </CreatureDestinationContainer>
        </MultiMoveContainer>
      ));
    }, [boosts, creatures, detailIndex, selectedDestinationsForCreatures, multiMoveCurrentlyPlanning]);

    return <InfoModal title={title} body={<Container>{creatureList}</Container>} padding={15} />;
  } else {
    const creatureList = useMemo(() => {
      return creatures.map((creature, index) => (
        <CreatureListItem
          key={"creature-list-item-" + index}
          creature={creature}
          boost={boosts[index]}
          details={creatures.length === 1 || index === detailIndex}
          onClick={() => {
            if (index === detailIndex) {
              setDetailIndex(null);
            } else {
              setDetailIndex(index);
            }
          }}
        />
      ));
    }, [boosts, creatures, detailIndex, selectedDestinationsForCreatures, multiMoveCurrentlyPlanning]);

    return <InfoModal title={title} body={<Container>{creatureList}</Container>} padding={15} />;
  }
});

const Container = styled.div`
  display: grid;
  grid-auto-flow: row;
  grid-gap: 5px;
`;

const MultiMoveContainer = styled.div`
  grid-gap: 30px;
  display: grid;
  justify-content: space-between;
  grid-auto-flow: column;
`;

const CreatureDestinationContainer = styled.div`
  display: grid;
  grid-auto-flow: column;
  justify-content: space-between;
  grid-gap: 10px;

  padding: 1px 10px 10px 10px;
  border-radius: 2px;

  transition: all 200ms ease;
  cursor: pointer;

  background-color: rgba(255, 255, 255, 0.1);

  :hover {
    background-color: rgba(255, 255, 255, 0.15);
  }
`;
