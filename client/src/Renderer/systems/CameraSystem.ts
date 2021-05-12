import { action, makeObservable, toJS } from "mobx";
import { InputManager, InputState } from "../manager/InputManager";
import { GameSelection } from "../manager/SelectionManager";
import { CameraState, CameraType, ICam } from "../manager/CameraState";
import { Creature } from "../objects/main/creature";
import { GameMap } from "../objects/main/map";
import { StrategicMap, MOVEMENT_SPEED_MODIFIER } from "../objects/main/strategicMap";
import { WorldCoord } from "../../_types/GlobalTypes";
import { REGION_LENGTH } from "../../Backend/Utils/Defaults";
import GameManager from "../../Backend/Game/GameManager";
import { tileCoordToRegionCoord } from "../../Backend/Utils/Utils";
import { creatureToSpritesheet } from "../../Frontend/Components/Windows/SummonCreatures/constants";
import { TerrainTilesetId } from "../constants";
import { ViewportObjectManager } from "../manager/ViewportObjectManager";
import { PhaserManager } from "../manager/PhaserManager";

// Lateral navigation.
enum MovementDirection {
  UP,
  DOWN,
  LEFT,
  RIGHT,
}
// Zoom in/out navigation.
enum ZoomDirection {
  IN = 1,
  OUT = -1,
}
// Values that determine the feel of the camera movement.
interface MovementConfig {
  acceleration: number;
  drag: number;
  maxLateralSpeed: number;
}
const DEFAULT_DELTA = 1000 / 60;

export class CameraSystem {
  scene: Phaser.Scene;
  map: GameMap;
  strategicMap: StrategicMap;
  inputState: InputState;
  cameraMoving: boolean;
  camState: CameraState;
  selection: GameSelection;
  strategicViewVisible: boolean;
  voMan: ViewportObjectManager;
  gm: GameManager;

  // Speed gets updated for smooth acceleration / deceleration.
  _speedX: number;
  _speedY: number;

  private accelX: number;
  private accelY: number;

  private dragX: number;
  private dragY: number;

  private maxSpeedX: number;
  private maxSpeedY: number;

  // Constants that should not be modifiable.
  static readonly MAX_ZOOM = 4;
  static readonly MIN_ZOOM = 0.5;

  constructor(
    scene: Phaser.Scene,
    map: GameMap,
    strategicMap: StrategicMap,
    camState: CameraState,
    selection: GameSelection,
    config: MovementConfig,
    voMan: ViewportObjectManager
  ) {
    this.scene = scene;
    this.gm = GameManager.getInstance();
    this.map = map;
    this.strategicMap = strategicMap;
    // TODO: pass inputmanager via constructor instead of singleton
    this.inputState = PhaserManager.getInstance().services.inputManager.state;
    this.cameraMoving = false;
    this.camState = camState;
    this.selection = selection;
    this.strategicViewVisible = false;
    this.voMan = voMan;
    makeObservable(this, {
      handleSetCamera: action,
    });

    this._speedX = 0;
    this._speedY = 0;

    this.dragX = config.drag;
    this.dragY = config.drag;

    this.accelX = config.acceleration;
    this.accelY = config.acceleration;

    this.maxSpeedX = config.maxLateralSpeed;
    this.maxSpeedY = config.maxLateralSpeed;
  }

