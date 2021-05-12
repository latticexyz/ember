import { UIState } from "../../Frontend/UIManager";
import { GameMap } from "../objects/main/map";
import { range } from "../../Backend/Utils/Utils";
import { WorldCoord } from "../../_types/GlobalTypes";
import { getWorldCoordsAtPointerPosition } from "../../Backend/Utils/Utils";
import { worldCoordsEq } from "../utils/worldCoords";
import { Service } from "../game";

const DOUBLE_CLICK_TIME = 500;
const DOUBLE_CLICK_MAX_DISTANCE = 20;

export type Key = Phaser.Input.Keyboard.Key;
export type Pointer = Phaser.Input.Pointer;

// we don't use events, just ids that look like events
// but we'll call them events here anyway
export interface KeyBinding {
  performedEvent: string; // event to fire when key is pressed
  canceledEvent?: string;
  modifiedEvent?: string; // event to fire when a modifier key is down
  key: Key;
  modifierKey?: Key;
}

export interface PointerBinding {
  performedEvent: string;
  canceledEvent: string;
  rightClickEvent: string;
  modifiedEvent?: string;
  key: Pointer;
  modifierKey?: Key;
}

export interface KeyBindingsStore {
  performedEvents: string[];
  values: Key[];
}

export interface CancelKBS {
  performedEvents: string[];
  canceledEvents: string[];
  values: Key[];
}

export interface ModifyKBS {
  performedEvents: string[];
  modifiedEvents: string[];
  values: Key[];
  modifierKeys: Key[];
}

export interface DeviceKeyboard {
  standardKeys: KeyBindingsStore;
  cancelKeys: CancelKBS;
  modifyKeys: ModifyKBS;
}

export class InputState {
  deviceMouse: PointerBinding;
  deviceKeyboard: DeviceKeyboard;
  currentInput: Set<string>;
  alreadyPerformed: Set<string>; // this set keeps track of performed actions
  // and is not automatically reset each frame
  doubleClick: boolean;
  lastClick: number;
  lastClickPosition: Phaser.Math.Vector2;

  // When moving the camera around, keeps state for
  // the dx, dy change.
  dxLateral: number;
  dyLateral: number;

  // When zooming in / out with either the mouse wheel or by
  // piching, keeps state for the amount of delta to have varying
  // speed of zoom.
  zoomDelta: number;

  constructor() {
    this.deviceKeyboard = {
      standardKeys: {
        performedEvents: [],
        values: [],
      },
      cancelKeys: {
        performedEvents: [],
        canceledEvents: [],
        values: [],
      },
      modifyKeys: {
        performedEvents: [],
        modifiedEvents: [],
        values: [],
        modifierKeys: [],
      },
    };
    this.currentInput = new Set<string>();
    this.alreadyPerformed = new Set<string>();
    this.doubleClick = false;
    this.lastClickPosition = Phaser.Math.Vector2.ZERO;
    this.lastClick = 0;
  }

  addPointerBinding(binding: PointerBinding) {
    this.deviceMouse = binding;
  }

  addBinding(binding: KeyBinding) {
    if (binding.modifiedEvent) {
      this.deviceKeyboard.modifyKeys.values.push(binding.key);
      this.deviceKeyboard.modifyKeys.performedEvents.push(binding.performedEvent);
      this.deviceKeyboard.modifyKeys.modifiedEvents.push(binding.modifiedEvent);
      this.deviceKeyboard.modifyKeys.modifierKeys.push(binding.modifierKey!);
    } else if (binding.canceledEvent) {
      this.deviceKeyboard.cancelKeys.performedEvents.push(binding.performedEvent);
      this.deviceKeyboard.cancelKeys.canceledEvents.push(binding.canceledEvent);
      this.deviceKeyboard.cancelKeys.values.push(binding.key);
      this.deviceKeyboard.standardKeys.performedEvents.push(binding.performedEvent);
      this.deviceKeyboard.standardKeys.values.push(binding.key);
    } else {
      this.deviceKeyboard.standardKeys.performedEvents.push(binding.performedEvent);
      this.deviceKeyboard.standardKeys.values.push(binding.key);
    }
  }

