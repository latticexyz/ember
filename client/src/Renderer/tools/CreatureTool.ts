import GameManager from "../../Backend/Game/GameManager";
import { WorldCoord, Tile } from "../../_types/GlobalTypes";
import { getSurroundingTilesOfSameType } from "../../Backend/Utils/Tiles";
import {
  aStar,
  getPathToDestinationTile,
  Move,
  MovementPath,
  MovementPathType,
  regionCoordToSetOfTileCoords,
  tileCoordToRegionCoord,
  regionCoordToTileCoord,
  checkInRange,
} from "../../Backend/Utils/Utils";
import { clearCoordSelection } from "../systems/Utils";
import { worldCoordsEq } from "../utils/worldCoords";
import ExtendedDungeon from "../../Backend/Game/ExtendedDungeon";
import { Creature } from "../objects/main/creature";
import { CreatureManager } from "../manager/CreatureManager";
import { Mask } from "../objects/main/mask";
import { getSurroundingCoords } from "../../Backend/Utils/WorldCoords";
import Cursor, { CursorType, CursorColor } from "../objects/main/cursor";
import { UIState } from "../../Frontend/UIManager";
import { ViewportObjectManager } from "../manager/ViewportObjectManager";
import { ViewportObjectManagerEvent } from "../../_types/ContractTypes";
import { GameSelection } from "../manager/SelectionManager";
import { REGION_LENGTH } from "../../Backend/Utils/Defaults";
import { ViewportManager } from "../manager/ViewportManager";
import { SoundManager, SoundType, SoundLayer } from "../manager/SoundManager";
import { UnitMoveManager } from "../manager/UnitMoveManager";
import { Service } from "../game";
import MainScene from "../scenes/mainScene";

export class CreatureTool implements Service {
  // A constant value from the game constants object limiting number of regions
  // a creature can traverse per single move.
  REGION_MOVE_LIMIT: number;
  // Currently selected region.
  // TODO: pull out of state into a function?
  selectedRegion: WorldCoord | undefined;
  // Whether or not the current selection includes some of player's
  // own creatures
  selectedOwnCreatures: boolean;
  mask: Mask;
  // A sort of 'cached' pre-computed path towards whatever tile / region the
  // player is currently hovering over. This is re-computed with a timer when
  // the player is not moving their cursor.
  currentlyComputedMovementPath: MovementPath | undefined;

  constructor(
    private gm: GameManager,
    private extendedDungeon: ExtendedDungeon,
    private creatureManager: CreatureManager,
    // Current game selection. This object holds the state of which
    // creatures are selected.
    private selection: GameSelection,
    private cursor: Cursor,
    private uiState: UIState,
    private gameObjectManager: ViewportObjectManager,
    private unitMoveManager: UnitMoveManager,
    private viewportManager: ViewportManager
  ) {
    this.setupEventListeners();
    this.REGION_MOVE_LIMIT = this.gm.constants.gameConstants.CREATURES_MAX_REGION_DISTANCE_FOR_MOVE;
  }

  bootService(scene: MainScene) {
    this.mask = new Mask(scene, scene.gameMap.map, scene.gameMap.camera);
  }

  destroyService() {
    this.mask.destroy();
  }

  private setupEventListeners() {
    this.gameObjectManager.addListener(ViewportObjectManagerEvent.ViewportObjectSpawned, (creatureId) => {
      if (this.selection.selectedCreatureIds.has(creatureId)) {
        this.creatureManager.markCreature(creatureId);
      }
    });
  }

  public getCreaturesAtCoords(selectedCoords: WorldCoord[]): { own: boolean; creatures: Creature[] } {
    const creatures = this.creatureManager.getCreaturesAtCoords(selectedCoords);
    const own =
      creatures.length > 0 && this.gm.extendedDungeon.creatures.get(creatures[0].id)!.owner === this.gm.address;
    return { creatures, own };
  }