  update(delta: number) {
    this.cameraMoving = false;
    if (this.inputState.currentInput.has("cameraUp")) {
      this.handleCameraUp(delta, this.strategicViewVisible);
    }
    if (this.inputState.currentInput.has("cameraDown")) {
      this.handleCameraDown(delta, this.strategicViewVisible);
    }
    if (this.inputState.currentInput.has("cameraLeft")) {
      this.handleCameraLeft(delta, this.strategicViewVisible);
    }
    if (this.inputState.currentInput.has("cameraRight")) {
      this.handleCameraRight(delta, this.strategicViewVisible);
    }
    if (this.inputState.currentInput.has("showStrategicView")) {
      this.onShowStrategicView();
    }
    if (this.inputState.currentInput.has("hideStrategicView")) {
      this.onHideStrategicView();
    }
    if (this.inputState.currentInput.has("strategicCameraUp")) {
      this.handleCameraUp(delta, true);
    }
    if (this.inputState.currentInput.has("strategicCameraDown")) {
      this.handleCameraDown(delta, true);
    }
    if (this.inputState.currentInput.has("strategicCameraLeft")) {
      this.handleCameraLeft(delta, true);
    }
    if (this.inputState.currentInput.has("strategicCameraRight")) {
      this.handleCameraRight(delta, true);
    }
    if (this.inputState.currentInput.has("setCamera1")) {
      this.handleSetCamera(0);
    }
    if (this.inputState.currentInput.has("setCamera2")) {
      this.handleSetCamera(1);
    }
    if (this.inputState.currentInput.has("setCamera3")) {
      this.handleSetCamera(2);
    }
    if (this.inputState.currentInput.has("viewCamera1")) {
      this.handleViewCamera(0);
    }
    if (this.inputState.currentInput.has("viewCamera2")) {
      this.handleViewCamera(1);
    }
    if (this.inputState.currentInput.has("viewCamera3")) {
      this.handleViewCamera(2);
    }
    if (this.inputState.currentInput.has("recallViewport")) {
      this.handleRecallViewport();
    }
    if (this.inputState.currentInput.has("centerDungeonHeart")) {
      this.centerDungeonHeart();
    }
    if (this.inputState.currentInput.has("zoomIn")) {
      if (this.inputState.currentInput.has("showStrategicView")) return;

      this.handleZoom(ZoomDirection.IN);
    }
    if (this.inputState.currentInput.has("zoomOut")) {
      if (this.inputState.currentInput.has("showStrategicView")) return;

      this.handleZoom(ZoomDirection.OUT);

      // This is a mechanic to easily snap into a strategic view just from
      // zooming around when zoomed out to the min zoom level.
      if (this.map.camera.zoom === CameraSystem.MIN_ZOOM) {
        this.onShowStrategicView();
      }
    }
    if (this.inputState.currentInput.has("zoomStopped")) {
      this.snapToZoomLevel();
    }
    // Event fired off by the zoom snapping tween that we use to avoid showing a moving
    // cursor when animation is playing.
    if (this.inputState.currentInput.has("zoomTweenActive")) {
      this.cameraMoving = true;
    }
    // Event fired off by trackpad movement (two finger movement).
    if (this.inputState.currentInput.has("lateralScroll")) {
      this.updateScrollDirect(this.inputState.dxLateral, this.inputState.dyLateral);
    }
    // Event fired off by holding down the middle mouse button and dragging.
    if (this.inputState.currentInput.has("lateralScrollWithMiddleMouseButton")) {
      this.updateScrollDirect(this.inputState.dxLateral, this.inputState.dyLateral);
    }
    // Since our system uses the middle mouse button to drag and move with mouse,
    // this event lets us know when we should assume the camera is moving and avoid
    // re-drawing the cursor and avoid any flickering.
    if (this.inputState.currentInput.has("middleMouseButtonDown")) {
      this.cameraMoving = true;
    }

    // If speed is non-zero as we are moving around but there are no input events, that
    // means that we should apply a deceleration affect on the camera and the speed of
    // the camera.
    if (this._speedX !== 0 || this._speedY !== 0) {
      this.applyDeceleration(delta);
      this.applyTransformations(delta, this.strategicViewVisible);
    }
  }

  /*
  Function that can be used to move the camera directly
  by a dx, dy amount in each of the respective axis.
  */
  updateScrollDirect(dx: number, dy: number) {
    this.cameraMoving = true;

    const cam = this.strategicViewVisible ? this.strategicMap.camera : this.map.camera;
    const currentScrollX = cam.scrollX;
    const currentScrollY = cam.scrollY;

    cam.setScroll(currentScrollX + dx, currentScrollY + dy);

    // If we are moving the "main" game camera and not the strategic camera,
    // then we want to move the strategic camera such that it "follows" the
    // player.
    if (!this.strategicViewVisible) {
      this.centerStrategicToPlayerPosition();
    }
  }

