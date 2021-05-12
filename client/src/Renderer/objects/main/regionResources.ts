import { REGION_LENGTH } from "../../../Backend/Utils/Defaults";
import { TILE_HEIGHT, TILE_WIDTH } from "../../constants";
import { WorldCoord } from "../../../_types/GlobalTypes";
import GameManager from "../../../Backend/Game/GameManager";
import { padWithWhitespace } from "../../../Frontend/Utils/Utils";
import { regionCoordToTileCoord, tilesInRegion } from "../../../Backend/Utils/Utils";
import { worldCoordsEq } from "../../utils/worldCoords";
import { TileUpgrade } from "../../../_types/ContractTypes";

const ICON_WIDTH = 10;
const ICON_HEIGHT = 10;

export default class RegionResources extends Phaser.GameObjects.Container {
  destroyed: boolean;
  scene: Phaser.Scene;
  regionCoord: WorldCoord;
  gm: GameManager;
  icon: Phaser.GameObjects.Sprite;
  background: Phaser.GameObjects.Graphics;
  gold: Phaser.GameObjects.BitmapText;
  souls: Phaser.GameObjects.BitmapText;
  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y);
    this.destroyed = false;
    this.scene = scene;
    this.depth = 1;
    this.gm = GameManager.getInstance();

    this.background = scene.add.graphics();
    this.background.fillStyle(0x000000, 0.6);
    this.background.fillRoundedRect(0, 0, TILE_WIDTH * 8, TILE_HEIGHT, 2);
    this.setSize(TILE_WIDTH * REGION_LENGTH, TILE_HEIGHT * REGION_LENGTH);
    this.gold = new Phaser.GameObjects.BitmapText(scene, 0, -3, "creepWhite");
    this.gold.alpha = 0.7;
    this.souls = new Phaser.GameObjects.BitmapText(scene, 0, -1 + 10, "creepWhite");
    this.souls.alpha = 0.7;

    this.icon = scene.add.sprite(0, 0, "tilemap");
    this.add(this.icon);
    this.icon.depth = 1;

    this.add(this.background);
    this.background.depth = 200;
    this.add(this.gold);
    this.gold.depth = 200;
    this.add(this.souls);
    this.souls.depth = 200;
  }

  findFirstMinedTileInRegion() {
    const region = this.gm.extendedDungeon.regions.get(this.regionCoord);
    if (!region) {
      return null;
    }
    const tiles = tilesInRegion(this.regionCoord);
    const topLeftTile = regionCoordToTileCoord(this.regionCoord);
    let firstMinedTile: WorldCoord | undefined;
    for (const t of tiles) {
      if (region.tiles.findIndex((tile) => worldCoordsEq(t, tile)) > 0) {
        const tile = this.gm.extendedDungeon.getTileAt(t);
        const hasGroundResources = this.gm.extendedDungeon.hasGroundResources(t);
        const worldCoord = { x: t.x - topLeftTile.x, y: t.y - topLeftTile.y };
        if (tile.isMined) {
          firstMinedTile = worldCoord;
          if (tile.upgrade === TileUpgrade.NONE && !hasGroundResources) {
            this.icon.alpha = 1.0;
            return worldCoord;
          }
        }
      }
    }
    this.icon.alpha = 0.7;
    return firstMinedTile;
  }

  renderIcon() {
    const t = this.findFirstMinedTileInRegion();
    if (!t) {
      return;
    }
    this.icon.setPosition(t.x * TILE_WIDTH + TILE_WIDTH / 2, t.y * TILE_HEIGHT + TILE_HEIGHT / 2);
    // chose frame
    const region = this.gm.extendedDungeon.regions.get(this.regionCoord);
    if (!region) {
      return;
    }
    if (region.souls > 0 && region.gold > 0) {
      this.icon.anims.play("region-resources-gold-and-souls", true);
    } else if (region.souls > 0) {
      this.icon.anims.play("region-resources-souls", true);
    } else {
      this.icon.anims.play("region-resources-gold", true);
    }
  }

  init(regionCoord: WorldCoord) {
    this.active = true;
    this.regionCoord = regionCoord;
    const region = this.gm.extendedDungeon.regions.get(regionCoord);
    if (!region) {
      this.gold.text = "";
      this.souls.text = "";
      this.visible = false;
      return;
    }
    if (region.gold === 0 && region.souls === 0) {
      this.visible = false;
      return;
    }
    this.visible = true;
    this.gold.text = `gold in region:${padWithWhitespace(Math.min(region.gold, 9999), 4)}`;
    this.souls.text = `souls in region:${padWithWhitespace(Math.min(region.souls, 9999), 4)}`;
    this.renderIcon();
  }

  update() {
    const region = this.gm.extendedDungeon.regions.get(this.regionCoord);
    if (!region) {
      return;
    }

    if (region.gold === 0 && region.souls === 0) {
      this.setVisible(false);
      return;
    } else {
      this.setVisible(true);
    }
    this.gold.setText(`gold in region:${padWithWhitespace(Math.min(region.gold, 9999), 4)}`);
    this.souls.setText(`souls in region:${padWithWhitespace(Math.min(region.souls, 9999), 4)}`);
    this.renderIcon();
  }

  updateState(inTacticalView: boolean) {
    if (inTacticalView) {
      this.gold.setVisible(true);
      this.souls.setVisible(true);
      this.background.setVisible(true);
    } else {
      this.gold.setVisible(false);
      this.souls.setVisible(false);
      this.background.setVisible(false);
    }
  }

  destroy() {
    for (const c of this.getAll()) {
      c.destroy();
    }
    this.destroyed = true;
  }
}