  /*
  Called by the 'CreatureMoveSystem', this function is in charge of moving the current selection
  to a destination tile. Prior to calling this function, a player must have selected something under
  the cursor.
  */
  completeSingleCreatureDestinationMove(destinationTile: WorldCoord) {
    if (!this.selectedRegion) return;
    if (!this.currentlyComputedMovementPath) return;

    const creatureIds = this.getCurrentlySelectedOwnCreatures();
    const destinationRegion = tileCoordToRegionCoord(destinationTile);

    const moves: Move[] | undefined = this.movementPathToMovesArray(
      this.currentlyComputedMovementPath,
      destinationRegion,
      destinationTile
    );
    if (!moves) return;

    // Play combat sound if this is a combat move
    const creaturesAtDestination = this.gm.extendedDungeon.getRegionAt(destinationRegion).creatures;
    const creatureAtDestination =
      creaturesAtDestination.length > 0 && this.gm.extendedDungeon.creatures.get(creaturesAtDestination[0]);
    const hasEnemyCreature = creatureAtDestination && creatureAtDestination.owner !== this.gm.address;

    if (hasEnemyCreature && this.viewportManager.isRegionInViewport(destinationRegion)) {
      const tileCoord = regionCoordToTileCoord(destinationRegion);
      SoundManager.register(SoundType.CREATURE_MOVE, tileCoord, SoundLayer.COMBAT);
    }

    this.gm.metaMoveCreatures(moves, creatureIds);
    this.clearSelection();
  }

