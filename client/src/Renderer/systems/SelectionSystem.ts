import { UIManager, UIState } from "../../Frontend/UIManager";
import { GameMap } from "../objects/main/map";

import { ToolManager } from "../manager/ToolManager";
import { GameSelection } from "../manager/SelectionManager";
import { InputState } from "../manager/InputManager";
import { clearSelection } from "./Utils";
import { getRectangleCoordsFromDiagonal } from "../utils/polygon";
import { worldCoordsEq } from "../utils/worldCoords";
import { getWorldCoordsAtPointerPosition } from "../../Backend/Utils/Utils";
import { Service } from "../game";
import MainScene from "../scenes/mainScene";

// Transforms drag and drop input into a selection of coords.
export class SelectionSystem implements Service {
  private uiState: UIState = UIManager.getInstance().state;
  private gameMap: GameMap;

  constructor(private toolManager: ToolManager, private inputState: InputState) { }

  bootService(scene: MainScene) {
    this.gameMap = scene.gameMap;
  }

  destroyService() { }

  update(selection: GameSelection) {
    if (this.inputState.currentInput.has("shiftClick")) {
      selection.shift = true;
    } else {
      selection.shift = false;
    }
    if (this.inputState.currentInput.has("drag")) {
      this.onDrag(selection, this.inputState.currentInput.has("holdShift"));
    }
    if (this.inputState.currentInput.has("mouseUp")) {
      this.onMouseUp(selection, this.inputState.doubleClick);
    }
    if (this.inputState.currentInput.has("cancelAction")) {
      this.onCancel(selection);
    }
    if (!selection.hasSelectedCreatures && this.inputState.currentInput.has("rightClick")) {
      this.onCancel(selection);
    }
  }

  onDrag(selection: GameSelection, shift: boolean) {
    if (selection.madeSelection && !shift) {
      this.onCancel(selection);
      selection.madeSelection = false;
    }
    this.updateSelectedCoords(selection);
  }

  updateSelectedCoords(selection: GameSelection) {
    const pointerCoords = getWorldCoordsAtPointerPosition(this.inputState, this.gameMap);
    if (!selection.dragStart) {
      selection.dragStart = pointerCoords;
    }
    if (
      selection.dragStart &&
      selection.dragEnd &&
      pointerCoords &&
      (selection.selectedCoords.length === 0 || !worldCoordsEq(selection.dragEnd, pointerCoords))
    ) {
      selection.setSelectedCoords(getRectangleCoordsFromDiagonal(selection.dragStart, pointerCoords));
      selection.tileSelectionPolygon.clear();
      selection.tileSelectionPolygon.setDiagonalPoints(selection.dragStart, pointerCoords);
    }
    selection.dragEnd = pointerCoords;
  }

  onCancel(selection: GameSelection) {
    this.toolManager.tools.interact.clearSelection();
    if (this.uiState.showHotbar) {
      this.uiState.setShowHotbar(false);
    }
    // TODO: can we make this declarative?
    if (this.uiState.settingsWindowOpened) {
      this.uiState.setSettingsWindowOpened(false);
    }
    if (this.uiState.fundsWindowOpened) {
      this.uiState.setFundsWindowOpened(false);
    }
    if (this.uiState.showPlayerOverview) {
      this.uiState.setShowPlayerOverview(false);
    }
    clearSelection(selection, this.toolManager);
    this.uiState.setPointerOverReactUI(false);
  }

  onMouseUp(selection: GameSelection, doubleClick: boolean) {
    selection.madeSelection = true;
    const pointerCoords = getWorldCoordsAtPointerPosition(this.inputState, this.gameMap);
    // Do we really need to check for this?
    if (!pointerCoords) {
      return clearSelection(selection, this.toolManager);
    }

    const tileBelowIsUpgrade = this.toolManager.tools.upgrade.isCoordUpgrade(pointerCoords);
    if (tileBelowIsUpgrade) {
      selection.tileSelectionPolygon.clear();
    }

    const tileBelowIsCreature =
      this.toolManager.tools.creature.getCreaturesAtCoords([pointerCoords]).creatures.length > 0;

    // Don't inspect tile if you've dragged
    // or if you're clicking a creature
    if (selection.selectedCoords.length === 1 && !tileBelowIsCreature) {
      this.toolManager.handleInteractClick(doubleClick);
    }
  }
}