  reset() {
    this.currentInput.clear();
  }

  destroy() {
    this.currentInput.clear();
    this.alreadyPerformed = new Set<string>();
    this.doubleClick = false;
    this.lastClick = 0;
    this.lastClickPosition = Phaser.Math.Vector2.ZERO;
    this.deviceKeyboard = {
      standardKeys: {
        performedEvents: [],
        values: [],
      },
      cancelKeys: {
        performedEvents: [],
        canceledEvents: [],
        values: [],
      },
      modifyKeys: {
        performedEvents: [],
        modifiedEvents: [],
        values: [],
        modifierKeys: [],
      },
    };
  }
}

/*
Allows a player to use a touchpad to control the movement or a mouse. This influences
how we process events and what the default controls are.
*/
export enum InputMode {
  MOUSE,
  TRACKPAD,
}

export class InputManager implements Service {
  keys: { [key: number]: Phaser.Input.Keyboard.Key };
  lastClick: number;
  lastKeyStroke: { [key: number]: number | undefined };
  state: InputState;
  inputMode: InputMode;
  // Timer to allow us to "snap" to a zoom level after some zoom inactivity
  // by the player.
  zoomInactivityTimer: Phaser.Time.TimerEvent;
  // Timer to allow us to detect when a player stops moving their cursor around.
  // This is implemented by tracking the last tile under the cursor and setting
  // a timeout for when that tile does not change. If it does change, i.e. player
  // hovers over a different tile, we reset the timer.
  lastTileUnderCursor: WorldCoord | undefined;
  cursorMovementInactivityTimer: Phaser.Time.TimerEvent;

  constructor() {
    this.state = new InputState();
    this.keys = {};

    this.lastKeyStroke = {};
    this.lastClick = 0;

    // Get whatever the player prefers or default to trackpad.
    const userPreference = localStorage.getItem("preference-input-mode");
    if (!userPreference) {
      this.inputMode = InputMode.TRACKPAD;
    } else {
      this.inputMode = userPreference === "mouse" ? InputMode.MOUSE : InputMode.TRACKPAD;
    }
  }

  bootService(scene: Phaser.Scene) {
    this.setupBindings(scene.input);
    this.setupListeners(scene.input);
  }

  destroyService() {
    this.state.destroy();
  }