  /*
  Called by the 'CreatureMoveSystem', this function updates the state on the current selection
  for whatever creatures are currently selected.
  */
  handleUpdateSelection(selectedCoords: WorldCoord[], shift: boolean, doubleClick: boolean) {
    this.clearGraphics();

    const regionCoord = tileCoordToRegionCoord(selectedCoords[0]);

    // Compute selected coords.
    let tileCoords = selectedCoords;
    if (doubleClick) {
      // If there is a double click when selecting a creature, we want to fetch all other tiles in
      // the region that may be a place for a creature to stand, which will allow us to select all
      // creatures the region.
      const belongsToSameGroup = (exploredTile: Tile, exploredWorldCoord: WorldCoord) => {
        const exploredRegionCoord = tileCoordToRegionCoord(exploredWorldCoord);

        return exploredTile.isMined && worldCoordsEq(regionCoord, exploredRegionCoord);
      };
      tileCoords = getSurroundingTilesOfSameType(selectedCoords[0], belongsToSameGroup, this.extendedDungeon);
    }

    // Get the new creatures from the selection that we want to add.
    let { own, creatures } = this.getCreaturesAtCoords(tileCoords);

    // Clear the current selection unless selecting with 'SHIFT'.
    if (!shift) {
      this.selection.clearCreatures();
      this.uiState.setCreatureData({ selectedCreatureIds: [], creaturesInHoverRegion: [] });
    } else {
      // If holding shift, then we want to add selected creatures together.
      // Check if all of the creatures that we are adding are from the same region as the one
      // that where the currently selected creatures are. If there is any mismatch, clear the
      // current selection.
      const currentSelection = Array.from(this.selection.selectedCreatureIds.values());
      if (currentSelection.length > 0) {
        const selectedCreatureId = currentSelection[0];
        const selectedCreature = this.extendedDungeon.creatures.get(selectedCreatureId);

        if (selectedCreature) {
          for (const currentCreature of creatures) {
            const creatureBeingAdded = this.extendedDungeon.creatures.get(currentCreature.id);
            if (!creatureBeingAdded) continue;
            // If the coordinates of the regions mismatch, that means there is a mix of creatures
            // from different regions, so we clear the current selection.
            if (
              !worldCoordsEq(
                tileCoordToRegionCoord(creatureBeingAdded.tileCoord),
                tileCoordToRegionCoord(selectedCreature.tileCoord)
              )
            ) {
              this.selection.clearCreatures();
              this.uiState.setCreatureData({ selectedCreatureIds: [], creaturesInHoverRegion: [] });
            }
          }
        }
      }
    }

    // If we have creatures selected, then we need to determine which region the creatures are in
    // and which group of creatures to select if the selection spans multiple regions. The
    // decision is based on how many creatures per region are selected, e.g. if the selection contains
    // 3 creatures from region A and 1 creature from region B, we treat this selection as selecting
    // region A, and thus only creatures from region A are selected.
    if (creatures.length > 0) {
      // Build a map of region -> tuple of [set of creatures in that region, region coordinate]. We do
      // this to only have to do one pass over the selected creatures and store the region since it's
      // more tractable to have a string as a key in the map instead of a WorldCoord.
      const creaturesPerRegion: Map<string, [Set<Creature>, WorldCoord]> = creatures.reduce(
        (map, currentCreature: Creature) => {
          const creature = this.extendedDungeon.creatures.get(currentCreature.id);
          if (!creature) return map;

          const region = tileCoordToRegionCoord(creature.tileCoord);
          const regionKey = `${region.x},${region.y}`;
          const creatureRegionData = map.get(regionKey);
          if (creatureRegionData) {
            const [creaturesInRegion, _] = creatureRegionData;
            map.set(regionKey, [creaturesInRegion.add(currentCreature), region]);
          } else {
            const newSet = new Set<Creature>();
            newSet.add(currentCreature);
            map.set(regionKey, [newSet, region]);
          }
          return map;
        },
        new Map<string, [Set<Creature>, WorldCoord]>()
      );

      // Once we have a map built of where creatures are for this selection, we iterate the map and
      // determine which region has the most creatures from this selection, and set the region
      // selected accordingly.
      let largestGroupSize: number = 0;
      let selectedGroup: Creature[] | undefined;
      let selectedGroupRegion: WorldCoord | undefined;

      for (const [_, [creatures, region]] of creaturesPerRegion) {
        if (creatures.size > largestGroupSize) {
          largestGroupSize = creatures.size;
          selectedGroup = Array.from(creatures);
          selectedGroupRegion = region;
        }
      }

      if (selectedGroup && selectedGroupRegion) {
        // We re-write in a sense the list of creatures that have been selected, based on the above
        // logic, such that even if the player selects creatures from multiple region, this will
        // make sure that only creatures from a single region are selected.
        creatures = selectedGroup;
        this.selectedRegion = selectedGroupRegion;
        this.selectedOwnCreatures = own;
      }
    }

    // Add the newly selected creatures to the selection state.
    for (const creature of creatures) {
      this.selection.addCreature(creature.id);
      this.uiState.addCreature(creature.id);
    }

    // Outline all selected creatures.
    for (const creatureId of Array.from(this.selection.selectedCreatureIds.values())) {
      this.creatureManager.markCreature(creatureId);
    }

    if (this.selection.selectedCreatureIds.size > 0) {
      this.maskSelection();
      this.activateCursor();
    } else {
      this.clearSelection();
    }
  }

  /// Functions for handling various creature movements.

  /*
  Function that can be used to break down a path in region space into smaller moves that can be
  executed via a single transaction each, forming a chain of moves, i.e. a meta-move.

  The function takes in a destination tile and path through multiple regions that is longer than
  the enforced single move distance.

  Returns an array of 'Move's which can then be iterated and executed sequentially to move across
  multiple regions.
  */
  private breakDownMetaMove(destinationTile: WorldCoord, regionSpacePath: WorldCoord[]): Move[] {
    let moves: Move[] = [];

    let i = 0;
    let j = 0;

    while (i < regionSpacePath.length && j < regionSpacePath.length) {
      // This is true if we are at the very end of the region path array.
      if (i === regionSpacePath.length - 1) {
        moves.push({
          startRegion: regionSpacePath[j],
          endRegion: regionSpacePath[i],
          endTile: destinationTile,
        });
      }
      // The region move limit controls how far in regions we can go per move.
      else if (i > 0 && i % this.REGION_MOVE_LIMIT === 0) {
        moves.push({
          startRegion: regionSpacePath[j],
          endRegion: regionSpacePath[i],
          endTile: undefined,
        });
        j = i;
      }
      i++;
    }

    return moves;
  }

