import GameManager from "../../Backend/Game/GameManager";
import { WorldCoord, UpgradeItem } from "../../_types/GlobalTypes";
import { isCoordUpgradable } from "../utils/tiles";
import { toJS } from "mobx";

export class UpgradeTool {
  constructor(private gm: GameManager, private map: Phaser.Tilemaps.Tilemap) {}

  public upgrade(selection: WorldCoord[], upgrade: UpgradeItem) {
    if (upgrade === UpgradeItem.Wall) {
      this.gm.initiateWallTiles(toJS(selection));
    } else {
      this.gm.upgradeTiles(toJS(selection), upgrade);
    }
  }

  public cancelUpgradeTiles(toCancel: WorldCoord[]) {
    for (const coord of toCancel) {
      this.gm.cancelUpgradeTile(coord);
      this.gm.cancelInitiateWallTile(coord);
    }
  }

  public getUpgradeableCoords(selection: WorldCoord[]) {
    const upgradeable: WorldCoord[] = [];
    for (const coord of selection) {
      if (isCoordUpgradable(coord, this.map, this.gm.address, this.gm.extendedDungeon)) {
        upgradeable.push(coord);
      }
    }
    return upgradeable;
  }

  public isCoordUpgrade(selection: WorldCoord) {
    return this.gm.extendedDungeon.getTileAt(selection).upgrade !== 0;
  }
}
