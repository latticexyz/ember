import { Action } from "./Action";
import { ActionState } from "../../../_types/GlobalTypes";
import { ActionType, WorldCoord, TxType, Tile } from "../../../_types/GlobalTypes";
import { v4 } from "uuid";
import { ActionCreator } from "./types";
import { Resource } from "../../../_types/ContractTypes";
import { bfs, checkInRange, tileCoordToRegionCoord } from "../../Utils/Utils";
import { getActionId } from "../../Utils/Ids";
import { actionEvents } from "./events";
import { packCoordList } from "../../Utils/PackedCoords";
import { BigNumber } from "ethers";

interface CreateForceMineTileActionData {
  type: ActionType;
  coord: WorldCoord;
  requirement?: () => boolean;
}

export const createForceMineTileAction: ActionCreator<CreateForceMineTileActionData, Action<WorldCoord[] | null>> = (
  { type, coord, requirement },
  { extendedDungeon: extendedDungeon, emit, txExecutor, net, movingAverages, player, constants }
) => {
  const actionId = getActionId(coord, type);
  const events = actionEvents[type] as
    | typeof actionEvents[ActionType.InitiateForceMineTile]
    | typeof actionEvents[ActionType.CompleteForceMineTile];

  const isTraversable = (tile?: Tile): boolean => !!tile && tile.isMined && (!tile.isWalled || tile.owner === player);

  // startRequirement: you can force mine an unmined tile
  const startRequirement = (tile: WorldCoord) => {
    const t = extendedDungeon.getTileAt(tile);
    return !t.isMined;
  };
  // pathRequirement: all tiles need to be mined and not walled by another player
  const pathRequirement = (tile: WorldCoord) => {
    const t = extendedDungeon.getTileAt(tile);
    return isTraversable(t);
  };
  // endRequirement: you need to reach a region you control and the tile needs to be traversable
  const endRequirement = (tile: WorldCoord, _: WorldCoord[]) => {
    const t = extendedDungeon.getTileAt(tile);
    if (!isTraversable(t)) {
      return false;
    }
    const fromRegion = tileCoordToRegionCoord(tile);
    const { controller, disputed } = extendedDungeon.getRegionController(fromRegion);
    if (controller !== player || disputed) return false;
    return true;
  };

  const action = new Action({
    id: actionId,
    type,
    name: `Force mine (${
      type === ActionType.InitiateWallTile || type === ActionType.InitiateForceMineTile ? "Initiate" : "Complete"
    }) ${coord.x}/${coord.y}`,
    onStateChange: (state) => {
      if (!emit) return;
      if (state === ActionState.Queued) emit(events.scheduled, coord);
      if (state === ActionState.Cancelled) {
        // TODO: send transaction to remove the delayed action from the contract. Cancellation of delayed actions is deactivated on the client until then.
        // const delayedAction = extendedDungeon.getDelayedActionsAt(coord).find((d) => d.initiator === player);
        // delayedAction && extendedDungeon.removeDelayedAction(delayedAction);
        emit(events.cancelled, coord);
      }
    },
    requirement: () => {
      if (requirement && !requirement()) return null;

      return bfs({
        start: coord,
        checkDiagonal: true,
        pathRequirement: (coord) => checkInRange(constants.MAX_X, constants.MAX_Y)(coord) && pathRequirement(coord),
        endRequirement,
        startRequirement,
      });
    },
    process: async (path: WorldCoord[]) => {
      // Check for resources at the current tile
      const isGoldResource = extendedDungeon.isGoldResource(coord);
      const isSoulResource = extendedDungeon.isSoulResource(coord);
      const isResource = isGoldResource || isSoulResource;
      emit && emit(events.started, coord);

      const resourceType = isGoldResource ? Resource.GOLD : isSoulResource ? Resource.SOULS : null;

      let submitStart: number;
      let confirmStart: number;

      const txType = {
        [ActionType.InitiateForceMineTile]: TxType.InitiateForceMineTile,
        [ActionType.CompleteForceMineTile]: TxType.CompleteForceMineTile,
      };

      const packedPath = packCoordList(path);

      const { submitted, confirmed } = txExecutor.makeRequest({
        txId: v4(),
        actionId,
        onBalanceTooLow: () => net.getFunds(),
        genTransaction: async (nonce, _) => {
          return type === ActionType.CompleteForceMineTile
            ? isResource
              ? net.contracts.dungeonFacet.completeForceMineResourceTile(
                  BigNumber.from(resourceType),
                  packCoordList(path),
                  {
                    nonce,
                    ...net.ethersOverrides,
                    ...net.ethersOverridesPerTxType[txType[type]],
                  }
                )
              : net.contracts.dungeonFacet.completeForceMineTile(packedPath, {
                  nonce,
                  ...net.ethersOverrides,
                  ...net.ethersOverridesPerTxType[txType[type]],
                })
            : net.contracts.dungeonFacet.initiateForceMineTile(packedPath, {
                nonce,
                ...net.ethersOverrides,
                ...net.ethersOverridesPerTxType[txType[type]],
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
          emit && emit(events.txConfirmed, coord);
          movingAverages.txConfirm.addStat(confirmDuration);
        },
      });

      try {
        await submitted;
        const receipt = await confirmed;
        if (receipt.status === 0) {
          throw new Error("Reverted");
        }
      } catch (e) {
        emit && emit(events.failed, coord);
        // Rethrow the error to catch it again in the action queue
        throw e;
      }
    },
  });
  return action;
};