  /*
  Utility function to convert a 'MovementPath' (either a short or long path) into
  an array of 'Moves' that we can return and then use to create a move action.
  */
  private movementPathToMovesArray(
    movementPath: MovementPath,
    destinationRegion: WorldCoord,
    destinationTile: WorldCoord | undefined
  ): Move[] | undefined {
    if (movementPath.type === MovementPathType.SHORT) {
      const move: Move = {
        startRegion: tileCoordToRegionCoord(movementPath.path[0]),
        endRegion: destinationRegion,
        endTile: destinationTile,
      };
      return [move];
    }
    if (movementPath.type === MovementPathType.LONG && destinationTile) {
      // A meta creature move is just comprised of a bunch of "simple" creature moves, so figure out
      // how to split the path in region space here.
      // In general, we will need to make a few "intermediary" moves where we are moving anywhere in the
      // intermediary region (any tile), since the goal is just to move the creatures through that area.
      // The final move *does* need to be directed to a specific tile, since that would be the final move.
      // The final move will have 'endTile' field set.
      return this.breakDownMetaMove(destinationTile, movementPath.path);
    }

    return undefined;
  }

  maskSelection() {
    this.mask.clear();
    if (this.selectedOwnCreatures && this.selectedRegion && this.selection.selectedCreatureIds.size > 0) {
      const reachableRegions = getSurroundingCoords(this.selectedRegion, this.REGION_MOVE_LIMIT);
      this.mask.setRegions([this.selectedRegion, ...reachableRegions]);
    }
  }

  getCurrentlySelectedOwnCreatures(): string[] {
    return Array.from(this.selection.selectedCreatureIds.values()).filter(
      (id: string) => this.extendedDungeon.creatures.get(id)?.owner === this.gm.address
    );
  }

  /*
  Function to call if we want to know whether there is a path to a destination *tile* for the current
  creature selection. This uses the path finding util function to exactly determine if we reach the
  destination tile.
  
  Returns a 'MovementPath' of type 'SHORT' if there is a path (the path must be within a single move
  size limit for a single transaction) or 'INACCESSIBLE' if we can't reach the destination tile. If
  we are interested if there is a path to a tile that is beyond the move limit for a single move, then
  we should use the function to check a path to a region, which may handle longer distances.
  */
  getPathToDestinationTile(
    currentRegion: WorldCoord,
    destinationRegion: WorldCoord,
    destinationTile: WorldCoord
  ): MovementPath {
    const creatureIds = this.getCurrentlySelectedOwnCreatures();

    const pathUnavailable: MovementPath = {
      path: [],
      type: MovementPathType.INACCESSIBLE,
    };

    // If the destination tile is within the region that is currently selected, do not attempt to compute
    // the path since the move would not be allowed anyways.
    if (worldCoordsEq(destinationRegion, currentRegion)) return pathUnavailable;

    try {
      let { path } =
        getPathToDestinationTile({
          creatureIds,
          destinationRegion,
          destinationTile,
          pathLimit: 64,
          extendedDungeon: this.gm.extendedDungeon,
          playerAddress: this.gm.address,
          regionLimit: this.REGION_MOVE_LIMIT,
        }) || {};

      if (path) {
        return {
          path: path,
          type: MovementPathType.SHORT,
        };
      } else {
        return pathUnavailable;
      }
    } catch (e) {
      return pathUnavailable;
    }
  }

  // Simple "shallow" check if a a tile is traversible.
  isTraversable(tile?: Tile): boolean {
    return !!tile && tile.isMined && (!tile.isWalled || tile.owner === this.gm.address);
  }

