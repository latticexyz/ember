import { EthAddress, WorldCoord, ImpWorkType } from "../../_types/GlobalTypes";
import { ViewportObjectManager } from "./ViewportObjectManager";
import { ViewportGameObject } from "../objects/ViewportGameObject";
import GameManager from "../../Backend/Game/GameManager";
import { getColorFromEthAddress } from "../utils/colors";
import { ColorKey, colors } from "../constants";
import { CheckedTypeUtils } from "../../Backend/Utils/CheckedTypeUtils";
import { GroupRegistry } from "../utils/groupRegistry";
import Imp from "../objects/main/imp";
import MainScene from "../scenes/mainScene";
import { UnitMoveManager, UnitType } from "./UnitMoveManager";
import { translate } from "../../Utils/Utils";
import { CoordMap } from "../../Utils/CoordMap";
import { l2, aStar, tileCoordToRegionCoord, bfs, checkInRange } from "../../Backend/Utils/Utils";
import { v4 } from "uuid";
import { TileUpgrade } from "../../_types/ContractTypes";
import { worldCoordsEq } from "../utils/worldCoords";
import { Service } from "../game";

interface ImpWork {
  tileCoord: WorldCoord;
  type: ImpWorkType;
}

const MAX_IDLE_IMPS_IN_REGION_BEFORE_DESPAWN = 2;
const TIME_BEFORE_DESPAWN = 10000;

class PlayerImpManager implements Service {
  private gm: GameManager = GameManager.getInstance();

  private imps = new Set<string>();
  private impGroup: Phaser.GameObjects.Group;
  private impToTile = new Map<string, ImpWork>();
  private tileToImp = new CoordMap<string>();
  private dh: WorldCoord;
  private despawnInterval: NodeJS.Timeout;

  constructor(
    private address: EthAddress,
    private scene: MainScene,
    private viewportObjectManager: ViewportObjectManager,
    private unitMoveManager: UnitMoveManager,
    private groupRegistry: GroupRegistry,
    private emitterManager: Phaser.GameObjects.Particles.ParticleEmitterManager
  ) {
    // TODO: why is this not used?
    this.despawnInterval = setInterval(() => this.removeIdleImps(), 5000);
  }

  bootService(scene: Phaser.Scene) {
    // This group is owned by the GroupRegistry and will be destroyed when the GroupRegistry
    // service is destroyed.
    this.impGroup = this.groupRegistry.groups.imp;
    this.init();
  }

  destroyService() {
    for (const impId of this.imps) {
      this.removeImp(impId);
    }
    this.imps.clear();
    this.impToTile.clear();
    this.tileToImp.map.clear();
  }

  public addTileToWorkOn(tileCoord: WorldCoord, type: ImpWorkType) {
    if (!this.dh) {
      // the dh is still loading
      // reschedule
      setTimeout(() => this.addTileToWorkOn(tileCoord, type), 1000);
      return;
    }
    // Check if this tile is already being worked on
    if (this.tileToImp.get(tileCoord)) return;

    let imp = this.getClosestFreeImp(tileCoord);

    if (!imp) {
      const spawnLocation = this.getSuitableSpawnLocation(tileCoord);
      imp = this.registerImp(spawnLocation);
    }

    this.assignImpToTile(imp, tileCoord, type);
  }

  public removeTileToWorkOn(tileCoord: WorldCoord) {
    const imp = this.tileToImp.get(tileCoord);
    this.tileToImp.delete(tileCoord);
    if (!imp) return;

    this.impToTile.delete(imp);
    this.unitMoveManager.clearPath(imp);

    const viewportObject = this.viewportObjectManager.getSpawnedObjectById(imp);
    if (viewportObject && viewportObject.typedGameObject?.type === UnitType.Imp) {
      viewportObject.typedGameObject.object.clearWorkingOn();
    }

    // Imps flee enemy regions after they're done working
    const impLocation = this.viewportObjectManager.objectRegistry.getCoordById(imp)!;
    const { controller } = this.gm.extendedDungeon.getRegionController(tileCoordToRegionCoord(impLocation));
    if (controller !== CheckedTypeUtils.EMPTY_ADDRESS && controller !== this.address) {
      this.fleeImp(imp);
    }
  }

