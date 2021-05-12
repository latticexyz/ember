import ExtendedDungeon from "../../Backend/Game/ExtendedDungeon";
import { WorldCoord, Tile, ResourceType } from "../../_types/GlobalTypes";
import { UIManager, InteractType, GenericInteractData } from "../../Frontend/UIManager";
import { tileCoordToRegionCoord } from "../../Backend/Utils/Utils";
import { getSurroundingTilesOfSameType } from "../../Backend/Utils/Tiles";
import { TileUpgrade } from "../../_types/ContractTypes";
import { Polygon, PolygonStyle } from "../objects/main/polygon";
import { hexColors } from "../../theme";
import { worldCoordsEq } from "../utils/worldCoords";
import { Service } from "../game";
import MainScene from "../scenes/mainScene";

export class InteractTool implements Service {
  extendedDungeon: ExtendedDungeon;
  uiManager: UIManager;
  selection: Polygon;

  constructor(
    extendedDungeon: ExtendedDungeon,
    uiManager: UIManager,
  ) {
    this.extendedDungeon = extendedDungeon;
    this.uiManager = uiManager;
  }

  bootService(scene: MainScene) {
    this.selection = new Polygon(scene);
    this.selection.init(scene.gameMap.map, {
      color: hexColors.white,
      alpha: 0.7,
      style: PolygonStyle.BORDER,
      // depth: 100,
      depth: 1,
    });
    scene.add.existing(this.selection);
  }

  destroyService() {
    this.selection.destroy();
  }

  inspectTile(inspectedCoord: WorldCoord, doubleClick: boolean) {
    const inspectedTile = this.extendedDungeon.getTileAt(inspectedCoord);
    if (!inspectedTile) return;

    const regionCoord = tileCoordToRegionCoord(inspectedCoord);
    const influence = this.extendedDungeon.influenceDataByRegion.get(regionCoord);
    const region = this.extendedDungeon.getRegionAt(regionCoord);

    const isUpgraded = inspectedTile.upgrade !== TileUpgrade.NONE;
    const isSoulResource = this.extendedDungeon.isSoulResource(inspectedCoord) && !inspectedTile.isMined;
    const isGoldResource = this.extendedDungeon.isGoldResource(inspectedCoord) && !inspectedTile.isMined;
    const harvestableGroundResources = this.extendedDungeon.hasGroundResources(inspectedCoord);

    const belongsToSameGroup = (exploredTile: Tile, exploredWorldCoord: WorldCoord) => {
      const exploredRegion = tileCoordToRegionCoord(exploredWorldCoord);
      const sameRegion = worldCoordsEq(regionCoord, exploredRegion);

      const sameOwner = exploredTile.owner === inspectedTile.owner;

      if (isUpgraded) {
        return exploredTile.upgrade === inspectedTile.upgrade && sameOwner;
      }

      if (isSoulResource) {
        return !exploredTile.isMined && this.extendedDungeon.isSoulResource(exploredWorldCoord);
      }

      if (isGoldResource) {
        return !exploredTile.isMined && this.extendedDungeon.isGoldResource(exploredWorldCoord);
      }

      return sameRegion;
    };
    const tileAtInspectedCoord = this.extendedDungeon.getTileAt(inspectedCoord);
    // expand when you don't double click with upgrades
    // expand when you double click with no ugprades
    const expandToGroup =
      (!doubleClick && tileAtInspectedCoord.upgrade !== TileUpgrade.NONE) ||
      (doubleClick && tileAtInspectedCoord.upgrade === TileUpgrade.NONE);
    const selectedCoords = expandToGroup
      ? getSurroundingTilesOfSameType(inspectedCoord, belongsToSameGroup, this.extendedDungeon)
      : [inspectedCoord];

    if (isUpgraded || expandToGroup) {
      this.selection.clear();
      this.selection.setTiles(selectedCoords);
    } else {
      this.selection.clear();
    }

    const genericInteractData: GenericInteractData = {
      selectedCoords,
      region: { influence, souls: region.souls, gold: region.gold, coord: regionCoord },
      tile: inspectedTile,
    };

    if (isUpgraded) {
      return this.uiManager.state.setInteractData({
        type: InteractType.Upgrade,
        subtype: inspectedTile.upgrade,
        ...genericInteractData,
      });
    }

    if (harvestableGroundResources) {
      return this.uiManager.state.setInteractData({
        type: InteractType.HarvestableGroundResources,
        subtype: harvestableGroundResources,
        ...genericInteractData,
      });
    }

    if (isGoldResource || isSoulResource) {
      return this.uiManager.state.setInteractData({
        type: InteractType.Resource,
        subtype: isSoulResource ? ResourceType.Soul : ResourceType.Gold,
        ...genericInteractData,
      });
    }
    return this.uiManager.state.setInteractData({
      type: InteractType.Generic,
      ...genericInteractData,
    });
  }

  clearSelection() {
    const pointLength = this.selection?.shape?.points?.length;
    if (pointLength != null && pointLength > 0) {
      this.selection.clear();
    }
    this.uiManager.state.clearInteractData();
  }
}
