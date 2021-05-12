import { useMemo } from "react";
import GameManager from "../../Backend/Game/GameManager";
import { PhaserManager } from "../../Renderer/manager/PhaserManager";
import { GameSelection, SelectionManager } from "../../Renderer/manager/SelectionManager";

export function useSelectionManager(): GameSelection | undefined {
  return useMemo(() => {
    if (GameManager.hasInstance()) {
      return PhaserManager.getInstance().services.selectionManager.state
    } else {
      return undefined;
    }
  }, []);
}
