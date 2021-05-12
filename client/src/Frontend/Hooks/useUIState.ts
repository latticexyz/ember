import { useMemo } from "react";
import { UIManager, UIState } from "../UIManager";

export function useUIState(): UIState {
  return useMemo(() => UIManager.getInstance().state, []);
}