  public fleeRegion(regionCoord: WorldCoord) {
    for (const id of this.imps) {
      const coord = this.viewportObjectManager.objectRegistry.getCoordById(id);
      // Only idle imps in the region flee
      if (!coord || !worldCoordsEq(tileCoordToRegionCoord(coord), regionCoord) || this.impToTile.get(id)) continue;
      this.fleeImp(id);
    }
  }

  private fleeImp(id: string) {
    this.removeImp(id);

    // TODO: figure out why imps won't flee. Just kill them for now to merge this.
    // const currentPos = this.viewportObjectManager.objectRegistry.getCoordById(id);
    // if (!currentPos) return this.removeImp(id);

    // const path = bfs({
    //   start: currentPos,
    //   pathLimit: 20,
    //   regionLimit: 1,
    //   checkDiagonal: false,
    //   pathRequirement: (coord) => this.isTraversable(coord),
    //   endRequirement: (coord) =>
    //     this.isTraversable(coord) &&
    //     this.gm.extendedDungeon.getRegionController(tileCoordToRegionCoord(coord))?.controller === this.address,
    // });

    // if (path) {
    //   path.reverse();
    //   // This is a hack to prevent the imp from stopping before the final tile.
    //   // We should change the setPath method to allow for config overrides.
    //   path.push(path[path.length - 1]);
    //   console.log("imp", id, "found a path", path);
    //   this.unitMoveManager.setPath(id, path, () => {
    //     this.unitMoveManager.clearPath(id);
    //   });
    //   return;
    // }

    // return this.removeImp(id);
  }

  private assignImpToTile(imp: string, tileCoord: WorldCoord, type: ImpWorkType) {
    this.impToTile.set(imp, { tileCoord, type });
    this.tileToImp.set(tileCoord, imp);

    const pathEndAction = (unit?: Imp) => {
      if (!unit || unit.emitter?.on) {
        return;
      }
      unit.setWorkingOn(tileCoord, type);
    };

    const pos = this.viewportObjectManager.objectRegistry.getCoordById(imp);
    if (!pos) return this.unitMoveManager.setPath(imp, [tileCoord], pathEndAction);
    const path = aStar(pos, tileCoord, this.gm.extendedDungeon, this.isTraversable.bind(this));
    if (path) {
      this.unitMoveManager.setPath(imp, path, pathEndAction);
      return;
    }
    // relaxing and ignoring imps and tile loading here
    const relaxedPath = aStar(pos, tileCoord, this.gm.extendedDungeon, (coord) =>
      this.isTraversable(coord, true, true)
    );
    if (relaxedPath) {
      this.unitMoveManager.setPath(imp, relaxedPath, pathEndAction);
      return;
    }
    this.unitMoveManager.setPath(imp, [tileCoord], pathEndAction);
    return;
  }

  private isTraversable(
    tileCoord: WorldCoord,
    ignoreOtherImps: boolean = false,
    ignoreTilesBeingWorkedOn: boolean = true
  ): boolean {
    if (!ignoreOtherImps && this.tileToImp.get(tileCoord)) return false;
    const rangeCheck = checkInRange(this.gm.constants.MAX_X, this.gm.constants.MAX_Y);
    if (!rangeCheck(tileCoord)) return false;
    // check if there is currently a tile loading here
    if (!ignoreTilesBeingWorkedOn && this.tileToImp.get(tileCoord)) {
      return false;
    }
    const tile = this.gm.extendedDungeon.getTileAt(tileCoord);
    return tile.isMined && !tile.isWalled;
  }

  private async init() {
    this.dh = await this.gm.extendedDungeon.getPlayerDungeonHeart(this.address);
    this.registerImp(this.dh);
    this.registerImp(translate(this.dh, 1, 1));
  }

