import { GameSelection, TerrainType } from "../manager/SelectionManager";
import { ToolManager } from "../manager/ToolManager";
import GameManager from "../../Backend/Game/GameManager";
import { WorldCoord } from "../../_types/GlobalTypes";
// Transforms a set of coords into mineable, claimable, and upgradeable

export class TerrainModificationSystem {
  update(selection: GameSelection, toolManager: ToolManager, gm: GameManager) {
    this.getMineClaimCoords(selection, toolManager, gm);
    this.getUpgradeCoords(selection, toolManager, gm);
  }

  private getMineClaimCoords(selection: GameSelection, toolManager: ToolManager, gm: GameManager) {
    if (selection.selectedCoords.length === 0) return;
    const mineClaim = toolManager.tools.mineOrClaim.getMineClaimTiles(selection.selectedCoords);
    if (mineClaim) {
      const { mineable, claimable, forceMine } = mineClaim;
      selection.setTerrainCoords(mineable, TerrainType.Mine);
      selection.setTerrainCoords(claimable, TerrainType.Claim);
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