  // Simple constraint that a region should have at least one "naively" traversible
  // tile. See comment on function above for details.
  hasAtLeastOneTileToMove(region: WorldCoord): boolean {
    const tilesInThisRegion = regionCoordToSetOfTileCoords(region);

    let isThereValidTile = false;

    for (let i = 0; i < REGION_LENGTH; i++) {
      for (let j = 0; j < REGION_LENGTH; j++) {
        const tile = this.extendedDungeon.tiles.get(tilesInThisRegion[i][j]);
        isThereValidTile = isThereValidTile || this.isTraversable(tile);
        if (isThereValidTile) return true;
      }
    }
    return isThereValidTile;
  }

  /*
  Function to call if we want to know whether there is a path to a destination *region* for the
  current creature selection. This uses A* in region space with the requirement that a region 
  just has to have at least one "isTraversible" tile. 
   
  Note that this is not completely accurate and may fail, but we use this is a heuristic to let 
  the user know if a move is plausible to a region, even if that region is far away from current
  selection. Hence use this function to determine if a meta-move can potentially succeed.
  */
  getPathToDestinationRegion(
    startRegion: WorldCoord,
    destinationRegion: WorldCoord,
    destinationTile: WorldCoord
  ): MovementPath {
    // Even if we care about a path to region, if the destination tile is unaccessible, then
    // we should not try finding a path.
    if (!this.isTraversable(this.extendedDungeon.tiles.get(destinationTile))) {
      return {
        path: [],
        type: MovementPathType.INACCESSIBLE,
      };
    }

    // Function to evaluate whethere we can go through the region.
    // (1) Is there at least one tile that we can move to in the region.
    // (2) Are there any enemy creatures currently at that region.
    const isValidRegionForMetaMove = (region: WorldCoord): boolean => {
      const creatures = this.gm.extendedDungeon.getCreaturesInRegion(region);
      const hasEnemyCreatures = creatures.length > 0 && creatures[0].owner !== this.gm.address;
      const hasTileToMoveTo = this.hasAtLeastOneTileToMove(region);

      return !hasEnemyCreatures && hasTileToMoveTo;
    };

    // If the destination region is an invalid destination as of the current state, for example if there
    // are currently enemy creatures in there or if there are simply no tiles to move to, then don't bother
    // trying to find a path.
    if (!isValidRegionForMetaMove(destinationRegion)) {
      return {
        path: [],
        type: MovementPathType.INACCESSIBLE,
      };
    }

    const path = aStar(startRegion, destinationRegion, this.gm.extendedDungeon, isValidRegionForMetaMove);

    // This means that there is no way to get to this region without triggering some sort of combat or running into
    // an obstacle.
    if (!path) {
      return {
        path: [],
        type: MovementPathType.INACCESSIBLE,
      };
    }

    // Figure out what kind of path this is, either a long one (if we traverse > N regions) or a short one (<= N regions).
    // The path is an array of coordinates, i.e. [[0, 1], [0, 2], [0, 3]], so the number of actual moves is the length of
    // the path minus one.
    const numberMoves = path.length - 1;
    const pathType = numberMoves > this.REGION_MOVE_LIMIT ? MovementPathType.LONG : MovementPathType.SHORT;

    return {
      path: path,
      type: pathType,
    };
  }

  /// Functions to pre-compute path to whatever tile is currently under cursor.

  /*
  Function that CreatureMovementSystem should call when the cursor has stopped moving (detected
  via an input event). 
  */
  updatePathToCurrentTile(destinationTile: WorldCoord | undefined) {
    const pathToDestinationRegion = this.computeMovementPath(destinationTile);
    this.currentlyComputedMovementPath = pathToDestinationRegion;
  }

