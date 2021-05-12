import { Action } from "./Action";
import { ActionState } from "../../../_types/GlobalTypes";
import { ActionType, WorldCoord, TxType, Tile } from "../../../_types/GlobalTypes";
import { v4 } from "uuid";
import { ActionCreator } from "./types";
import { bfs, checkInRange, tileCoordToRegionCoord } from "../../Utils/Utils";
import { getActionId } from "../../Utils/Ids";
import { actionEvents } from "./events";
import { packCoordList } from "../../Utils/PackedCoords";

interface CreateUnwallTileActionData {
  type: ActionType;
  coord: WorldCoord;
  requirement?: () => boolean;
}

export const createUnwallTileAction: ActionCreator<CreateUnwallTileActionData, Action<WorldCoord[] | null>> = (
  { type, coord, requirement },
  { extendedDungeon: extendedDungeon, emit, txExecutor, net, movingAverages, player, constants }
) => {
  const actionId = getActionId(coord, type);

  const events = actionEvents[type] as
    | typeof actionEvents[ActionType.InitiateUnwallTile]
    | typeof actionEvents[ActionType.CompleteUnwallTile];

  const isTraversable = (tile?: Tile): boolean => !!tile && tile.isMined && (!tile.isWalled || tile.owner === player);

  // startRequirement: you can unwall a wall
  const startRequirement = (tile: WorldCoord) => {
    const t = extendedDungeon.getTileAt(tile);
    return t.isWalled;
  };
  // pathRequirement: all tiles need to be mined and unwalled
  const pathRequirement = (tile: WorldCoord) => {
    const t = extendedDungeon.getTileAt(tile);
    return isTraversable(t);
  };
  // endRequirement: you need to reach a region you control and the tile needs to be mined and unwalled
  const endRequirement = (tile: WorldCoord, path: WorldCoord[]) => {
    const t = extendedDungeon.getTileAt(tile);
    if (!isTraversable(t)) {
      return false;
    }

    const fromRegion = tileCoordToRegionCoord(tile);
    const { controller, disputed } = extendedDungeon.getRegionController(fromRegion);
    if (controller !== player || disputed) return false;
    return true;
  };

  const name = `Unwall (${type === ActionType.InitiateUnwallTile ? "Initiate" : "Complete"}) ${coord.x}/${coord.y}`;

  const action = new Action({
    id: actionId,
    type,
    name,
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
      if (requirement && !requirement()) {
        return null;
      }
      return bfs({
        start: coord,
        checkDiagonal: true,
        pathRequirement: (coord) => checkInRange(constants.MAX_X, constants.MAX_Y)(coord) && pathRequirement(coord),
        endRequirement,
        startRequirement,
      });
    },
    process: async (path) => {
      if (!path) throw new Error("No path given");
      emit && emit(events.started, coord);

      const packedPath = packCoordList(path);

      let submitStart: number;
      let confirmStart: number;

      const ethMethod = {
        [ActionType.InitiateUnwallTile]: net.contracts.dungeonFacet.initiateUnwallTile,
        [ActionType.CompleteUnwallTile]: net.contracts.dungeonFacet.completeUnwallTile,
      };

      const txType = {
        [ActionType.InitiateUnwallTile]: TxType.InitiateUnwallTile,
        [ActionType.CompleteUnwallTile]: TxType.CompleteUnwallTile,
      };

      const { submitted, confirmed } = txExecutor.makeRequest({
        txId: v4(),
        actionId,
        onBalanceTooLow: () => net.getFunds(),
        genTransaction: async (nonce, _) => {
          return ethMethod[type](packedPath, {
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
