import { v4 } from "uuid";
import { Action } from "./Action";
import { ActionState } from "../../../_types/GlobalTypes";
import { ActionType, WorldCoord, TxType } from "../../../_types/GlobalTypes";
import { ActionCreator } from "./types";
import { actionEvents } from "./events";
import { getActionIdFromCreatureIds } from "../../Utils/Ids";
import { getPathToDestinationTile, MovementPath, MovementPathType, tileCoordToRegionCoord } from "../../Utils/Utils";
import { packCoordList } from "../../Utils/PackedCoords";
import { NotificationManager, NotificationType } from "../../../Frontend/NotificationManager"
import { worldCoordsEq } from "../../../Renderer/utils/worldCoords";
import { UIManager } from "../../../Frontend/UIManager";

interface MoveCreaturesActionData {
  creatureIds: string[];
  destinationRegion: WorldCoord;
  destinationTile: WorldCoord | undefined;
  startRegion: WorldCoord;
}

export const createMoveCreaturesAction: ActionCreator<MoveCreaturesActionData, Action<MovementPath | null>> = (
  { creatureIds, destinationRegion, destinationTile, startRegion },
  {
    extendedDungeon: extendedDungeon,
    constants,
    emit,
    txExecutor,
    net,
    movingAverages,
    player,
  }
) => {

  // The action identifier has to include the destination region in order to be able to schedule chained 
  // moves for meta-moves. 
  const actionId = `creatures(${getActionIdFromCreatureIds(creatureIds)})` + `->region(${destinationRegion.x},${destinationRegion.y})${destinationTile ? `->tile(${destinationTile.x},${destinationTile.y})` : ''}`;
  const events = actionEvents[ActionType.MoveCreatures];

  const destinationTileDescription = destinationTile ? `, tile (${destinationTile.x},${destinationTile.y})` : '';
  const actionDescription = `Move creature${creatureIds.length > 1 ? 's' : ''} to region (${destinationRegion.x},${destinationRegion.y})${destinationTileDescription}`;

  // This action's requirement has a time limit, after which we consider the requirement not
  // fullfilled and return a specific value to indicate to process() that this happened.
  let hasActionRequirementTimedOut: boolean = false;
  const action = new Action({
    id: actionId,
    type: ActionType.MoveCreatures,
    name: actionDescription,
    onStateChange: (state) => {
      if (!emit) return;
      if (state === ActionState.Queued) emit(events.scheduled, creatureIds, destinationTile);
      if (state === ActionState.Cancelled) emit(events.cancelled, creatureIds);
    },
    requirement: () => {
      // Pick any creature being moved.
      const creature = extendedDungeon.creatures.get(creatureIds[0]);
      if (!creature) return null;
      const currentCreatureRegion = tileCoordToRegionCoord(creature.tileCoord);

      // Check if regions are not matching, i.e. the move expects the creature to be in a certain
      // location but it is not yet there.
      if (!worldCoordsEq(startRegion, currentCreatureRegion)) {
        return null;
      }

      const actionRequirementTimer: ReturnType<typeof setTimeout> = setTimeout(() => {
        hasActionRequirementTimedOut = true;
        // This will cancel the action and also signal that we need to re-process the queue
        // and clean up by calling process(), which will be available.
        emit && emit(events.failed, creatureIds);
      }, 5000);

      if (hasActionRequirementTimedOut) {
        return {
          path: [],
          type: MovementPathType.INACCESSIBLE
        };
      }

      try {
        let { path } =
          getPathToDestinationTile({
            creatureIds,
            destinationRegion,
            destinationTile,
            pathLimit: 64,
            extendedDungeon: extendedDungeon,
            playerAddress: player,
            regionLimit: constants.gameConstants.CREATURES_MAX_REGION_DISTANCE_FOR_MOVE,
          }) || {};

        if (path) {
          clearTimeout(actionRequirementTimer);
          return {
            path: path,
            type: MovementPathType.SHORT
          };
        } else {
          return null;
        }
      } catch (e) {
        return null;
      }
    },

    process: async (movementPath: MovementPath) => {
      // If the path there is inaccessible, that means the move did not complete the requirement in
      // time, so we should let the player know.
      if (movementPath.type === MovementPathType.INACCESSIBLE) {
        const notificationManager = UIManager.getInstance().services.notificationManager;

        const optionalTileInfo = destinationTile ? `, tile (${destinationTile.x}, ${destinationTile.y})` : '';
        const notificationMessage = `Creature move interrupted - currently no path to region (${destinationRegion.x}, ${destinationRegion.y})${optionalTileInfo}`;
        notificationManager.notify(notificationMessage, destinationTile, NotificationType.Warning);
        return;
      }

      const path = movementPath.path;
      const packedPath = packCoordList(path);
      emit && emit(events.started);

      let submitStart: number;
      let confirmStart: number;

      const { submitted, confirmed } = txExecutor.makeRequest({
        txId: v4(),
        actionId,
        onBalanceTooLow: () => net.getFunds(),
        genTransaction: async (nonce, _) => {
          return net.contracts.creaturesFacet.moveCreatures(packedPath, creatureIds, {
            nonce,
            ...net.ethersOverrides,
            ...net.ethersOverridesPerTxType[TxType.MoveCreatures],
          });
        },
        onSubmitting: () => {
          submitStart = Date.now();
          emit && emit(events.txSubmitting);
          action.setProgress(0.33);
        },
        onSubmitted: () => {
          const submitDuration = Date.now() - submitStart;
          emit && emit(events.txSubmitted);
          movingAverages.txSubmit.addStat(submitDuration);
          confirmStart = Date.now();
          action.setProgress(0.66);
        },
        onConfirmed: () => {
          const confirmDuration = Date.now() - confirmStart;
          emit && emit(events.txConfirmed);
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
        emit && emit(events.failed, creatureIds);
        // Rethrow the error to catch it again in the action queue
        throw e;
      }
    },
  });
  return action;
};