  /*
  Function that converts a given path in tile space (all tiles needed to traverse from tile A to tile B)
  to a path in region space (which regions have to be traversed sequentially to get to the destination region,
  which in this example would be the region that tile B is a part of).
  */
  getPathInRegionSpace(pathInTileSpace: WorldCoord[], startingRegion: WorldCoord): WorldCoord[] {
    let regionKeySet: Set<string> = new Set();
    let pathInRegionSpace: WorldCoord[] = [];

    for (const tile of pathInTileSpace) {
      const regionOfTile = tileCoordToRegionCoord(tile);
      const key = `${regionOfTile.x},${regionOfTile.y}`;

      if (!regionKeySet.has(key)) {
        regionKeySet.add(key);
        pathInRegionSpace.push(regionOfTile);
      }
    }
    return pathInRegionSpace;
  }

  /*
  Function that pre-computes the path for a given 'destinationTile'. The function figures out
  if the tile / region provided is within the single move distance or farther out and depending
  on that either calls to find the path to the specific tile or to the region, which then can
  be broken up into a meta-move.
  */
  computeMovementPath(destinationTile: WorldCoord | undefined): MovementPath | undefined {
    if (!this.selectedRegion || !destinationTile) return;

    const destinationRegion = tileCoordToRegionCoord(destinationTile);

    // If the destination region is the same as the current region, then we should not
    // try finding a path.
    if (worldCoordsEq(destinationRegion, this.selectedRegion)) {
      return {
        path: [],
        type: MovementPathType.INACCESSIBLE,
      };
    }

    // If the destination tile is unaccessible, then we should not try finding a path.
    if (!this.isTraversable(this.extendedDungeon.tiles.get(destinationTile))) {
      return {
        path: [],
        type: MovementPathType.INACCESSIBLE,
      };
    }

    // Functions that can be used with A* to determine if a path is valid per tile.
    const rangeCheck = checkInRange(this.gm.constants.MAX_X, this.gm.constants.MAX_Y);
    const isValidTile = (coord: WorldCoord): boolean => {
      if (!rangeCheck(coord)) return false;
      const tile = this.gm.extendedDungeon.getTileAt(coord);
      return tile.isMined && (!tile.isWalled || tile.owner === this.gm.address);
    };

    const creatureIds = this.getCurrentlySelectedOwnCreatures();
    const firstCreature = this.extendedDungeon.creatures.get(creatureIds[0]);
    // Didn't select any creatures.
    if (!firstCreature) return undefined;

    // Compute path in tile space.
    const path = aStar(firstCreature.tileCoord, destinationTile, this.gm.extendedDungeon, isValidTile);

    if (!path) {
      return {
        path: [],
        type: MovementPathType.INACCESSIBLE,
      };
    }

    // Convert to a path in region space (this is used for 'LONG' paths).
    const pathInRegionSpace = this.getPathInRegionSpace(path, this.selectedRegion);

    if (pathInRegionSpace.length <= this.REGION_MOVE_LIMIT + 1) {
      // This is true if we can move to the destination in one move.
      return {
        path: path,
        type: MovementPathType.SHORT,
      };
    } else {
      // This means we need to use multiple moves to get to the destination.
      return {
        path: pathInRegionSpace,
        type: MovementPathType.LONG,
      };
    }
  }

  /*
  Function to clear whatever the current pre-computed path is.
  */
  clearComputedPathToCurrentTile() {
    if (!this.currentlyComputedMovementPath) return;
    this.currentlyComputedMovementPath = undefined;
  }

