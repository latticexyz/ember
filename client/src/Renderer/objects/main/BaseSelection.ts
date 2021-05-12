import { hexColors } from "../../../theme";
import { WorldCoord } from "../../../_types/GlobalTypes";
import { ManagedObject, PhaserManagerServices } from "../../game";
import MainScene from "../../scenes/mainScene";
import { GameMap } from "./map";
import { Polygon, PolygonStyle } from "./polygon";

export class BaseSelection implements ManagedObject {
  tileSelectionPolygon: Polygon;
  dragStart: undefined | WorldCoord;
  dragEnd: undefined | WorldCoord;
  selectedCoords: WorldCoord[];
  madeSelection: boolean;
  shift: boolean;

  constructor() {
    this.madeSelection = false;
    this.selectedCoords = [];
    this.shift = false;
  }

  bootObject(scene: MainScene, services: PhaserManagerServices) {
    this.tileSelectionPolygon = new Polygon(scene);

    this.tileSelectionPolygon.init(scene.gameMap.map, {
      depth: 1,
      style: PolygonStyle.FILLEDBORDER,
      borderColor: hexColors.brightGreen,
      color: hexColors.pastelGreen,
      alpha: 0.3,
    });
    scene.add.existing(this.tileSelectionPolygon);
  }

  destroyObject() {
    this.tileSelectionPolygon.destroy();
  }
}
