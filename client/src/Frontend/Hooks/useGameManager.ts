import { useMemo } from "react";
import GameManager from "../../Backend/Game/GameManager";

export function useGameManager(): GameManager | null {
  return useMemo(() => (GameManager.hasInstance() ? GameManager.getInstance() : null), []);
}
