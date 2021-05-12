import { CombatWinner, CombatTrace } from "@latticexyz/ember-combat";
import GameManager from "../../Backend/Game/GameManager";
import { creatureEq, regionCoordToTileCoord } from "../../Backend/Utils/Utils";
import { CoordMap } from "../../Utils/CoordMap";
import { Creature, WorldCoord } from "../../_types/GlobalTypes";
import { Service } from "../game";
import CombatRenderer from "../objects/main/combatRenderer";
import { GameMap } from "../objects/main/map";
import MainScene from "../scenes/mainScene";
import { GroupRegistry } from "../utils/groupRegistry";

interface RenderCombatProps {
  regionCoord: WorldCoord;
  squad1: Creature[];
  squad2: Creature[];
  trace: CombatTrace;
  winner: CombatWinner;
  soulsDropped: number;
  txHash: string;
}

export class CombatRendererManager implements Service {
  private gm: GameManager = GameManager.getInstance();
  private scene: MainScene;
  private gameMap: GameMap;

  private combatRenderers: CoordMap<CombatRenderer>;
  private queues: CoordMap<RenderCombatProps[]>;
  private playing: CoordMap<boolean>;

  private group: Phaser.GameObjects.Group;

  constructor(private groupRegistry: GroupRegistry) {
    this.combatRenderers = new CoordMap<CombatRenderer>();
    this.queues = new CoordMap<RenderCombatProps[]>();
    this.playing = new CoordMap<boolean>();
  }

  bootService(scene: MainScene) {
    this.scene = scene;
    this.gameMap = scene.gameMap;
    // The 'combatRenderer' group is owned by GroupRegistry, so it will be destroyed when
    // the GroupRegistry service is destroyed.
    this.group = this.groupRegistry.groups.combatRenderer;
  }

  destroyService() {
    for (const combatRenderer of this.combatRenderers.values()) {
      this.group.remove(combatRenderer, true, true);
    }
    this.combatRenderers.map.clear();
    this.queues.map.clear();
    this.playing.map.clear();
  }

  isSameCr(squad1: Creature[], squad2: Creature[], cr2: CombatRenderer): boolean {
    return (
      squad1.every((s) => cr2.squad1.find((crs) => creatureEq(crs, s))) &&
      squad2.every((s) => cr2.squad2.find((crs) => creatureEq(crs, s)))
    );
  }

  async playCombatTraceOnCrAndThenDestroy(
    cr: CombatRenderer,
    trace: CombatTrace,
    winner: CombatWinner,
    soulsDropped: number
  ) {
    await cr.playCombatTrace(trace, winner, soulsDropped);
    this.group.remove(cr, true, true);
  }

  private addToQueue(props: RenderCombatProps) {
    const queue = this.queues.get(props.regionCoord);
    if (queue) {
      queue.push(props);
    } else {
      this.queues.set(props.regionCoord, [props]);
    }
  }

  private processQueue(regionCoord: WorldCoord) {
    const queue = this.queues.get(regionCoord);
    if (!queue) return;
    if (queue.length === 0) {
      this.queues.delete(regionCoord);
    } else {
      const nextTrace = queue.shift()!;
      this.playCombatTrace(nextTrace);
    }
  }

  async playCombatTrace(props: RenderCombatProps) {
    const { regionCoord, squad1, squad2, trace, winner, soulsDropped, txHash } = props;
    if (this.playing.get(regionCoord)) {
      return this.addToQueue(props);
    }

    this.playing.set(regionCoord, true);

    // 3 cases: there is an optimistic cr there waiting to be rendered, there is nothing, or there is already a cr playing the trace
    let combatPromise: Promise<any>;
    const cr = this.combatRenderers.get(regionCoord);
    if (!cr || cr.destroyed) {
      const tileCoord = regionCoordToTileCoord(regionCoord);
      const pos = this.gameMap.map.tileToWorldXY(tileCoord.x, tileCoord.y);
      const cr = new CombatRenderer(
        this.scene,
        this.scene.hueTintPipeline,
        this.gm.constants,
        pos.x,
        pos.y,
        this.gm.address,
        squad1,
        squad2,
        regionCoord
      );
      combatPromise = this.playCombatTraceOnCrAndThenDestroy(cr, trace, winner, soulsDropped);
      this.combatRenderers.set(regionCoord, cr);
      this.group.add(cr);
    } else if (cr && !cr.playingTrace && this.isSameCr(squad1, squad2, cr)) {
      combatPromise = this.playCombatTraceOnCrAndThenDestroy(cr, trace, winner, soulsDropped);
    } else {
      this.group.remove(cr, true, true);
      const tileCoord = regionCoordToTileCoord(regionCoord);
      const pos = this.gameMap.map.tileToWorldXY(tileCoord.x, tileCoord.y);
      const crNew = new CombatRenderer(
        this.scene,
        this.scene.hueTintPipeline,
        this.gm.constants,
        pos.x,
        pos.y,
        this.gm.address,
        squad1,
        squad2,
        regionCoord
      );
      this.combatRenderers.set(regionCoord, crNew);
      combatPromise = this.playCombatTraceOnCrAndThenDestroy(crNew, trace, winner, soulsDropped);
      this.group.add(cr);
    }

    await combatPromise;
    this.playing.delete(regionCoord);
    this.processQueue(regionCoord);
  }

  update() {
    const regionsInViewport = this.gameMap.getRegionsInViewport();
    for (const [coord, cr] of this.combatRenderers.toArray()) {
      if (regionsInViewport.get(coord)) {
        cr.update();
      }
    }
  }
}