  /*
  Function that takes the current zoom level of the main camera and
  "snaps" it to a multiple of 2 in order to avoid glitches.
  */
  snapToZoomLevel() {
    if (this.strategicViewVisible) return;

    const cam = this.map.camera;
    const getNearestLevel = (currentZoom: number): number => {
      return Math.pow(2, Math.floor(Math.log(Math.round(currentZoom) * 2) / Math.log(2))) / 2;
    };
    const nearestLevel = getNearestLevel(cam.zoom);
    // Don't do any animation if the zoom hasn't been changed.
    if (nearestLevel === cam.zoom) return;

    // Create an animation for smooth "snap" into whatever the closest zoom level is.
    this.scene.tweens.add({
      targets: cam,
      zoom: nearestLevel,
      duration: 500,
      ease: Phaser.Math.Easing.Quadratic.InOut,
      onUpdate: () => {
        // Avoid showing a moving cursor when animation is playing.
        this.inputState.currentInput.add("zoomTweenActive");
      },
    });

    // Adjust the speed a bit since at a higher zoom level it's harder to do fine-grain
    // navigation without speeding away too far.
    this.adjustMovementSpeedForZoom(cam);
  }

  /*
  Function that 'handleZoom()` should call to offset the effect of zooming and maintain the 
  position of cursor under the tile / point. The function calculates how much the viewport is changing
  because of the zooming and translates the camera.
  */
  offsetCameraForZoom(mouseX: number, mouseY: number, oldScale: number, newScale: number) {
    // Where the mouse is originally relative to origin.
    const originX = mouseX / oldScale;
    const originY = mouseY / oldScale;

    // Where the mouse will be after the zooming gets applied.
    const newX = mouseX / newScale;
    const newY = mouseY / newScale;

    // We need to shift the camera by this amount to make sure that the pixel
    // where the mouse pointer is remains the same relative to the viewport.
    this.updateScrollDirect(originX - newX, originY - newY);
  }

  handleZoom(direction: number) {
    const cam = this.map.camera;

    // If we are currently in the strategic view and are zooming in,
    // snap out of the strategic view such that we can navigate as
    // usual and if needed, can go back to strategic.
    if (direction === ZoomDirection.IN && this.strategicViewVisible) {
      this.onHideStrategicView();
      cam.zoom = CameraSystem.MIN_ZOOM;
    }

    // Avoid unneccessary zooming if already at bounds of max/min.
    if (direction === ZoomDirection.IN && cam.zoom === CameraSystem.MAX_ZOOM) return;
    if (direction === ZoomDirection.OUT && cam.zoom === CameraSystem.MIN_ZOOM) return;

    this.cameraMoving = true;

    const oldZoom = cam.zoom;
    let newZoom = oldZoom + direction * Math.abs(this.inputState.zoomDelta) * 0.02;
    // This acts as "clipping" to make sure we don't zoom out
    // to far or too close.
    newZoom = Math.min(newZoom, CameraSystem.MAX_ZOOM);
    newZoom = Math.max(newZoom, CameraSystem.MIN_ZOOM);

    let mouse = this.inputState.deviceMouse.key;
    // First transform the mouse coordinates such that the "origin" is now in the center
    // of the camera viewport.
    let mouseX = mouse.x - cam.width / 2.0;
    let mouseY = mouse.y - cam.height / 2.0;
    this.offsetCameraForZoom(mouseX, mouseY, oldZoom, newZoom);
    cam.setZoom(newZoom);

    this.adjustMovementSpeedForZoom(cam);
  }

  /*
  Function that we can use to adjust the speed a bit based on current zoom level, 
  since at a higher zoom level it's harder to do fine-grain navigation without speeding
  away too far.
  */
  adjustMovementSpeedForZoom(cam: Phaser.Cameras.Scene2D.Camera) {
    this.maxSpeedX = 1 / (cam.zoom * 2);
    this.maxSpeedY = 1 / (cam.zoom * 2);
  }
  centerDungeonHeart() {
    const dh = this.gm.extendedDungeon.getPlayerDungeonHeart(this.gm.address);
    if (!this.camState.recallable) {
      this.setRecall();
      this.camState.recallable = true;
    }
    dh.then((dungeonHeart) => {
      this.map.centerMap(dungeonHeart);
      this.strategicMap.centerMap(dungeonHeart);
    });
  }

  mode(array: number[]) {
    let frequency = {};

    array.forEach(function (value) {
      frequency[value] = 0;
    });

    let uniques = array.filter(function (value) {
      return ++frequency[value] == 1;
    });

    return uniques.sort(function (a, b) {
      return frequency[b] - frequency[a];
    });
  }

