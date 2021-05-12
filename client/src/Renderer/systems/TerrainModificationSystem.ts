import { GameSelection, TerrainType } from "../manager/SelectionManager";
import { ToolManager } from "../manager/ToolManager";
import GameManager from "../../Backend/Game/GameManager";
import { WorldCoord } from "../../_types/GlobalTypes";
// Transforms a set of coords into mineable, claimable, and upgradeable

export class TerrainModificationSystem {
  update(selection: GameSelection, toolManager: ToolManager, gm: GameManager) {
    this.getMineCoords(selection, toolManager, gm);
    this.getUpgradeCoords(selection, toolManager, gm);
  }

  private getMineCoords(selection: GameSelection, toolManager: ToolManager, gm: GameManager) {
    if (selection.selectedCoords.length === 0) return;
    const mine = toolManager.tools.mine.getMineTiles(selection.selectedCoords);
    if (mine) {
      const { mineable, forceMine } = mine;
      selection.setTerrainCoords(mineable, TerrainType.Mine);
      selection.setTerrainCoords(forceMine, TerrainType.ForceMine);
    }
  }

  private getUpgradeCoords(selection: GameSelection, toolManager: ToolManager, gm: GameManager) {
    if (selection.selectedCoords.length === 0) return;
    const upgrade: WorldCoord[] = [];
    for (const c of selection.selectedCoords) {
      const extended = gm.extendedDungeon.tiles.get(c);
      if (!extended) continue;
      if (extended.owner === gm.address) {
        upgrade.push(c);
      }
    }
    const upgradeableCoords = toolManager.tools.upgrade.getUpgradeableCoords(upgrade);
    selection.setTerrainCoords(upgradeableCoords, TerrainType.Upgrade);
  }
}
