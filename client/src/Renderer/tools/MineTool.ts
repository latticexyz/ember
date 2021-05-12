import { WorldCoord, Tool } from "../../_types/GlobalTypes";
import GameManager from "../../Backend/Game/GameManager";
import { tileCoordToRegionCoord } from "../../Backend/Utils/Utils";
import { UIState } from "../../Frontend/UIManager";
import { TileDelayedActionType } from "../../_types/ContractTypes";
import { needsForceMine, isCurrentlyMineable } from "./Utils";
import { CoordMap } from "../../Utils/CoordMap";
import { CIRCULAR_DIRECTIONS, DIRECTIONS } from "../../Utils/Utils";
import { Mask } from "../objects/main/mask";
import Cursor, { CursorColor } from "../objects/main/cursor";
import ExtendedDungeon from "../../Backend/Game/ExtendedDungeon";
import { toJS } from "mobx";
import MainScene from "../scenes/mainScene";

export class MineTool {
  // mineableArea: Polygon;
  availableRegions: CoordMap<boolean>;

  private cursor: Cursor;

  constructor(
    private gm: GameManager,
    private uiState: UIState,
  ) {
    // this.mineableArea = new Polygon(scene);
    // this.mineableArea.init(gameMap, {
    //   depth: 1,
    //   style: PolygonStyle.FILLEDBORDER,
    //   borderColor: hexColors.ice,
    //   color: hexColors.soul,
    //   alpha: 0.05,
    //   borderAlpha: 0.2,
    // });
    // scene.add.existing(this.mineableArea);
    this.availableRegions = new CoordMap<boolean>();
  }

  bootService(scene: MainScene) {
    this.cursor = scene.gameMap.cursor;
    // this.mineableArea = new Mask(
    //   scene.gameMap.map.scene,
    //   scene.gameMap.map,
    //   scene.gameMap.camera,
    //   { alpha: 0.1, depth: 1 }
    // );
  }

  destroyService() {
    // this.mineableArea.destroy();
    this.availableRegions.map.clear();
  }

  private activateCursor() {
    this.cursor.setColorSelector((tileCoord) => {
      const regionCoord = tileCoordToRegionCoord(tileCoord);
      // if (!this.availableRegions.get(regionCoord)) {
      //   return CursorColor.Invalid;
      // }

      try {
        const tile = this.gm.extendedDungeon.getTileAt(tileCoord);

        // if (this.uiState.tool === Tool.MineTile) {
        //   if (tile.isMined && !tile.isWalled) {
        //     return CursorColor.Invalid;
        //   } else {
        //     return CursorColor.Valid;
        //   }
        // }

        // if (this.uiState.tool === Tool.ClaimTile) {
        //   if (tile.isMined && tile.owner !== this.gm.address) {
        //     return CursorColor.Valid;
        //   } else {
        //     return CursorColor.Invalid;
        //   }
        // }

        return CursorColor.Valid;
      } catch (e) {
        return CursorColor.Invalid;
      }
    });
  }

  private deactivateCursor() {
    this.cursor.resetColorSelector();
  }

  public setAvailableArea() {
    this.availableRegions = new CoordMap<boolean>();
    const { creature: hero, found } = this.gm.extendedDungeon.getPlayerHero(this.gm.address);
    if (!found) {
      return;
    }
    const regionCoord = tileCoordToRegionCoord(hero.tileCoord);
    this.availableRegions.set(regionCoord, true);
    CIRCULAR_DIRECTIONS.forEach((direction) => {
      this.availableRegions.set({ x: regionCoord.x + direction.x, y: regionCoord.y + direction.y }, true);
    });

    // this.mineableArea.clear();
    // this.mineableArea.setRegions(this.availableRegions.coords());
  }

  public clear() {
    // this.mineableArea.clear();
    this.deactivateCursor();
  }

  public isActive() {
    return this.uiState.tool === Tool.MineTile;
  }

  public getMineTiles(selection: WorldCoord[]): { mineable: WorldCoord[]; forceMine: WorldCoord[] } | undefined {
    const forceMine: WorldCoord[] = [];
    const mineable: WorldCoord[] = [];

    for (const coord of selection) {
      // Filter coords outside the available regions
      const regionCoord = tileCoordToRegionCoord(coord);
      if (!this.availableRegions.get(regionCoord)) {
        continue;
      }
      if (!needsForceMine(coord, this.gm.address, this.gm.extendedDungeon)) {
        const tile = this.gm.extendedDungeon.getTileAt(coord);
        if (!tile.isMined) {
          mineable.push(coord);
        }
      } else {
        forceMine.push(coord);
      }
    }
    return { mineable, forceMine };
  }

  public cancelMineTiles(mineableCoords: WorldCoord[], forceMineCoords: WorldCoord[]) {
    for (const coord of mineableCoords) {
      this.gm.cancelMineTile(coord);
    }
    for (const coord of forceMineCoords) {
      this.gm.cancelInitiateForceMineTile(coord);
    }
    for (const coord of forceMineCoords) {
      this.gm.cancelIniateUnwallTile(coord);
    }
  }

  public mineTiles(mineableCoords: WorldCoord[], forceMineCoords: WorldCoord[]) {
    if (mineableCoords.length > 0) {
      this.gm.mineTiles(toJS(mineableCoords));
    }
    if (forceMineCoords.length > 0) {
      const currentlyMineable = forceMineCoords.filter((coord) =>
        isCurrentlyMineable(coord, this.gm.extendedDungeon, this.gm.constants, this.gm.address)
      );
      if (currentlyMineable.length === 0) return;
      // Probably best to not do the confirmation popup
      // because people are usually intentional about what they want to do
      // So asking "are you sure?" is annoying
      // And they could just cancel from the actionQueue anyway
      const reduced = currentlyMineable.reduce(
        (res: any, coord: WorldCoord) => {
          const tile = this.gm.extendedDungeon.getTileAt(coord);
          res[tile.isWalled ? "unwall" : "forceMine"].push(coord);
          return res;
        },
        { unwall: [], forceMine: [] }
      );

      if (reduced.unwall.length > 0) {
        this.gm.initiateUnwallTiles(toJS(reduced.unwall));
      }
      if (reduced.forceMine.length > 0) {
        this.gm.initiateForceMineTiles(toJS(reduced.forceMine));
      }
    }
  }
}