  /*
  Function that sets up the cursor selectors. The cursor selectors are in charge of figuring out
  what type (tile vs. region) and color the cursor should be.
  */
  private activateCursor() {
    // Set up the cursor selector for the *type* of the cursor.
    this.cursor.setCursorSelector((tileUnderCursor) => {
      // Get whatever region is currently under the cursor.
      const regionUnderCursor = tileCoordToRegionCoord(tileUnderCursor);

      if (!this.selectedRegion || !this.selectedOwnCreatures) {
        return CursorType.Tile;
      }

      // This is true if we are hovering over a region that is also the one where
      // the selected creatures are.
      const regionUnderCursorIsSelected = worldCoordsEq(regionUnderCursor, this.selectedRegion);
      if (regionUnderCursorIsSelected) {
        return CursorType.Tile;
      }

      // Handle the case when planning a multi-creature move. We need to support clicking
      // around and showing a destination selection cursor per-creature. And then finally
      // all of them will be moved at once.
      if (this.isCurrentlyPlanningMultiCreatureMove()) {
        if (this.isCurrentlySelectingSingleCreatureForMove()) {
          return CursorType.Region;
        } else {
          return CursorType.Tile;
        }
      }

      return CursorType.Region;
    });

    // Set up the cursor selector for the *color* of the cursor.
    this.cursor.setColorSelector((tileUnderCursor) => {
      // Get whatever region is currently under the cursor.
      const regionUnderCursor = tileCoordToRegionCoord(tileUnderCursor);

      if (!this.selectedRegion || !this.selectedOwnCreatures) {
        return CursorColor.Neutral;
      }

      // This is true if we are hovering over a region that is also the one where
      // the selected creatures are.
      const regionUnderCursorIsSelected = worldCoordsEq(regionUnderCursor, this.selectedRegion);
      if (regionUnderCursorIsSelected) {
        return CursorColor.Neutral;
      }

      return CursorColor.Neutral;
    });

    // Set up the secondary cursor selector. This cursor is only visible
    // when the cursor type is a 'Region' cursor and is in charge of
    // showing the player the status of a potential move to a specific tile
    // under the cursor.
    this.cursor.setSecondaryColorSelector(() => {
      const pathToRegion = this.currentlyComputedMovementPath;
      if (pathToRegion) {
        if (pathToRegion.type === MovementPathType.SHORT) {
          return CursorColor.Valid;
        } else if (pathToRegion.type === MovementPathType.LONG) {
          return CursorColor.Questionable;
        } else {
          return CursorColor.Invalid;
        }
      }

      return CursorColor.Neutral;
    });

    this.cursor.onCoordChange = (coord: WorldCoord) => {
      const regionCoord = tileCoordToRegionCoord(coord);
      if (this.selectedOwnCreatures && this.selectedRegion && !worldCoordsEq(regionCoord, this.selectedRegion)) {
        const creatures = this.extendedDungeon.getRegionAt(regionCoord).creatures;
        this.uiState.setCreaturesInHoverRegion(creatures);
      } else {
        this.uiState.setCreaturesInHoverRegion([]);
      }
    };
  }

  /// Functions for managing multi-creature moves.

  isCurrentlyPlanningMultiCreatureMove(): boolean {
    return this.uiState.creatureMovementData.multiMoveCurrentlyPlanning;
  }

  isCurrentlySelectingSingleCreatureForMove(): boolean {
    return this.uiState.creatureMovementData.multiMoveCurrentlySelectedCreatureId !== undefined;
  }

  startMultiCreatureMove() {
    this.uiState.startPlanningMultiCreatureMove(this.selection.selectedCreatureIds.size);
  }

  stopMultiCreatureMove() {
    this.uiState.stopPlanningMultiCreatureMove();
  }

  /*
  Function which should be called by the 'CreatureMoveSystem' to either start or complete a
  multi-creature move. The move can only be completed once all selected creature destinations
  have been set.
  */
  startOrCompleteMultiCreatureMove() {
    if (this.isCurrentlyPlanningMultiCreatureMove()) {
      if (!this.uiState.areAllDestinationsSet()) return;

      this.completeMultiCreatureDestinationMove();
    } else {
      if (this.getCurrentlySelectedOwnCreatures().length <= 1) return;

      this.startMultiCreatureMove();
    }
  }