  handleSetCamera(cameraNum: number) {
    const tilesToCenterOn = this.selection.selectedCoords;
    const firstTile = tilesToCenterOn[0];

    if (this.selection.hasSelectedCreatures) {
      // TODO: Cleanup if possible
      const regionCoord = tileCoordToRegionCoord(firstTile);
      const creatureIds = this.gm.extendedDungeon.regions.get(regionCoord);
      if (creatureIds) {
        const creatureId = creatureIds.creatures[0];
        const creature = this.gm.extendedDungeon.creatures.get(creatureId);
        if (creature) {
          const sprite = creatureToSpritesheet[creature.species][creature.creatureType];
          this.setCamera(null, cameraNum, CameraType.Moving, creatureId, undefined, sprite);
        }
      }
    } else if (tilesToCenterOn.length > 0) {
      let mostCommonTile;
      const objTiles = tilesToCenterOn.map(
        (tile) => this.map.map.getTileAt(tile.x, tile.y, undefined, "objects").index
      );

      // TODO: feels kinda slow
      if (objTiles.some((tile) => tile !== TerrainTilesetId.Empty)) {
        mostCommonTile = objTiles.find((tile) => tile !== TerrainTilesetId.Empty);
      } else {
        const terrainTileIndices = tilesToCenterOn.map(
          (tile) => this.map.map.getTileAt(tile.x, tile.y, undefined, "terrain").index
        );
        mostCommonTile = this.mode(terrainTileIndices)[0];
      }
      this.setCamera(tilesToCenterOn, cameraNum, CameraType.Static, undefined, mostCommonTile);
    }
    // TODO: Do we actually need to call this?
    this.inputState.reset();
  }

  setRecall() {
    const getViewportCenter = () => {
      const center = this.map.camera.midPoint;
      const camTileXY = this.map.map.worldToTileXY(center.x, center.y);
      const viewportCenter: WorldCoord = {
        x: camTileXY.x,
        y: camTileXY.y,
      };
      return viewportCenter;
    };
    const rp = getViewportCenter();
    this.camState.recallPoint = rp;
  }

  handleRecallViewport() {
    if (this.camState.recallable) {
      this.centerCameraAt(this.camState.recallPoint);
      this.camState.recallable = false;
    }
  }

  onShowStrategicView() {
    this.strategicViewVisible = true;
    this.map.camera.setVisible(false);
    this.strategicMap.camera.setVisible(true);
    this.strategicMap.cursor.centerMapUnderCursor();
  }

  onHideStrategicView() {
    this.map.camera.setVisible(true);
    this.strategicMap.camera.setVisible(false);
    this.strategicViewVisible = false;
    // Reset the value for the centering of the cursor so that next time the
    // strategic camera is brought up we center again.
    this.strategicMap.cursor.isCursorCentered = false;
    this.centerStrategicToPlayerPosition();
  }

  centerStrategicToPlayerPosition() {
    // Get the tile which the player is currently "looking at".
    const tileCurrent = this.map.map.worldToTileXY(this.map.camera.midPoint.x, this.map.camera.midPoint.y);
    // Get the coordinates of the tile in strategic map coords and center the
    // strategic camera there.
    const coord = this.strategicMap.map.tileToWorldXY(tileCurrent.x, tileCurrent.y);
    this.strategicMap.camera.centerOn(coord.x, coord.y);
  }

  handleViewCamera(cameraNum: number) {
    const pCam: ICam = this.camState.cameras[Object.keys(this.camState.cameras)[cameraNum]];
    const cam = toJS(pCam);
    if (!this.camState.recallable && (cam.creatureId || (cam.selection && cam.selection.length > 0))) {
      this.setRecall();
      this.camState.recallable = true;
    }
    if (cam.creatureId) {
      const creatureCoord = this.voMan.objectRegistry.getCoordById(cam.creatureId);
      if (!creatureCoord) return;
      this.centerCameraAt(creatureCoord);
    } else if (cam.selection && cam.selection.length > 0) {
      this.centerCameraAt(cam.selection[Math.floor(cam.selection.length / 2)]);
    }
  }

  centerCameraAt = (coord: WorldCoord) => {
    this.map.centerMap(coord);
    this.strategicMap.centerMap(coord);
  };