  private registerImp(initialCoord: WorldCoord): string {
    const id = v4();
    this.imps.add(id);

    const hueTint =
      this.address === this.gm.address
        ? colors[ColorKey.Player]
        : getColorFromEthAddress(CheckedTypeUtils.address(this.address)).color;

    this.viewportObjectManager.add(
      new ViewportGameObject(id, {
        spawn: (currentCoord: WorldCoord, isNewObject?: boolean) => {
          const imp: Imp = this.impGroup.get();
          imp.initImp(
            this.scene.gameMap.map,
            this.emitterManager,
            currentCoord.x,
            currentCoord.y,
            this.scene.hueTintPipeline,
            this.address,
            id,
            hueTint,
            isNewObject
          );

          const tileToWorkOn = this.impToTile.get(id);
          if (tileToWorkOn) {
            const { tileCoord, type } = tileToWorkOn;
            this.assignImpToTile(id, tileCoord, type);
          }

          return { type: UnitType.Imp, object: imp };
        },
        despawn: (isRemoved?: boolean) => {
          const typedGameObject = this.viewportObjectManager.getSpawnedObjectById(id)?.typedGameObject;
          const object = typedGameObject && typedGameObject.type === UnitType.Imp && typedGameObject.object;
          if (object) {
            if (isRemoved) {
              object.anims.play("imp-disappear");
              object.once("animationcomplete", () => {
                this.impGroup.killAndHide(object);
              });
            } else {
              this.impGroup.killAndHide(object);
            }
          }
        },
        update: () => {
          const viewportObject = this.viewportObjectManager.getSpawnedObjectById(id);
          viewportObject?.typedGameObject?.object.update();
        },
      }),
      initialCoord
    );

    this.unitMoveManager.registerUnit(id, UnitType.Imp);

    return id;
  }

  private getClosestFreeImp(tileCoord: WorldCoord): string | undefined {
    let shortestDistance = Number.MAX_SAFE_INTEGER;
    let closestFreeImp: string | undefined;

    for (const id of this.imps) {
      if (this.impToTile.get(id)) continue;
      const pos = this.viewportObjectManager.objectRegistry.getCoordById(id);
      if (!pos) continue;
      const distance = l2(pos, tileCoord);
      if (distance < 16 && distance < shortestDistance) {
        const path = aStar(pos, tileCoord, this.gm.extendedDungeon, (coord) => this.isTraversable(coord, true, true));
        if (path) {
          closestFreeImp = id;
          shortestDistance = distance;
        }
      }
    }

    return closestFreeImp;
  }

  private getSuitableSpawnLocation(tileCoord: WorldCoord): WorldCoord {
    const distance = l2(this.dh, tileCoord);

    if (distance < 16) {
      const path = aStar(this.dh, tileCoord, this.gm.extendedDungeon, this.isTraversable.bind(this));
      if (path) {
        const firstNonDhTile = path.find(
          (t) => this.gm.extendedDungeon.getTileAt(t).upgrade !== TileUpgrade.DUNGEON_HEART
        );
        if (firstNonDhTile) {
          return firstNonDhTile;
        }
      }
    }

    // if it wasn't possible to spawn an imp from the dungeon heart, spawn from bfs
    // endRequirement: you need to reach a region you control and the tile needs to be mined and unwalled
    // we also want something in a different region if possible
    const createEndRequirement = (minL2Distance: number, needToBeRegionController: boolean) => (coord: WorldCoord) => {
      if (!this.isTraversable(coord, false, false)) {
        return false;
      }
      if (l2(coord, tileCoord) < minL2Distance) {
        return false;
      }
      if (needToBeRegionController) {
        const fromRegion = tileCoordToRegionCoord(coord);
        const { controller, disputed } = this.gm.extendedDungeon.getRegionController(fromRegion);
        if (controller !== this.address || disputed) return false;
      }
      return true;
    };

    const path = bfs({
      start: tileCoord,
      pathLimit: 32,
      pathRequirement: (coord) => this.isTraversable(coord, true),
      endRequirement: createEndRequirement(8, true),
    });

    if (path && path[0]) {
      return path[0];
    }

    const pathNoControllerRequirement = bfs({
      start: tileCoord,
      pathLimit: 32,
      pathRequirement: (coord) => this.isTraversable(coord, true),
      endRequirement: createEndRequirement(8, false),
    });

    if (pathNoControllerRequirement && pathNoControllerRequirement[0]) {
      return pathNoControllerRequirement[0];
    }

    const pathNoControllerAndDistanceRequirement = bfs({
      start: tileCoord,
      pathLimit: 32,
      pathRequirement: (coord) => this.isTraversable(coord, true),
      endRequirement: createEndRequirement(1, false),
    });

    if (pathNoControllerAndDistanceRequirement && pathNoControllerAndDistanceRequirement[0]) {
      return pathNoControllerAndDistanceRequirement[0];
    }
    console.warn("Didn't find a suitable spawn location");
    return tileCoord;
  }

