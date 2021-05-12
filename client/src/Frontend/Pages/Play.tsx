// @refresh reset
import React, { useEffect, useMemo } from "react";
import { ActionQueue } from "../Components/ActionQueue";
import { Layout } from "../Components/Layout";
import { GameScene } from "../../_types/GlobalTypes";
import { ConfirmDelayedAction } from "../Components/ConfirmDelayedAction";
import { Toolbar } from "../Components/Toolbar";
import { observer } from "mobx-react-lite";
import { useUIState } from "../Hooks/useUIState";
import { AppManager } from "../AppManager";
import { PlayerCard } from "../Components/PlayerCard";
import { NotificationsLog } from "../Components/NotificationsLog";
import { Windows } from "../Components/WindowManager";
import { InputStatusToast } from "../Components/InputStatusToast";
import { NetworkCard } from "../Components/NetworkCard";
import { HelpMenu } from "../Components/HelpMenu";

export const Play: React.FC = observer(() => {
  const uiState = useUIState();
  useEffect(() => {
    const appManager = AppManager.getInstance();
    appManager.startup();

    return () => appManager.destroy();
  }, []);

  const leftOverlay = useMemo(() => {
    if (uiState.gameScene !== GameScene.Main) return;
    return <Windows />;
  }, [uiState.gameScene]);

  const dragMenu = useMemo(() => {
    if (uiState.gameScene !== GameScene.Main) return;
    return <InputStatusToast />;
  }, [uiState.gameScene]);

  const footer = useMemo(() => {
    if (uiState.gameScene !== GameScene.Main) return;

    return (
      <div>
        <Toolbar />
      </div>
    );
  }, [uiState.gameScene]);

  const rightOverlay = useMemo(() => {
    if (uiState.gameScene !== GameScene.Main) return;
    return (
      <>
        <div>
          <div style={{ float: "right" }}>
            <PlayerCard />
          </div>
        </div>
        <div>
          <div style={{ float: "right" }}>
            <HelpMenu />
            <NotificationsLog />
          </div>
        </div>
        <div>
          <div style={{ float: "right" }}>
            <ActionQueue />
          </div>
        </div>
      </>
    );
  }, [uiState.gameScene]);

  const header = useMemo(() => {
    if (uiState.gameScene !== GameScene.Main) return;
    return <NetworkCard />;
  }, [uiState.gameScene]);
  return (
    <>
      <Layout
        header={header}
        game={<div id="phaser-game"></div>}
        rightOverlay={rightOverlay}
        dragMenu={dragMenu}
        leftOverlay={leftOverlay}
        footer={footer}
      />
    </>
  );
});