  private setCamera(
    selection: WorldCoord[] | null,
    cameraNumber: number,
    type: CameraType,
    creatureId?: string,
    spriteIndex?: number,
    creatureSprite?: string
  ) {
    this.camState.cameras[Object.keys(this.camState.cameras)[cameraNumber]] = {
      selection,
      type: type,
      creatureId: creatureId || undefined,
      spriteIndex: spriteIndex,
      creatureSprite: creatureSprite,
    };
  }

  /*
  Function that adds a smoothing effect to decelerate the camera by making
  progressive movements that shrink instead of stopping at once.
  */
  applyDeceleration(delta: number) {
    if (this._speedX > 0) {
      this._speedX -= this.dragX * delta;
      this._speedX = Math.max(this._speedX, 0);
    } else if (this._speedX < 0) {
      this._speedX += this.dragX * delta;
      this._speedX = Math.min(this._speedX, 0);
    }
    if (this._speedY > 0) {
      this._speedY -= this.dragY * delta;
      this._speedY = Math.max(this._speedY, 0);
    } else if (this._speedY < 0) {
      this._speedY += this.dragY * delta;
      this._speedY = Math.min(this._speedY, 0);
    }
  }

  /*
  Depending on the direction, applies a relevant transformation
  function to move the camera based on the current speed.
  */
  applySpeedUpdate(direction: MovementDirection) {
    // Functions that specify how speed should be adjusted based on
    // the direction we're moving in.
    const moveUpFn = () => {
      this._speedY += this.accelY;
      this._speedY = Math.min(this._speedY, this.maxSpeedY);
    };
    const moveDownFn = () => {
      this._speedY -= this.accelY;
      this._speedY = Math.max(this._speedY, -this.maxSpeedY);
    };
    const moveLeftFn = () => {
      this._speedX += this.accelX;
      this._speedX = Math.min(this._speedX, this.maxSpeedX);
    };
    const moveRightFn = () => {
      this._speedX -= this.accelX;
      this._speedX = Math.max(this._speedX, -this.maxSpeedX);
    };

    switch (direction) {
      case MovementDirection.UP:
        moveUpFn();
        break;
      case MovementDirection.DOWN:
        moveDownFn();
        break;
      case MovementDirection.LEFT:
        moveLeftFn();
        break;
      case MovementDirection.RIGHT:
        moveRightFn();
        break;
    }
  }

  /*
  Once speed is updated with applySpeedUpdate(), should call this
  in order to update the camera's actual position.
  */
  applyTransformations(delta: number, strategic: boolean) {
    const cam = strategic ? this.strategicMap.camera : this.map.camera;

    // Apply the x,y transformations to the camera.
    let currentScrollX = cam.scrollX;
    let currentScrollY = cam.scrollY;

    // In strategic view scrolling has less effect since we are zoomed out,
    // so we multiply by a constant to get a bit faster navigation.
    const multiplier = strategic ? MOVEMENT_SPEED_MODIFIER : 1;
    if (this._speedX !== 0) currentScrollX -= (this._speedX * delta * multiplier) | 0;
    if (this._speedY !== 0) currentScrollY -= (this._speedY * delta * multiplier) | 0;

    cam.setScroll(currentScrollX, currentScrollY);
    this.cameraMoving = this._speedX !== 0 || this._speedY !== 0;

    // If we are moving the "main" game camera and not the strategic camera,
    // then we want to move the strategic camera such that it "follows" the
    // player.
    if (!strategic) {
      this.centerStrategicToPlayerPosition();
    }
  }

  /// Top-level functions to handle movement.

  handleCameraUp(delta: number = DEFAULT_DELTA, strategic: boolean) {
    this.applySpeedUpdate(MovementDirection.UP);
    this.applyTransformations(delta, strategic);
  }

  handleCameraLeft(delta: number = DEFAULT_DELTA, strategic: boolean) {
    this.applySpeedUpdate(MovementDirection.LEFT);
    this.applyTransformations(delta, strategic);
  }

  handleCameraRight(delta: number = DEFAULT_DELTA, strategic: boolean) {
    this.applySpeedUpdate(MovementDirection.RIGHT);
    this.applyTransformations(delta, strategic);
  }

  handleCameraDown(delta: number = DEFAULT_DELTA, strategic: boolean) {
    this.applySpeedUpdate(MovementDirection.DOWN);
    this.applyTransformations(delta, strategic);
  }
}
