import React, { useMemo } from "react";
import { useGameManager } from "../../../Hooks/useGameManager";
import { useUIState } from "../../../Hooks/useUIState";
import { observer } from "mobx-react-lite";
import { CreatureList } from "./Components/CreatureList";

export const CreatureOverview = observer(() => {
  const uiState = useUIState();
  const gm = useGameManager();

  const targetCreatures = useMemo(() => {
    if (!gm) return [];

    return uiState.creatureData.creaturesInHoverRegion.filter((creatureId) => {
      return gm.extendedDungeon.creatures.get(creatureId)?.owner !== gm.address;
    });
  }, [gm?.address, gm?.extendedDungeon.creatures, uiState.creatureData.creaturesInHoverRegion]);

  return (
    <>
      <CreatureList
        title={"Selected creatures"}
        creatureIds={uiState.creatureData.selectedCreatureIds}
        supportsMultiMove
      />
      {targetCreatures.length > 0 ? <CreatureList title={"Target creatures"} creatureIds={targetCreatures} /> : null}
    </>
  );
});
