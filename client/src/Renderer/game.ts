import "phaser";
import MainScene from "./scenes/mainScene";
import PreloadScene from "./scenes/preloadScene";
import InitializeScene from "./scenes/initializeScene";
import LoadingScene from "./scenes/loadingScene";
import { colors } from "./constants";
import { InputManager } from "./manager/InputManager";
import { CreatureManager } from "./manager/CreatureManager";
import { ViewportManager } from "./manager/ViewportManager";
import { ChunkManager } from "./manager/ChunkManager";
import { SelectionManager } from "./manager/SelectionManager";
import { ViewportObjectManager } from "./manager/ViewportObjectManager";
import { AnimationManager } from "./manager/AnimationManager";
import { ImpManager } from "./manager/ImpManager";
import { UnitMoveManager } from "./manager/UnitMoveManager";
import { GroupRegistry } from "./utils/groupRegistry";
import { GameMap } from "./objects/main/map";
import { CameraState } from "./manager/CameraState";
import { StrategicMap } from "./objects/main/strategicMap";
import { ToolManager } from "./manager/ToolManager";
import { ActiveTileManager } from "./manager/ActiveTileManager";
import { SelectionSystem } from "./systems/SelectionSystem";
import { CombatRendererManager } from "./manager/CombatRendererManager";
import { NotificationManager } from "../Frontend/NotificationManager";
import { NameQueue } from "../Backend/Utils/NameQueue";
import { SettlementManager } from "./manager/SettlementManager";

// size of the viewport in pixels
const GAME_WIDTH = window.innerWidth; //16 * 40;
const GAME_HEIGHT = window.innerHeight; //24 * 15;

export const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.WEBGL,
  backgroundColor: colors[0],
  scale: {
    parent: "phaser-game",
    autoCenter: Phaser.Scale.CENTER_HORIZONTALLY,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    zoom: 1,
    mode: Phaser.Scale.NONE,
  },
  pixelArt: true,
  roundPixels: true,
  autoFocus: true,
  render: {
    roundPixels: true,
    antialiasGL: false,
    pixelArt: true,
  },
  scene: [PreloadScene, LoadingScene, InitializeScene, MainScene],
};

export interface ServiceTool {
  bootServiceTool: (scene: Phaser.Scene) => void;
  destroyServiceTool: () => void;
}

/*
Interface for an object that maintains some state and is referenced by services. At a high level,
equivalent to a service, but semantically a ManagedObject is allowed / expected to have some
state and to be referenced across services. Due to certain services using ManagedObjects to keep a
reference to Phaser-specific objects, ManagedObjects are booted up before services, but are given
a reference to the services which have been constructed (but not yet booted) up. This way services
have the object state they need when they are booted up and managed objects have a reference to the
created (but not yet booted up) services for cases where objects wish to include some logic
in their bootObject() methods that involve certain services.

Currently, the most used ManagedObjects are the objects for game maps, such as GameMap and
StrategicMap.
*/
export interface ManagedObject {
  bootObject: (scene: Phaser.Scene, services: PhaserManagerServices) => void;
  destroyObject: () => void;
}

/*
Base interface for a set of ManagedObject's that a singleton manager might need.
*/
export interface ManagedObjects { }

/*
Set of ManagedObject's that 'PhaserManager' needs.
*/
export interface PhaserManagerObjects extends ManagedObjects {
  gameMap: GameMap;
  strategicMap: StrategicMap;
}

/*
Interface for a service, which can be instantiated with whatever constructor, but is required to
implement a boot() and a destroy() method. A service is an abstract "helper" that does some task.
The reason for enforcing the two methods is standardization of object lifecycles. A singleton 
manager such as a PhaserManager is expected to have a set of services and when the singleton is
instantiated, the services are also expected to be instantiated. However, instantiation is not
tied to a specific Phaser state, i.e. a Phaser.Scene. This is intentional in order to separate the
time when the services are created and the time when the services are actually able to boot up. 
Hence, callers expecting a manager singleton such as PhaserManager can safely request an instance,
but the call to bootService() will happen only at controlled times, such as when a Phaser.Scene is
ready to appear and boot up. Similarly, this allows for a guarantee that services are correctly 
destroyed, by controlling the time when destroyService() gets called, such as when the scene is
ready or is requested to be destroyed.
*/
export interface Service {
  bootService: (scene?: Phaser.Scene) => void;
  destroyService: () => void;
}

/*
Base interface for a set of Services that a singleton manager might need.
*/
export interface Services { }

/*
Set of Services that 'GameManager' needs.
*/
export interface GameManagerServices extends Services {
  nameQueue: NameQueue;
}

/*
Set of Services that 'UIManager' needs.
*/
export interface UIManagerServices extends Services {
  notificationManager: NotificationManager;
}

/*
Set of Services that 'PhaserManager' needs.
*/
export interface PhaserManagerServices extends Services {
  inputManager: InputManager;
  viewportManager: ViewportManager;
  strategicMapViewportManager: ViewportManager;

  chunkManager: ChunkManager;
  strategicMapChunkManager: ChunkManager;

  selectionManager: SelectionManager;
  viewportObjectManager: ViewportObjectManager;

  animationManager: AnimationManager;
  unitMoveManager: UnitMoveManager;
  impManager: ImpManager;

  // TODO: rename to manager
  cameraState: CameraState;

  creatureManager: CreatureManager;

  toolManager: ToolManager;
  combatRendererManager: CombatRendererManager;
  activeTileManager: ActiveTileManager;

  selectionSystem: SelectionSystem;

  groupRegistry: GroupRegistry;

  settlementManager: SettlementManager;
}

/*
Interface for anyone requiring some Services. The boot() and destroy() methods are responsible for
calling the bootService() and destroyService() methods on each service, such that all services are
booted up and destroyed at the same time.
*/
export interface RequiresServices {
  services: Services;
  boot: (scene?: Phaser.Scene) => void;
  destroy: () => void;
}

/*
Interface for anyone requiring some ManagedObjects.
*/
export interface RequiresObjects {
  objects: ManagedObjects;
}