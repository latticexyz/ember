import GameManager from "../../Backend/Game/GameManager";
import { tileCoordToRegionCoord } from "../../Backend/Utils/Utils";
import { NotificationManager } from "../../Frontend/NotificationManager";
import { UIManager } from "../../Frontend/UIManager";
import { CoordMap } from "../../Utils/CoordMap";
import { UpgradeItem, WorldCoord } from "../../_types/GlobalTypes";
import { Service } from "../game";
import Cursor from "../objects/main/cursor";
import MainScene from "../scenes/mainScene";
import { clearSelection } from "../systems/Utils";
import { CreatureTool } from "../tools/CreatureTool";
import { InteractTool } from "../tools/InteractTool";
import { MineClaimTool } from "../tools/MineClaimTool";
import { UpgradeTool } from "../tools/UpgradeTool";
import { worldCoordsEq } from "../utils/worldCoords";
import { CreatureManager } from "./CreatureManager";
import { GameSelection } from "./SelectionManager";
import { InputManager } from "./InputManager";
import { UnitMoveManager } from "./UnitMoveManager";
import { ViewportObjectManager } from "./ViewportObjectManager";
import { ViewportManager } from "./ViewportManager";

interface Tools {
  interact: InteractTool;
  upgrade: UpgradeTool;
  mineOrClaim: MineClaimTool;
  creature: CreatureTool;
}

export class ToolManager implements Service {
  private gm: GameManager = GameManager.getInstance();
  private ui: UIManager = UIManager.getInstance();

  tools: Tools;

  constructor(
    private creatureManager: CreatureManager,
    private viewportObjectManager: ViewportObjectManager,
    private inputManager: InputManager,
    private selection: GameSelection,
    private unitMoveManager: UnitMoveManager,
    private viewportManager: ViewportManager
  ) { }

  bootService(scene: MainScene) {
    this.tools = {
      interact: new InteractTool(this.gm.extendedDungeon, this.ui),
      upgrade: new UpgradeTool(this.gm, scene.gameMap.map),
      mineOrClaim: new MineClaimTool(this.gm, this.ui.state),
      creature: new CreatureTool(
        this.gm,
        this.gm.extendedDungeon,
        this.creatureManager,
        this.selection,
        scene.gameMap.cursor,
        this.ui.state,
        this.viewportObjectManager,
        this.unitMoveManager,
        this.viewportManager
      ),
    };

    // Boot all needed sub-tools.
    this.tools.interact.bootService(scene);
    this.tools.mineOrClaim.bootService(scene);
    this.tools.creature.bootService(scene);
  }

  destroyService() {
    // Destroy all sub-tools.
    this.tools.interact.destroyService();
    this.tools.mineOrClaim.destroyService();
    this.tools.creature.destroyService();
  }

  public init() {
    this.updateToolGraphics();
  }

  public update() {
    if (this.inputManager.state.currentInput.has("goldStorage")) {
      this.handleUpgrade(UpgradeItem.GoldStorage);
    }
    if (this.inputManager.state.currentInput.has("goldGenerator")) {
      this.handleUpgrade(UpgradeItem.GoldGenerator);
    }
    if (this.inputManager.state.currentInput.has("soulStorage")) {
      this.handleUpgrade(UpgradeItem.SoulStorage);
    }
    if (this.inputManager.state.currentInput.has("soulGenerator")) {
      this.handleUpgrade(UpgradeItem.SoulGenerator);
    }
    if (this.inputManager.state.currentInput.has("lair")) {
      this.handleUpgrade(UpgradeItem.Lair);
    }
    if (this.inputManager.state.currentInput.has("wall")) {
      this.handleUpgrade(UpgradeItem.Wall);
    }
  }

  public getGameObjects(): Phaser.GameObjects.GameObject[] {
    return [
      this.tools.interact.selection,
      this.tools.mineOrClaim.mineableArea.background,
      this.tools.creature.mask.background,
    ];
  }

  getMainRegionFromSelectedCoords(selectedCoords: WorldCoord[]): WorldCoord {
    if (selectedCoords.length === 0) {
      throw new Error("selectedCoords is empty");
    }
    const regionCounter = new CoordMap<number>({ defaultValue: 0 });

    for (const tileCoord of selectedCoords) {
      const regionCoord = tileCoordToRegionCoord(tileCoord);
      const count = regionCounter.get(regionCoord)!;
      regionCounter.set(regionCoord, count + 1);
    }

    let maxRegion: WorldCoord = tileCoordToRegionCoord(selectedCoords[0]);
    let maxRegionCount = 0;

    for (const [region, count] of regionCounter.toArray()) {
      if (count > maxRegionCount) {
        maxRegion = region;
        maxRegionCount = count;
      }
    }

    return maxRegion;
  }

  filterSelectedCoordsByRegion(selectedCoords: WorldCoord[], regionCoord: WorldCoord) {
    return selectedCoords.filter((coord) => worldCoordsEq(tileCoordToRegionCoord(coord), regionCoord));
  }

  // Normally, we'd have a global list of Selections and iterate through
  // But we only need one selection, so it can be a class member
  public handleAction() {
    if (
      this.selection.hasClaimableCoords() ||
      this.selection.hasMineableCoords() ||
      this.selection.hasForceMineCoords()
    ) {
      this.tools.mineOrClaim.mineOrClaimTiles(
        this.selection.mineableCoords,
        this.selection.claimableCoords,
        this.selection.forceMineCoords
      );
    }

    if (this.selection.hasUpgradeableCoords()) {
      this.ui.state.setShowHotbar(true);
    }
  }

  public handleCancel() {
    if (
      this.selection.hasClaimableCoords() ||
      this.selection.hasMineableCoords() ||
      this.selection.hasForceMineCoords()
    ) {
      this.tools.mineOrClaim.cancelMineOrClaimTiles(
        this.selection.mineableCoords,
        this.selection.claimableCoords,
        this.selection.forceMineCoords
      );
    }
    if (this.selection.hasUpgradeableCoords()) {
      this.tools.upgrade.cancelUpgradeTiles(this.selection.upgradeableCoords);
    }
  }

  public handleUpgrade(upgrade: UpgradeItem) {
    if (this.selection.upgradeableCoords.length === 0) return;
    this.tools.upgrade.upgrade(this.selection.upgradeableCoords, upgrade);
    // TODO: might not need to check this in most cases?
    if (this.ui.state.showHotbar) {
      this.ui.state.setShowHotbar(false);
    }
    clearSelection(this.selection, this);
  }

  handleInteractClick(doubleClick: boolean) {
    const selectedCoords = this.selection.selectedCoords;
    const mainRegion = this.getMainRegionFromSelectedCoords(selectedCoords);
    const selectedCoordsInMainRegion = this.filterSelectedCoordsByRegion(selectedCoords, mainRegion);
    const lastCoord = selectedCoordsInMainRegion[selectedCoordsInMainRegion.length - 1];
    this.tools.interact.inspectTile(lastCoord, doubleClick);
  }

  public updateToolGraphics() {
    if (this.selection.hasMineableCoords() || this.selection.hasClaimableCoords()) {
      this.tools.mineOrClaim.setAvailableArea();
    }
  }

  public updateData() {
    this.tools.mineOrClaim.setAvailableArea();
  }
}
