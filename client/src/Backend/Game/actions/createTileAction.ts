import { Action } from "./Action";
import { ActionState, ResourceType, Tile } from "../../../_types/GlobalTypes";
import { ActionType, WorldCoord, TxType } from "../../../_types/GlobalTypes";
import { ActionTypeToContractActionType, bfs, checkInRange, tileCoordToRegionCoord } from "../../Utils/Utils";
import { v4 } from "uuid";
import { ActionCreator } from "./types";
import { getAdjacentCoords } from "../../Utils/WorldCoords";
import { actionEvents } from "./events";
import { packCoordList } from "../../Utils/PackedCoords";
import { CreatureSpecies, Resource } from "../../../_types/ContractTypes";
import { BigNumber } from "ethers";
import { CheckedTypeUtils } from "../../Utils/CheckedTypeUtils";
import { worldCoordsEq } from "../../../Renderer/utils/worldCoords";
import { ActionType as ContractActionType } from "../../../_types/ContractTypes";

interface CreateTileActionData {
  actionId: string;
  type: ActionType;
  name: string;
  coord: WorldCoord;
  requirement: () => boolean;
  skip?: () => boolean;
}

export const createTileAction: ActionCreator<CreateTileActionData, Action<WorldCoord[] | null>> = (
  { actionId, type, name, coord, requirement, skip },
  { extendedDungeon: extendedDungeon, constants, emit, txExecutor, net, movingAverages, player }
) => {
  const events = actionEvents[type] as typeof actionEvents[ActionType.MineTile];

  const manaCost = constants.gameConstants.MANA_PER_ACTION_TYPE[ContractActionType.MINE];

  const isTraversable = (tile?: Tile): boolean => !!tile && tile.isMined && (!tile.isWalled || tile.owner === player);

  // pathRequirement: all tiles need to be mined and not walled by another player
  const pathRequirement = (tile: WorldCoord) => {
    const t = extendedDungeon.getTileAt(tile);
    return isTraversable(t);
  };

  const endRequirement = (tile: WorldCoord, path: WorldCoord[]) => {
    const t = extendedDungeon.getTileAt(tile);
    if (!isTraversable(t)) {
      return false;
    }
    const fromRegion = tileCoordToRegionCoord(tile);
    const { controller, disputed } = extendedDungeon.getRegionController(fromRegion);
    if (controller !== player || disputed) return false;
    const creatures = extendedDungeon.getCreaturesInRegion(fromRegion);
    for (const c of creatures) {
      if (c.species === CreatureSpecies.HERO && worldCoordsEq(c.tileCoord, tile)) {
        return true;
      }
    }
    return false;
  };

  // startRequirement: you can only mine/claim in regions that are either uncontrolled or controlled by you
  const startRequirement = (tile: WorldCoord) => {
    const regionCoords = tileCoordToRegionCoord(tile);
    const { controller, disputed } = extendedDungeon.getRegionController(regionCoords);
    return (controller === player && !disputed) || controller === CheckedTypeUtils.EMPTY_ADDRESS;
  };

  const action = new Action({
    id: actionId,
    type,
    name,
    costByResource: {
      [ResourceType.Mana]: manaCost,
    },
    onStateChange: (state) => {
      if (!emit) return;
      if (state === ActionState.Queued) emit(events.scheduled, coord);
      if (state === ActionState.Cancelled) emit(events.cancelled, coord);
    },
    skip,
    requirement: () => {
      if (!requirement()) return null;
      if (type === ActionType.MineTile) {
        // Pre-dependency
        const adjacentTiles = getAdjacentCoords(coord).filter(checkInRange(constants.MAX_X, constants.MAX_Y));

        const minedNeighborExists = adjacentTiles.findIndex((coord) => extendedDungeon.getTileAt(coord).isMined) > -1;

        if (!minedNeighborExists) return null;
      }

      const manaBalance = extendedDungeon.players.get(player)?.mana;

      if (manaBalance != null && manaBalance < manaCost) {
        return null;
      }

      // Actual dependency
      return bfs({
        start: coord,
        checkDiagonal: true,
        pathRequirement: (coord) => checkInRange(constants.MAX_X, constants.MAX_Y)(coord) && pathRequirement(coord),
        endRequirement,
        startRequirement,
      });
    },
    process: async (path) => {
      if (!path) throw new Error("Process called without a path");

      // Check for resources at the current tile
      const isGoldResource = extendedDungeon.isGoldResource(coord);
      const isSoulResource = extendedDungeon.isSoulResource(coord);
      const isResource = isGoldResource || isSoulResource;
      emit && emit(events.started, coord);

      const resourceType = isGoldResource ? Resource.GOLD : isSoulResource ? Resource.SOULS : null;

      let submitStart: number;
      let confirmStart: number;

      const { submitted, confirmed } = txExecutor.makeRequest({
        txId: v4(),
        actionId,
        onBalanceTooLow: () => net.getFunds(),
        genTransaction: async (nonce, _) => {
          const ethMethod = {
            [ActionType.MineTile]: isResource
              ? net.contracts.dungeonFacet.mineResourceTile
              : net.contracts.dungeonFacet.mineTile,
          };

          return isResource && type === ActionType.MineTile
            ? net.contracts.dungeonFacet.mineResourceTile(BigNumber.from(resourceType), packCoordList(path), {
              nonce,
              ...net.ethersOverrides,
              ...net.ethersOverridesPerTxType[TxType.MineResourceTile],
            })
            : ethMethod[type](packCoordList(path), {
              nonce,
              ...net.ethersOverrides,
              ...net.ethersOverridesPerTxType[type],
            });
        },
        onSubmitting: () => {
          submitStart = Date.now();
          emit && emit(events.txSubmitting, coord);
          action.setProgress(0.33);
        },
        onSubmitted: () => {
          const submitDuration = Date.now() - submitStart;
          emit && emit(events.txSubmitted, coord);
          movingAverages.txSubmit.addStat(submitDuration);
          confirmStart = Date.now();
          action.setProgress(0.66);
        },
        onConfirmed: () => {
          const confirmDuration = Date.now() - confirmStart;
          movingAverages.txConfirm.addStat(confirmDuration);
        },
      });

      try {
        await submitted;
        const receipt = await confirmed;
        if (receipt.status === 0) {
          throw new Error("Reverted");
        }
        extendedDungeon.chargeManaForAction(player, manaCost);
        await net.waitForAllTransactionLogsToBeHandled(receipt.transactionHash);
        emit && emit(events.txConfirmed, coord);
      } catch (e) {
        emit && emit(events.failed, coord);
        // Rethrow the error to catch it again in the action queue
        throw e;
      }
    },
  });
  return action;
};
