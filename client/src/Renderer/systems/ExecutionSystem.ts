// Handles what happens when you press E on a selection

import { GameSelection } from "../manager/SelectionManager";
import { InputManager, InputState } from "../manager/InputManager";
import { ToolManager } from "../manager/ToolManager";
import { PhaserManager } from "../manager/PhaserManager";

export class ExecutionSystem {
  inputState: InputState;

  constructor() {
    this.inputState = PhaserManager.getInstance().services.inputManager.state;
  }

  update(selection: GameSelection, toolManager: ToolManager) {
    if (this.inputState.currentInput.has("executeAction")) {
      this.handleExecute(selection, toolManager);
    }
    if (this.inputState.currentInput.has("cancelQueued")) {
      this.handleCancel(selection, toolManager);
    }
  }

  handleCancel(selection: GameSelection, toolManager: ToolManager) {
    toolManager.handleCancel();
    selection.dragStart = undefined;
    selection.dragEnd = undefined;
    selection.tileSelectionPolygon.clear();
    selection.setSelectedCoords([]);
  }

  handleExecute(selection: GameSelection, toolManager: ToolManager) {
    selection.dragStart = undefined;
    selection.dragEnd = undefined;
    toolManager.handleAction();
    if (selection.hasUpgradeableCoords()) {
      selection.dragStart = selection.upgradeableCoords[0];
      selection.dragEnd = selection.upgradeableCoords[selection.upgradeableCoords.length - 1];
      selection.tileSelectionPolygon.setDiagonalPoints(selection.dragStart, selection.dragEnd);
      selection.setSelectedCoords(selection.upgradeableCoords);
    } else {
      selection.tileSelectionPolygon.clear();
      selection.setSelectedCoords([]);
    }
  }
}
