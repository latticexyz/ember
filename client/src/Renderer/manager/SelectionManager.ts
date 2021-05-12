import { WorldCoord } from "../../_types/GlobalTypes";
import { BaseSelection } from "../objects/main/BaseSelection";
import { action, computed, makeObservable, observable } from "mobx";
import { tileCoordToRegionCoord } from "../../Backend/Utils/Utils";
import GameManager from "../../Backend/Game/GameManager";
import { TileUpgrade } from "../../_types/ContractTypes";
import { Service } from "../game";
import MainScene from "../scenes/mainScene";
import { PhaserManager } from "./PhaserManager";

export enum TerrainType {
  Mine,
  Upgrade,
  ForceMine,
  Creature,
}

export class GameSelection extends BaseSelection {
  mineableCoords: WorldCoord[] = [];
  upgradeableCoords: WorldCoord[] = [];
  forceMineCoords: WorldCoord[] = [];
  // Currently selected creature IDs.
  selectedCreatureIds: Set<string> = new Set();
  gm: GameManager;

  constructor() {
    super();
    this.gm = GameManager.getInstance();
    makeObservable(this, {
      selectedCoords: observable,
      firstSelectedRegion: computed,
      mineableCoords: observable,
      upgradeableCoords: observable,
      forceMineCoords: observable,
      selectedCreatureIds: observable,
      setSelectedCoords: action,
      setTerrainCoords: action,
      clearCreatures: action,
      addCreature: action,
      areAllSelectedCreaturesOwn: computed,
      clearGameSelection: action,
      canInspectSelection: computed,
      selectionIsOwned: computed,
      selectionIsDH: computed,
      hasSelectedCreatures: computed,
    });
  }

  setSelectedCoords(coords: WorldCoord[]) {
    this.selectedCoords = coords;

    if (coords.length === 0) {
      // TODO: all these should be computed properties depending on selectedCoords
      this.setTerrainCoords([], TerrainType.Mine);
      this.setTerrainCoords([], TerrainType.ForceMine);
      this.setTerrainCoords([], TerrainType.Upgrade);
    }
  }

  setTerrainCoords(coords: WorldCoord[], terrainType: TerrainType) {
    if (terrainType === TerrainType.Mine) {
      this.mineableCoords = coords;
    }
    if (terrainType === TerrainType.Upgrade) {
      this.upgradeableCoords = coords;
    }
    if (terrainType === TerrainType.ForceMine) {
      this.forceMineCoords = coords;
    }
  }

  get areAllSelectedCreaturesOwn(): boolean {
    let onlyOwned = true;

    const isCreatureOwnedByPlayer = (creatureId: string): boolean => {
      const creature = this.gm.extendedDungeon.creatures.get(creatureId);
      if (!creature) return false;
      return creature.owner === this.gm.address;
    };

    for (const creatureId of Array.from(this.selectedCreatureIds.values())) {
      onlyOwned = onlyOwned && isCreatureOwnedByPlayer(creatureId);
    }

    return onlyOwned;
  }

  get firstSelectedRegion() {
    if (this.selectedCoords.length === 0) return null;
    return tileCoordToRegionCoord(this.selectedCoords[0]);
  }

  hasMineableCoords() {
    return this.mineableCoords.length > 0;
  }

  hasForceMineCoords() {
    return this.forceMineCoords.length > 0;
  }

  hasUpgradeableCoords() {
    return this.upgradeableCoords.length > 0;
  }

  get hasSelectedCreatures() {
    return this.selectedCreatureIds.size > 0;
  }

  clearCreatures() {
    this.selectedCreatureIds.clear();
  }

  addCreature(creatureId: string) {
    this.selectedCreatureIds.add(creatureId);
  }

  clearGameSelection() {
    this.upgradeableCoords = [];
    this.mineableCoords = [];
    this.tileSelectionPolygon.clear();
  }

  get canInspectSelection() {
    return this.selectedCoords.length === 1 && this.selectedCreatureIds.size === 0;
  }

  get selectionIsOwned() {
    if (this.selectedCoords.length === 0) return false;
    const inspectedTile = this.gm.extendedDungeon.getTileAt(this.selectedCoords[0]);
    if (!inspectedTile) return false;
    return this.selectedCoords.length === 1 && inspectedTile.owner === this.gm.address;
  }

  get selectionIsDH() {
    if (this.selectedCoords.length === 0) return false;
    const inspectedTile = this.gm.extendedDungeon.getTileAt(this.selectedCoords[0]);
    if (!inspectedTile) {
      return false;
    }
    return this.selectionIsOwned && inspectedTile.upgrade === TileUpgrade.DUNGEON_HEART;
  }
}


// TODO: get rid of this and make GameSelection implement 'ManagedObject'. There is really no 
// reason to have an extra manager just for a single state object. 
export class SelectionManager implements Service {
  state: GameSelection;

  constructor() {
    this.state = new GameSelection();
  }

  bootService(scene: MainScene) {
    // TODO: the call to phaser manager won't be necessary to get the services once
    // the TODO above is done and the manager is deleted in favor of having a 
    // GameSelection be a 'ManagedObject'.
    this.state.bootObject(scene, PhaserManager.getInstance().services);
  }

  destroyService() {
    this.state.destroyObject();
  }
}
