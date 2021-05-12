import ExtendedDungeon from "../../Backend/Game/ExtendedDungeon";
import { WorldCoord, EthAddress } from "../../_types/GlobalTypes";
import { tileCoordToRegionCoord, bfs, checkInRange } from "../../Backend/Utils/Utils";
import Constants from "../../Backend/Game/Constants";
import { CheckedTypeUtils } from "../../Backend/Utils/CheckedTypeUtils";

export function isCurrentlyMineable(
  coord: WorldCoord,
  extendedDungeon: ExtendedDungeon,
  constants: Constants,
  player: EthAddress
): boolean {
  const pathRequirement = (tile: WorldCoord) => {
    const t = extendedDungeon.getTileAt(tile);
    return t.isMined && !t.isWalled;
  };

  const endRequirement = (tile: WorldCoord) => {
    const t = extendedDungeon.getTileAt(tile);
    if (!t.isMined) return false;
    if (t.isWalled) return false;
    const regionCoords = tileCoordToRegionCoord(tile);
    const { controller, disputed } = extendedDungeon.getRegionController(regionCoords);
    return controller === player && !disputed;
  };

  return !!bfs({
    start: coord,
    checkDiagonal: true,
    pathRequirement: (coord) => checkInRange(constants.MAX_X, constants.MAX_Y)(coord) && pathRequirement(coord),
    endRequirement,
  });
}

export function needsForceMine(coord: WorldCoord, player: EthAddress, extendedDungeon: ExtendedDungeon) {
  const tile = extendedDungeon.getTileAt(coord);
  const region = tileCoordToRegionCoord(coord);
  const { controller, disputed } = extendedDungeon.getRegionController(region);
  const regionIsControlledByOtherPlayer = controller !== player && controller !== CheckedTypeUtils.EMPTY_ADDRESS;
  const tileNeedsForceMine = !tile.isMined && (regionIsControlledByOtherPlayer || disputed);
  return tile.isWalled || tileNeedsForceMine;
}