  /*
  Function that handles completion of a multi-creature move. In particular, here we create a map of
  destination paths per creature ID and call 'multipleDestinationsMoveCreatures()' which will create a 
  single metaAction comprised of other actions or even metaActions.
  */
  completeMultiCreatureDestinationMove() {
    if (this.isCurrentlySelectingSingleCreatureForMove()) return;

    const creatureIds = this.getCurrentlySelectedOwnCreatures();
    if (creatureIds.length === 0) return;

    // First build a map of movement paths for each creature as selected by player.
    let destinationPaths: Map<string, Move[]> = new Map();

    for (const creatureId of creatureIds) {
      const destinationTile = this.uiState.getDestinationForCreatureInMultiCreatureMove(creatureId);
      if (!destinationTile) continue;

      const destinationRegion = tileCoordToRegionCoord(destinationTile);

      // Compute path to destination tile / region.
      const pathToDestinationRegion = this.computeMovementPath(destinationTile);
      if (!pathToDestinationRegion) continue;

      // Convert the movement path into an array of moves to standardize the format.
      const moves: Move[] | undefined = this.movementPathToMovesArray(
        pathToDestinationRegion,
        destinationRegion,
        destinationTile
      );
      if (!moves) continue;

      destinationPaths.set(creatureId, moves);
    }

    // Call the function to build an Action and schedule it.
    this.gm.multipleDestinationsMoveCreatures(destinationPaths, creatureIds);

    this.stopMultiCreatureMove();
    this.clearSelection();

    // Clear the rendered visualized paths over the tiles.
    this.clearPathVisualizations(creatureIds);
  }

  /*
  Function that should be called when selecting individual creature's destinations as part
  of a multi-creature move.
  */
  finishCurrentlySelectingCreatureForMove(destination: WorldCoord) {
    // If we are in the middle of planning a multi-creature move but
    // have not selected any creature, do nothing.
    const creatureId = this.uiState.creatureMovementData.multiMoveCurrentlySelectedCreatureId;
    if (!creatureId) return;

    // If the path for the destination tile (under the cursor) is not computed or is inaccessible,
    // do nothing and let the player select other destinations.
    if (!this.currentlyComputedMovementPath) return;
    if (this.currentlyComputedMovementPath.type === MovementPathType.INACCESSIBLE) return;

    this.uiState.setDestinationForCreatureInMultiCreatureMove(creatureId, destination);
    this.uiState.resetCurrentlySelectingCreatureId();

    // Render a visualized path over the tiles.
    this.unitMoveManager.setPlannedDestination(creatureId, destination);
  }

  /*
  Function to handle any state when selecting creatures and there is unrelated input.
  */
  handleUnrelatedInputWhenMovingCreatures(handledInput: string) {
    if (handledInput === "executeAction") {
      if (this.isCurrentlyPlanningMultiCreatureMove()) {
        this.clearSelection();
      }
      this.clearGraphics();
    }
  }

  /// Functions for clearing any state.

  private deactivateCursor() {
    this.cursor.resetCursorSelector();
    this.cursor.resetColorSelector();
    this.cursor.onCoordChange = undefined;
  }

  clearCreatureSelection() {
    if (this.isCurrentlyPlanningMultiCreatureMove()) {
      this.clearPathVisualizations(this.getCurrentlySelectedOwnCreatures());
    }

    this.clearGraphics();
    this.deactivateCursor();
    this.selection.clearCreatures();
    this.selectedRegion = undefined;
    this.selectedOwnCreatures = false;
    this.uiState.setCreatureData({ selectedCreatureIds: [], creaturesInHoverRegion: [] });
    this.uiState.clearCreatureMovementData();
  }

  clearSelection() {
    clearCoordSelection(this.selection);
    this.clearCreatureSelection();
  }

  private clearPathVisualizations(creatureIds: string[]) {
    for (const id of creatureIds) {
      this.unitMoveManager.deletePlannedPath(id);
    }
  }

  private clearGraphics() {
    for (const creatureId of Array.from(this.selection.selectedCreatureIds.values())) {
      this.creatureManager.unmarkCreature(creatureId);
    }
    this.mask.clear();
  }
}
