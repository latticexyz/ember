import { ZOOM_FACTOR } from "./strategicMap";
import CenteredChunkedTilemap from "../../primitives/CenteredChunkedTilemap";
import { worldCoordsEq } from "../../utils/worldCoords";
import { WorldCoord } from "../../../_types/GlobalTypes";

export default class StrategicCursor {
  strategicMap: CenteredChunkedTilemap;
  scene: Phaser.Scene;
  graphics: Phaser.GameObjects.Graphics;
  camera: Phaser.Cameras.Scene2D.Camera;
  isCursorCentered: boolean;

  constructor(scene: Phaser.Scene, map: CenteredChunkedTilemap, camera: Phaser.Cameras.Scene2D.Camera) {
    this.strategicMap = map;
    this.scene = scene;
    this.camera = camera;
    this.graphics = this.scene.add.graphics();
    this.isCursorCentered = false;
  }

  centerMapUnderCursor(): void {
    const pointer = this.scene.input.activePointer;
    const worldPoint = pointer.positionToCamera(this.camera) as Phaser.Math.Vector2;

    // To allow smooth navigation but also avoid "jumping" to a random place
    // where the players cursor is now, we center on whatever the center of where
    // the player is "looking at now". This way if they exit the strategic view right
    // away, it brings them to the same location.
    if (!this.isCursorCentered) {
      const dx = worldPoint.x - this.camera.midPoint.x;
      const dy = worldPoint.y - this.camera.midPoint.y;
      this.camera.scrollX -= dx;
      this.camera.scrollY -= dy;
      this.isCursorCentered = true;
    }
  }

  getCurrentTile(): WorldCoord {
    const pointer = this.scene.input.activePointer;
    const worldPoint = pointer.positionToCamera(this.camera) as Phaser.Math.Vector2;
    return this.strategicMap.worldToTileXY(worldPoint.x, worldPoint.y);
  }

  update(render: boolean): Phaser.Math.Vector2 | void {
    const canvas = this.scene.sys.canvas;
    this.graphics.visible = render;
    if (render) {
      canvas.style.cursor = "none";

      const pointer = this.scene.input.activePointer;
      const worldPoint = pointer.positionToCamera(this.camera) as Phaser.Math.Vector2;
      const widthOfViewport = this.scene.scale.width * ZOOM_FACTOR;
      const heightOfViewport = this.scene.scale.height * ZOOM_FACTOR;
      const position = new Phaser.Math.Vector2(
        worldPoint.x - (1 / 2) * widthOfViewport,
        worldPoint.y - (1 / 2) * heightOfViewport
      );

      this.graphics.clear();
      this.graphics.setPosition(position.x, position.y);
      this.graphics.lineStyle(2, 0xffffff, 1);
      this.graphics.strokeRect(0, 0, widthOfViewport, heightOfViewport);

      return this.strategicMap.worldToTileXY(worldPoint.x, worldPoint.y);
    } else {
      canvas.style.cursor = "unset";
    }
  }

  destroy() {
    this.graphics.destroy();
  }
}
