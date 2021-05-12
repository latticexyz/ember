import { isTileMined, isTileClaimed } from "../../utils/tiles";
import { UIManager } from "../../../Frontend/UIManager";
import { Tool, EthAddress, UpgradeItem, WorldCoord } from "../../../_types/GlobalTypes";
import { hexColors } from "../../../theme";
import GameManager from "../../../Backend/Game/GameManager";
import { TerrainTilesetId } from "../../constants";
import { tileCoordToRegionCoord, regionCoordToTileCoord } from "../../../Backend/Utils/Utils";
import { REGION_LENGTH } from "../../../Backend/Utils/Defaults";
import { worldCoordsEq } from "../../utils/worldCoords";
import { InputManager } from "../../manager/InputManager";

export enum CursorType {
  Tile = "Tile",
  Region = "Region",
  Hidden = "Hidden",
}

export enum CursorColor {
  Valid = hexColors.valid,
  Invalid = hexColors.invalid,
  Questionable = hexColors.questionable,
  Neutral = hexColors.white,
}

type CursorSelector = (tileCoord: WorldCoord) => CursorType;
type ColorSelector = (tileCoord: WorldCoord) => CursorColor;
// TODO: Set cursor color on mouseup and mousedown

export default class Cursor {
  private map: Phaser.Tilemaps.Tilemap;
  private scene: Phaser.Scene;
  private graphics: Phaser.GameObjects.Graphics;
  private graphicsSecondary: Phaser.GameObjects.Graphics;
  private ui: UIManager;
  private gm: GameManager;
  private player: EthAddress;
  private cursorSelector: CursorSelector | undefined;
  public colorSelector: ColorSelector | undefined;
  public secondaryColorSelector: ColorSelector | undefined;
  public currentCoord?: WorldCoord;
  public onCoordChange?: (tileCoord: WorldCoord) => void;

  constructor(scene: Phaser.Scene, map: Phaser.Tilemaps.Tilemap, player: EthAddress) {
    this.map = map;
    this.scene = scene;
    this.ui = UIManager.getInstance();
    this.gm = GameManager.getInstance();
    this.graphics = scene.add.graphics();
    this.graphicsSecondary = scene.add.graphics();
    this.player = player;
    this.graphics.depth = 2;
    this.graphicsSecondary.depth = 2;
  }

  public getColor(coord: WorldCoord): CursorColor {
    const color = this.colorSelector ? this.colorSelector(coord) : CursorColor.Neutral;
    return color;
  }

  private getSecondaryColor(coord: WorldCoord): CursorColor {
    const color = this.secondaryColorSelector ? this.secondaryColorSelector(coord) : CursorColor.Neutral;
    return color;
  }

  public setCursorSelector(cursorSelector: CursorSelector) {
    this.cursorSelector = cursorSelector;
  }

  public resetCursorSelector() {
    this.cursorSelector = undefined;
  }

  public setColorSelector(colorSelector: ColorSelector) {
    this.colorSelector = colorSelector;
  }

  public resetColorSelector() {
    this.colorSelector = undefined;
  }

  public setSecondaryColorSelector(colorSelector: ColorSelector) {
    this.secondaryColorSelector = colorSelector;
  }

  public setCurrentCoord(coord: WorldCoord) {
    if (!this.currentCoord || !worldCoordsEq(coord, this.currentCoord)) {
      this.onCoordChange && this.onCoordChange(coord);
    }
    this.currentCoord = coord;
  }

  public update(render: boolean) {
    this.graphics.visible = render;
    this.graphicsSecondary.visible = render;

    const canvas = this.scene.sys.canvas;
    canvas.oncontextmenu = (e) => e.preventDefault();

    if (!render) {
      return;
    }

    const pointer = this.scene.input.activePointer;
    const worldPoint = pointer.positionToCamera(this.scene.cameras.main) as Phaser.Math.Vector2;
    const currentTileCoord = this.map.worldToTileXY(worldPoint.x, worldPoint.y);
    this.setCurrentCoord(currentTileCoord);

    const cursorType = this.cursorSelector ? this.cursorSelector(currentTileCoord) : CursorType.Tile;
    const color = this.getColor(currentTileCoord);

    this.graphics.clear();
    this.graphicsSecondary.clear();

    if (cursorType === CursorType.Tile) {
      const snappedWorldPoint = this.map.tileToWorldXY(currentTileCoord.x, currentTileCoord.y);
      this.graphics.setPosition(snappedWorldPoint.x, snappedWorldPoint.y);
      this.graphics.lineStyle(2, color, 1);
      this.graphics.strokeRect(0, 0, this.map.tileWidth, this.map.tileHeight);
    } else if (cursorType === CursorType.Region) {
      // Draw primary cursor (region size).
      const regionCoord = tileCoordToRegionCoord(currentTileCoord);
      const topLeftCorner = regionCoordToTileCoord(regionCoord);
      const snappedWorldPoint = this.map.tileToWorldXY(topLeftCorner.x, topLeftCorner.y);

      this.graphics.setPosition(snappedWorldPoint.x, snappedWorldPoint.y);
      this.graphics.lineStyle(2, color, 1);
      this.graphics.strokeRect(0, 0, this.map.tileWidth * REGION_LENGTH, this.map.tileHeight * REGION_LENGTH);

      // Draw secondary cursor (tile size).
      const secondaryCursorPosition = this.map.tileToWorldXY(currentTileCoord.x, currentTileCoord.y);
      const secondaryColor = this.getSecondaryColor(currentTileCoord);

      this.graphicsSecondary.setPosition(secondaryCursorPosition.x, secondaryCursorPosition.y);
      this.graphicsSecondary.lineStyle(2, secondaryColor, 1);
      this.graphicsSecondary.strokeRect(0, 0, this.map.tileWidth, this.map.tileHeight);
    }
  }

  public destroy() {
    this.graphics.destroy();
    this.graphicsSecondary.destroy();
  }
}