  private removeImp(id: string) {
    const tile = this.impToTile.get(id);
    if (tile && tile.tileCoord) this.tileToImp.delete(tile.tileCoord);
    this.imps.delete(id);
    this.impToTile.delete(id);
    this.viewportObjectManager.remove(id);
    this.unitMoveManager.deregisterUnit(id);
  }

  private removeIdleImps() {
    const now = Date.now();

    if (this.imps.size <= MAX_IDLE_IMPS_IN_REGION_BEFORE_DESPAWN) return;

    const impsPerRegion = new CoordMap<number>({ defaultValue: 0 });

    for (const imp of this.imps) {
      // only despawn imps that are not working
      if (this.impToTile.get(imp)) continue;

      // for imps in the viewport - only despawn imps that have not been working for TIME_BEFORE_DESPAWN
      const viewportObject = this.viewportObjectManager.getSpawnedObjectById(imp);
      if (
        viewportObject &&
        viewportObject.typedGameObject?.type === UnitType.Imp &&
        now - viewportObject.typedGameObject.object.lastWorkAt < TIME_BEFORE_DESPAWN
      ) {
        continue;
      }

      const pos = this.viewportObjectManager.objectRegistry.getCoordById(imp)!;
      const region = tileCoordToRegionCoord(pos);
      const numImps = impsPerRegion.get(region)!;

      if (numImps < MAX_IDLE_IMPS_IN_REGION_BEFORE_DESPAWN) {
        impsPerRegion.set(region, numImps + 1);
      } else {
        this.removeImp(imp);
      }
    }
  }
}

export class ImpManager implements Service {
  private playerImpManagers = new Map<EthAddress, PlayerImpManager>();
  private scene: MainScene;
  private particleManager: Phaser.GameObjects.Particles.ParticleEmitterManager;

  constructor(
    private viewportObjectManager: ViewportObjectManager,
    private unitMoveManager: UnitMoveManager,
    private groupRegistry: GroupRegistry
  ) { }

  bootService(scene: MainScene) {
    this.scene = scene;
    this.particleManager = scene.particleManager;

    for (const player of scene.gm.extendedDungeon.players.keys()) {
      this.initPlayer(player);
    }
  }

  destroyService() {
    for (const playerImpManager of this.playerImpManagers.values()) {
      playerImpManager.destroyService();
    }
    this.playerImpManagers.clear();
  }

  public isInitialized(address: EthAddress): boolean {
    return Boolean(this.playerImpManagers.get(address));
  }

  public async initPlayer(address: EthAddress) {
    if (this.isInitialized(address)) return;
    const playerImpManager = new PlayerImpManager(
      address,
      this.scene,
      this.viewportObjectManager,
      this.unitMoveManager,
      this.groupRegistry,
      this.particleManager
    );
    playerImpManager.bootService(this.scene);

    this.playerImpManagers.set(address, playerImpManager);
  }

  public addTileToWorkOn(address: EthAddress, tileCoord: WorldCoord, type: ImpWorkType) {
    this.playerImpManagers.get(address)?.addTileToWorkOn(tileCoord, type);
  }

  public removeTileToWorkOn(address: EthAddress, tileCoord: WorldCoord) {
    this.playerImpManagers.get(address)?.removeTileToWorkOn(tileCoord);
  }

  public fleeRegion(regionCoord: WorldCoord, newController: EthAddress) {
    if (newController === CheckedTypeUtils.EMPTY_ADDRESS) return;
    for (const [player, impManager] of this.playerImpManagers.entries()) {
      if (player !== newController) {
        impManager.fleeRegion(regionCoord);
      }
    }
  }
}
