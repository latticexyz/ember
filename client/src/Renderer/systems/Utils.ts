import { GameSelection } from "../manager/SelectionManager";
import { ToolManager } from "../manager/ToolManager";

export function clearCoordSelection(selection: GameSelection) {
  selection.setSelectedCoords([]);
  selection.dragStart = undefined;
  selection.dragEnd = undefined;
  selection.tileSelectionPolygon.clear();
}

export function clearSelection(selection: GameSelection, toolManager: ToolManager) {
  clearCoordSelection(selection);
  toolManager.tools.creature.clearCreatureSelection();
}
