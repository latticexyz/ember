import { useMemo } from "react";
import { InputManager } from "../../Renderer/manager/InputManager";
import { PhaserManager } from "../../Renderer/manager/PhaserManager";

export function useInputManager(): InputManager {
    return useMemo(() => PhaserManager.getInstance().services.inputManager, []);
}
