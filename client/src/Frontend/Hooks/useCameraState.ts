import { useMemo } from "react";
import GameManager from "../../Backend/Game/GameManager";
import { CameraState } from "../../Renderer/manager/CameraState";
import { PhaserManager } from "../../Renderer/manager/PhaserManager";

export function useCameraState(): CameraState | undefined {
  return useMemo(() => {
    if (GameManager.hasInstance()) {
      return PhaserManager.getInstance().services.cameraState;
    } else {
      return undefined;
    }
  }, []);
}