  public setupListeners(input: Phaser.Input.InputPlugin) {
    input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      if (!pointer.middleButtonDown()) return;
      this.state.currentInput.add("lateralScrollWithMiddleMouseButton");

      // Reset the inactivity timer so that we do not attempt to
      // snap to a zoom level while the player is still moving.
      this.handleZoomMovementInactiveTimeout(input);

      // Record the delta of the drag in the input state such that
      // the camera system can use the state to update the scroll
      // of the camera.
      const dx = pointer.prevPosition.x - pointer.position.x;
      const dy = pointer.prevPosition.y - pointer.position.y;
      this.state.dxLateral = dx * 2;
      this.state.dyLateral = dy * 2;
    });

    input.on("wheel", (e) => {
      const mouseEvent: WheelEvent = e.event;
      mouseEvent.preventDefault();

      // Reset the inactivity timer so that we do not attempt to
      // snap to a zoom level while the player is still zooming.
      this.handleZoomMovementInactiveTimeout(input);

      if (mouseEvent.ctrlKey || this.isUsingMouse()) {
        let dy = mouseEvent.deltaY;

        // If using mouse, we flip the sign on delta to get the intuitive
        // scroll forward = zoom in behavior and also decrease the speed a bit.
        if (this.isUsingMouse()) dy *= -0.5;

        this.state.zoomDelta = dy;
        if (dy < 0) {
          this.state.currentInput.add("zoomIn");
        } else {
          this.state.currentInput.add("zoomOut");
        }
      } else {
        this.state.currentInput.add("lateralScroll");
        // Record the delta of the scroll such that the camera system can
        // use the state to update the scroll of the camera.
        const dx = mouseEvent.deltaX * 1.5;
        const dy = mouseEvent.deltaY * 1.5;
        this.state.dxLateral = dx;
        this.state.dyLateral = dy;
      }
    });
  }

  public setupBindings(input: Phaser.Input.InputPlugin) {
    const {
      W,
      A,
      S,
      D,
      ESC,
      SHIFT,
      SPACE,
      B,
      E,
      ONE,
      TWO,
      THREE,
      FOUR,
      FIVE,
      SIX,
      ALT,
      Z,
      X,
      C,
      V,
      Q,
      CTRL,
      BACKTICK,
      M,
    } = Phaser.Input.Keyboard.KeyCodes;

    const keys = [
      W,
      A,
      S,
      D,
      ESC,
      SHIFT,
      SPACE,
      B,
      E,
      ONE,
      TWO,
      THREE,
      FOUR,
      FIVE,
      SIX,
      ALT,
      Z,
      X,
      C,
      V,
      Q,
      CTRL,
      BACKTICK,
      M,
    ];
    keys.forEach((key) => {
      this.keys[key] = input.keyboard.addKey(key);
    });
    const pointerBinding: PointerBinding = {
      performedEvent: "drag",
      canceledEvent: "mouseUp",
      rightClickEvent: "rightClick",
      modifiedEvent: "shiftClick",
      key: input.activePointer,
      modifierKey: this.keys[SHIFT],
    };

    const mainSceneKeys: KeyBinding[] = [
      {
        performedEvent: "showTacticalView",
        canceledEvent: "hideTacticalView",
        key: this.keys[B],
      },
      {
        performedEvent: "showStrategicView",
        canceledEvent: "hideStrategicView",
        key: this.keys[SPACE],
      },
      {
        performedEvent: "cameraUp",
        key: this.keys[W],
        modifierKey: this.keys[SPACE],
        modifiedEvent: "strategicCameraUp",
      },
      {
        performedEvent: "cameraDown",
        key: this.keys[S],
        modifierKey: this.keys[SPACE],
        modifiedEvent: "strategicCameraDown",
      },
      {
        performedEvent: "cameraLeft",
        key: this.keys[A],
        modifierKey: this.keys[SPACE],
        modifiedEvent: "strategicCameraLeft",
      },
      {
        performedEvent: "cameraRight",
        key: this.keys[D],
        modifierKey: this.keys[SPACE],
        modifiedEvent: "strategicCameraRight",
      },
      {
        performedEvent: "viewCamera1",
        key: this.keys[Z],
        modifiedEvent: "setCamera1",
        modifierKey: this.keys[ALT],
      },
      {
        performedEvent: "viewCamera2",
        key: this.keys[X],
        modifiedEvent: "setCamera2",
        modifierKey: this.keys[ALT],
      },
      {
        performedEvent: "viewCamera3",
        key: this.keys[C],
        modifiedEvent: "setCamera3",
        modifierKey: this.keys[ALT],
      },
      {
        performedEvent: "recallViewport",
        key: this.keys[SHIFT],
      },
      {
        performedEvent: "centerDungeonHeart",
        key: this.keys[BACKTICK],
      },
      {
        performedEvent: "cancelAction",
        key: this.keys[ESC],
      },
      {
        performedEvent: "executeAction",
        key: this.keys[E],
      },
      {
        performedEvent: "cancelQueued",
        key: this.keys[Q],
      },
      // Upgrades
      {
        performedEvent: "goldStorage",
        key: this.keys[ONE],
      },
      {
        performedEvent: "goldGenerator",
        key: this.keys[TWO],
      },
      {
        performedEvent: "lair",
        key: this.keys[THREE],
      },
      {
        performedEvent: "soulStorage",
        key: this.keys[FOUR],
      },
      {
        performedEvent: "wall",
        key: this.keys[FIVE],
      },
      {
        performedEvent: "soulGenerator",
        key: this.keys[SIX],
      },
      {
        performedEvent: "holdShift",
        key: this.keys[SHIFT],
      },
      {
        performedEvent: "multiCreatureMove",
        key: this.keys[M],
      },
    ];

    this.state.addPointerBinding(pointerBinding);

    for (const binding of mainSceneKeys) {
      this.state.addBinding(binding);
    }
  }

  handleCursorMovementInactiveTimeout(input: Phaser.Input.InputPlugin, gameMap: GameMap) {
    const inactivityTime = 300;
    const inactivityCallback = () => {
      this.state.currentInput.add("cursorStoppedMoving");
    };
    const inactivityTimerConfig = {
      delay: inactivityTime,
      callback: inactivityCallback,
      callbackScope: this,
    };
    const currentTile = getWorldCoordsAtPointerPosition(this.state, gameMap);

    if (!worldCoordsEq(currentTile, this.lastTileUnderCursor)) {
      if (this.cursorMovementInactivityTimer) {
        this.cursorMovementInactivityTimer.reset(inactivityTimerConfig);
      } else {
        this.cursorMovementInactivityTimer = input.scene.time.addEvent(inactivityTimerConfig);
      }
      input.scene.time.addEvent(this.cursorMovementInactivityTimer);
      this.lastTileUnderCursor = currentTile;
      this.state.currentInput.add("cursorStartedMoving");
    }
  }

  handleZoomMovementInactiveTimeout(input: Phaser.Input.InputPlugin) {
    const inactivityTime = 1000;
    const inactivityCallback = () => {
      this.state.currentInput.add("zoomStopped");
    };
    const inactivityTimerConfig = {
      delay: inactivityTime,
      callback: inactivityCallback,
      callbackScope: this,
    };
    if (this.zoomInactivityTimer) {
      this.zoomInactivityTimer.reset(inactivityTimerConfig);
    } else {
      this.zoomInactivityTimer = input.scene.time.addEvent(inactivityTimerConfig);
    }
    input.scene.time.addEvent(this.zoomInactivityTimer);
  }

  isUsingMouse(): boolean {
    return this.inputMode == InputMode.MOUSE;
  }
  getWorldCoordsAtPointerPosition(gameMap: GameMap): WorldCoord | undefined {
    const pointer = this.state.deviceMouse.key;
    const worldPoint = pointer.positionToCamera(gameMap.camera) as Phaser.Math.Vector2;

    if (!worldPoint) return;
    // add half to width and half the height to the coord to fix this
    const pointerTileXY = gameMap.map.worldToTileXY(worldPoint.x, worldPoint.y);

    if (!pointerTileXY) return;

    return { x: pointerTileXY.x, y: pointerTileXY.y };
  }

  // Populates a list of currently active inputs
  public handleInput(input: Phaser.Input.InputPlugin, uiState: UIState, gameMap: GameMap) {
    if (uiState.inputFocused) {
      input.keyboard.enabled = false;
      input.keyboard.disableGlobalCapture();
      return;
    } else {
      input.keyboard.enabled = true;
      input.keyboard.enableGlobalCapture();
    }

    // Handler for timeout notification when player stops moving their cursor.
    this.handleCursorMovementInactiveTimeout(input, gameMap);

    const { SPACE, CTRL, ALT } = Phaser.Input.Keyboard.KeyCodes;
    const disableClick = uiState.pointerOverReactUI || this.keys[SPACE].isDown; // TODO: find a more general way to do this
    const pointer = this.state.deviceMouse.key;
    // Fire on mouseDown
    if (pointer.leftButtonDown() && !disableClick) {
      this.state.currentInput.add(this.state.deviceMouse.performedEvent);
      this.state.alreadyPerformed.add(this.state.deviceMouse.performedEvent);
    }
    // Fire on mouseUp
    if (
      this.state.alreadyPerformed.has(this.state.deviceMouse.performedEvent) &&
      pointer.leftButtonReleased() &&
      !disableClick
    ) {
      const now = Date.now();
      this.state.doubleClick =
        now - this.state.lastClick < DOUBLE_CLICK_TIME &&
        pointer.position.distance(this.state.lastClickPosition) < DOUBLE_CLICK_MAX_DISTANCE;
      this.state.lastClick = now;
      this.state.lastClickPosition = pointer.position.clone();
      if (this.state.deviceMouse.modifierKey && this.state.deviceMouse.modifierKey.isDown) {
        this.state.currentInput.add(this.state.deviceMouse.modifiedEvent!);
      }
      this.state.currentInput.add(this.state.deviceMouse.canceledEvent);
      this.state.alreadyPerformed.delete(this.state.deviceMouse.performedEvent);
    }
    if (pointer.rightButtonDown() && !disableClick) {
      this.state.currentInput.add(this.state.deviceMouse.rightClickEvent);
    }

    // Keyboard bindings with modifier callbacks
    for (const i of range(this.state.deviceKeyboard.modifyKeys.modifiedEvents.length)) {
      const key = this.state.deviceKeyboard.modifyKeys.values[i];
      const modifier = this.state.deviceKeyboard.modifyKeys.modifierKeys[i];
      const modifierEvent = this.state.deviceKeyboard.modifyKeys.modifiedEvents[i];
      const regularEvent = this.state.deviceKeyboard.modifyKeys.performedEvents[i];
      // TODO: I feel like we can pre-sort these into separate arrays ahead of time
      // Based on Modifier Key Type (Alt, Ctr, Meta, Shift, etc)
      // And just blast through each list
      // Which might be faster than branching in a hot loop
      // Because you avoid branch mispredictions
      // And the compiler will have an easier time optimizing
      // But idk because the inner working of javascript are a mystery to me
      // And this is a very minor performance optimization anyway
      if (Phaser.Input.Keyboard.JustDown(key) && modifier === this.keys[ALT]) {
        if (key.altKey) {
          this.state.currentInput.add(modifierEvent);
        } else {
          this.state.currentInput.add(regularEvent);
        }
      }
      if (key.isDown && modifier === this.keys[CTRL]) {
        if (key.ctrlKey) {
          this.state.currentInput.add(modifierEvent);
        } else {
          this.state.currentInput.add(regularEvent);
        }
      }
      if (key.isDown && modifier === this.keys[SPACE]) {
        if (modifier.isDown) {
          this.state.currentInput.add(modifierEvent);
        } else {
          this.state.currentInput.add(regularEvent);
        }
      }
    }
    // Standard bindings (no modifiers or cancel callbacks)
    for (const i of range(this.state.deviceKeyboard.standardKeys.performedEvents.length)) {
      const key = this.state.deviceKeyboard.standardKeys.values[i];
      const regularEvent = this.state.deviceKeyboard.standardKeys.performedEvents[i];
      if (key.isDown) {
        // TODO: do we need to distinguish between keys that are held down
        // and keys that are only activated once?
        this.state.currentInput.add(regularEvent);
        this.state.alreadyPerformed.add(regularEvent);
      }
    }
    // Bindings with cancel (onUp) callbacks
    for (const i of range(this.state.deviceKeyboard.cancelKeys.canceledEvents.length)) {
      const key = this.state.deviceKeyboard.cancelKeys.values[i];
      const cancelEvent = this.state.deviceKeyboard.cancelKeys.canceledEvents[i];
      const performedEvent = this.state.deviceKeyboard.cancelKeys.performedEvents[i];
      if (this.state.alreadyPerformed.has(performedEvent) && !key.isDown) {
        this.state.currentInput.add(cancelEvent);
        this.state.alreadyPerformed.delete(performedEvent);
      }
    }
  }
}
