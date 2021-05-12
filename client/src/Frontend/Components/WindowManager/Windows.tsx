import React from "react";
import { Window } from "./Window";
import { observer } from "mobx-react-lite";
import styled from "styled-components";
import { WINDOWS_CONTAINER_ID } from "./constants";
import { useUIState } from "../../Hooks/useUIState";
import { useSelectionManager } from "../../Hooks/useSelectionManager";
import { CreatureOverview, Funds, InteractDetails, Preferences, SummonCreatures } from "../Windows";
import { PlayerOverviewDetails, PlayersInViewportOverview } from "../Windows/PlayerOverviewDetails";
import { MetaWindow } from "./MetaWindow";

export const Windows = observer(() => {
  const selectionManager = useSelectionManager();
  const { showPlayerOverview, fundsWindowOpened, settingsWindowOpened } = useUIState();

  if (!selectionManager) return null;

  return (
    <Container id={WINDOWS_CONTAINER_ID}>
      <MetaWindow defaultPosition={{ x: 0, y: 100 }} fadeIn={true} id="META_WINDOW_CONTAINER">
        {selectionManager.canInspectSelection && (
          <Window windowId="interact-details" title="Details" component={<InteractDetails />} />
        )}
        {selectionManager.selectionIsDH && (
          <Window
            windowId="summon-creatures"
            title="Summon"
            component={<SummonCreatures coord={selectionManager.selectedCoords[0]} />}
          />
        )}
        {showPlayerOverview.open && (
          <Window
            windowId="player-overview-details"
            component={
              showPlayerOverview.showSearch ? (
                <PlayerOverviewDetails showSearch={true} />
              ) : (
                <PlayersInViewportOverview />
              )
            }
            title={showPlayerOverview.showSearch ? "Player Overview" : "Players in Viewport"}
          />
        )}
        {selectionManager.hasSelectedCreatures && (
          <Window windowId="creature-overview" component={<CreatureOverview />} title="Creatures" />
        )}
        {fundsWindowOpened && <Window windowId="funds" component={<Funds />} title="Funds" />}
        {settingsWindowOpened && <Window windowId="settings" component={<Preferences />} title="Settings" />}
      </MetaWindow>
    </Container>
  );
});

const Container = styled.div`
  height: 100%;
  width: 100%;
`;
