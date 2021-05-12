import { GameMap } from "../objects/main/map";
import { GameSelection } from "../manager/SelectionManager";
import { InputState } from "../manager/InputManager";
import { ToolManager } from "../manager/ToolManager";
import { getWorldCoordsAtPointerPosition } from "../../Backend/Utils/Utils";
import { clearSelection } from "./Utils";
import { UIManager } from "../../Frontend/UIManager";

// Handles actions for selecting and moving creatures around the game.
export class CreatureMoveSystem {
  update(input: InputState, gameSelection: GameSelection, toolManager: ToolManager, gameMap: GameMap) {
    // Handle changing the creature selection.
    if (input.currentInput.has("shiftClick")) {
      this.onMouseUp(gameSelection, input.doubleClick, toolManager, gameMap, true);
    } else if (input.currentInput.has("mouseUp")) {
      this.onMouseUp(gameSelection, input.doubleClick, toolManager, gameMap, false);
    }

    // Handle canceling the selection.
    if (input.currentInput.has("cancelAction")) {
      this.onCancel(gameSelection, toolManager);
    }

    // Handle moving a creature or selecting a move as part of a multi-creature move.
    if (input.currentInput.has("rightClick")) {
      this.onRightClick(gameSelection, toolManager, input, gameMap);
    }

    // Handle starting or completing a multi-creature move.
    if (input.currentInput.has("multiCreatureMove")) {
      toolManager.tools.creature.startOrCompleteMultiCreatureMove();
    }

    // Peform any action when cursor stopped moving.
    if (input.currentInput.has("cursorStoppedMoving")) {
      const currentTile = getWorldCoordsAtPointerPosition(input, gameMap);
      toolManager.tools.creature.updatePathToCurrentTile(currentTile);
    }

    // Perform any action when cursor is moving.
    if (input.currentInput.has("cursorStartedMoving")) {
      toolManager.tools.creature.clearComputedPathToCurrentTile();
    }

    // Handle input unrelated to creature movement but where we might need to
    // react to / update some state.
    const handledInputs = ["executeAction"];
    for (const handledInput of handledInputs) {
      if (input.currentInput.has(handledInput)) {
        toolManager.tools.creature.handleUnrelatedInputWhenMovingCreatures(handledInput);
      }
    }
  }

  private onCancel(selection: GameSelection, toolManager: ToolManager) {
    clearSelection(selection, toolManager);
  }

  private onMouseUp(
    gameSelection: GameSelection,
    doubleClick: boolean,
    toolManager: ToolManager,
    gameMap: GameMap,
    shift: boolean
  ) {
    if (gameSelection.selectedCoords.length === 0) return;

    // Unless holding 'shift', clear the selection.
    if (gameSelection.selectedCreatureIds.size > 0 && !shift) {
      gameSelection.clearCreatures();
    }

    const { creatures } = toolManager.tools.creature.getCreaturesAtCoords(gameSelection.selectedCoords);
    const hasCreatures = creatures.length > 0;

    if (!hasCreatures) return;

    gameSelection.clearGameSelection();
    toolManager.tools.creature.handleUpdateSelection(gameSelection.selectedCoords, shift, doubleClick);
  }

  onRightClick(selection: GameSelection, toolManager: ToolManager, input: InputState, gameMap: GameMap): void {
    const destinationTile = getWorldCoordsAtPointerPosition(input, gameMap);
    if (!destinationTile) {
      clearSelection(selection, toolManager);
      return;
    }
    if (selection.selectedCreatureIds.size > 0) {
      if (toolManager.tools.creature.isCurrentlyPlanningMultiCreatureMove()) {
        // Call function to save the destination for whatever creature is currently
        // being selected as part of a multi-creature move.
        toolManager.tools.creature.finishCurrentlySelectingCreatureForMove(destinationTile);
      } else {
        toolManager.tools.creature.completeSingleCreatureDestinationMove(destinationTile);
      }
    }
  }
}
