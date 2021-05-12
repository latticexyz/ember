import { RequiresServices, PhaserManagerServices, RequiresObjects, PhaserManagerObjects } from "../game";
import { ChunkManager } from "./ChunkManager";
import { CreatureManager } from "./CreatureManager";
import { InputManager } from "./InputManager";
import { ViewportManager } from "./ViewportManager";
import { GAME_MAP_RENDER_CHUNK_SIZE, STRATEGIC_MAP_RENDER_CHUNK_SIZE } from "../constants";
import { SelectionManager } from "./SelectionManager";
import MainScene from "../scenes/mainScene";
import { ViewportObjectManager } from "./ViewportObjectManager";
import { AnimationManager } from "./AnimationManager";
import { ImpManager } from "./ImpManager";
import { UnitMoveManager } from "./UnitMoveManager";
import { GroupRegistry } from "../utils/groupRegistry";
import { GameMap } from "../objects/main/map";
import { CameraState } from "./CameraState";
import { StrategicMap } from "../objects/main/strategicMap";
import { ToolManager } from "./ToolManager";
import { ActiveTileManager } from "./ActiveTileManager";
import { SelectionSystem } from "../systems/SelectionSystem";
import { CombatRendererManager } from "./CombatRendererManager";

export class PhaserManager implements RequiresServices, RequiresObjects {
    objects: PhaserManagerObjects;
    services: PhaserManagerServices;
    static instance?: PhaserManager;

    constructor() {
        const groupRegistry = new GroupRegistry();

        const inputManager = new InputManager();
        const viewportManager = new ViewportManager();
        const strategicMapViewportManager = new ViewportManager()

        const chunkManager = new ChunkManager({
            chunkWidth: GAME_MAP_RENDER_CHUNK_SIZE,
            chunkHeight: GAME_MAP_RENDER_CHUNK_SIZE,
            name: "main",
            viewportManager: viewportManager
        });
        const strategicMapChunkManager = new ChunkManager({
            chunkWidth: STRATEGIC_MAP_RENDER_CHUNK_SIZE,
            chunkHeight: STRATEGIC_MAP_RENDER_CHUNK_SIZE,
            name: "strategic",
            viewportManager: strategicMapViewportManager,
        });

        const selectionManager = new SelectionManager();
        const viewportObjectManager = new ViewportObjectManager(viewportManager);

        const unitMoveManager = new UnitMoveManager(viewportObjectManager, groupRegistry);
        const impManager = new ImpManager(viewportObjectManager, unitMoveManager, groupRegistry);
        const animationManager = new AnimationManager(impManager, chunkManager, viewportManager);

        const cameraState = new CameraState();

        const creatureManager = new CreatureManager(viewportObjectManager, unitMoveManager, groupRegistry);

        const toolManager = new ToolManager(
            creatureManager,
            viewportObjectManager,
            inputManager,
            selectionManager.state,
            unitMoveManager,
            viewportManager
        );
        const combatRendererManager = new CombatRendererManager(groupRegistry);
        const activeTileManager = new ActiveTileManager(viewportObjectManager, groupRegistry);

        const selectionSystem = new SelectionSystem(toolManager, inputManager.state);

        this.services = {
            inputManager: inputManager,
            viewportManager: viewportManager,
            strategicMapViewportManager: strategicMapViewportManager,
            chunkManager: chunkManager,
            strategicMapChunkManager: strategicMapChunkManager,
            selectionManager: selectionManager,
            viewportObjectManager: viewportObjectManager,
            unitMoveManager: unitMoveManager,
            impManager: impManager,
            animationManager: animationManager,
            cameraState: cameraState,
            creatureManager: creatureManager,
            toolManager: toolManager,
            combatRendererManager: combatRendererManager,
            activeTileManager: activeTileManager,
            selectionSystem: selectionSystem,
            groupRegistry: groupRegistry
        };

        const gameMap = new GameMap(viewportManager, groupRegistry);
        const strategicMap = new StrategicMap(viewportManager);

        this.objects = {
            gameMap: gameMap,
            strategicMap: strategicMap
        };
    }

    boot(scene: MainScene) {
        // Boot up the GroupRegistry first, since certain services need a reference
        // to individual registries under the GroupRegistry service, and so when they
        // call their bootService() method, we want to make sure that the registry
        // is already initialized.
        this.services.groupRegistry.bootService(scene);

        // Boot objects here because some tools like the toolManager relies on the actual
        // properties of objects like 'gameMap' when calling it's own bootService(). This means
        // that the object should be already booted up by the time the service boots itself up.
        //
        // Note: This is why initially in 'mainScene.ts' certain objects were created in weird order.
        //       We still need to respect the dependencies but only in this boot() method.
        this.objects.gameMap.bootObject(scene, this.services);
        this.objects.strategicMap.bootObject(scene, this.services);

        // Boot the services.
        this.services.inputManager.bootService(scene);
        this.services.viewportManager.bootService(scene);
        this.services.strategicMapViewportManager.bootService(scene);
        this.services.chunkManager.bootService(scene);
        this.services.strategicMapChunkManager.bootService(scene);

        this.services.viewportObjectManager.bootService(scene);
        this.services.unitMoveManager.bootService(scene);
        this.services.impManager.bootService(scene);
        this.services.animationManager.bootService(scene);

        this.services.cameraState.bootService(scene);

        this.services.creatureManager.bootService(scene);

        // Note: This calls Polygon init() which needs an instantiated gameMap with .map.
        this.services.selectionManager.bootService(scene);

        this.services.toolManager.bootService(scene);
        this.services.combatRendererManager.bootService(scene);
        this.services.activeTileManager.bootService(scene);

        this.services.selectionSystem.bootService(scene);
    }

    destroy() {
        // Destroy the services.
        this.services.inputManager.destroyService();
        this.services.viewportManager.destroyService();
        this.services.strategicMapViewportManager.destroyService();
        this.services.chunkManager.destroyService();
        this.services.strategicMapChunkManager.destroyService();

        this.services.selectionManager.destroyService();

        this.services.viewportObjectManager.destroyService();
        this.services.unitMoveManager.destroyService();
        this.services.impManager.destroyService();
        this.services.animationManager.destroyService();

        this.services.cameraState.destroyService();

        this.services.creatureManager.destroyService();

        this.services.toolManager.destroyService();
        this.services.combatRendererManager.destroyService();
        this.services.activeTileManager.destroyService();

        this.services.selectionSystem.destroyService();

        // Destroy the group registry last to allow any services to clean up own state by accessing
        // the registry if necessary. This is not strictly needed but is how works now.
        this.services.groupRegistry.destroyService();

        // Destroy the objects.
        this.objects.gameMap.destroyObject();
        this.objects.strategicMap.destroyObject();
    }

    static getInstance(): PhaserManager {
        if (!this.instance) {
            this.instance = new PhaserManager();
        }
        return this.instance;
    }

    public static destroy() {
        if (!this.instance) return;
        delete this.instance;
    }

    public static hasInstance() {
        return !!this.instance;
    }
}
