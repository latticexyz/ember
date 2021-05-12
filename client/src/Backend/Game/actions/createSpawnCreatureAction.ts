import { Action } from "./Action";
import { ActionState, ResourceType } from "../../../_types/GlobalTypes";
import { ActionType, WorldCoord, TxType } from "../../../_types/GlobalTypes";
import { v4 } from "uuid";
import { ActionCreator } from "./types";
import { CreatureSpecies, CreatureType, Resource, TileUpgrade } from "../../../_types/ContractTypes";
import { creatureSpeciesToName, creatureTypeToName } from "../Naming";
import { tileCoordToRegionCoord } from "../../Utils/Utils";
import { actionEvents } from "./events";
import { assert } from "./utils";
import { tileIsMined, tileIsOwnedByPlayer, tileHasUpgrade, playerControlsRegion } from "./assertions";
import { coordToId } from "../../Utils/PackedCoords";

interface SpawnCreatureData {
  coord: WorldCoord;
  creatureSpecies: CreatureSpecies;
  creatureType: CreatureType;
}

export const createSpawnCreatureAction: ActionCreator<SpawnCreatureData, Action<boolean | null>> = (
  { coord, creatureSpecies, creatureType },
  context
) => {
  const { extendedDungeon: extendedDungeon, emit, txExecutor, net, movingAverages, player, constants } = context;

  const actionId = v4();
  const events = actionEvents[ActionType.SpawnCreature];

  const action = new Action({
    id: actionId,
    type: ActionType.SpawnCreature,
    name: `Spawn ${creatureTypeToName[creatureType]} ${creatureSpeciesToName[creatureSpecies]} at ${coord.x}/${coord.y}`,
    costByResource: {
      [ResourceType.Gold]: constants.gameConstants.CREATURES_PRICE[creatureSpecies][creatureType][Resource.GOLD],
      [ResourceType.Soul]: constants.gameConstants.CREATURES_PRICE[creatureSpecies][creatureType][Resource.SOULS],
    },
    onStateChange: (state) => emit && state === ActionState.Queued && emit(events.scheduled, coord),
    requirement: () => {
      const { pass } = assert([
        tileIsMined(coord, context),
        tileIsOwnedByPlayer(coord, context),
        tileHasUpgrade(coord, TileUpgrade.DUNGEON_HEART, context),
        playerControlsRegion(tileCoordToRegionCoord(coord), context),
      ]);

      if (!pass) return false;

      const regionCoord = tileCoordToRegionCoord(coord);

      const { lastSpawnTimestamp, creatures } = extendedDungeon.regions.get(regionCoord)!;

      if (creatures.length >= 8) {
        return false;
      }

      const canSpawnTimestamp = lastSpawnTimestamp + constants.gameConstants.CREATURES_MIN_SECOND_DELAY_BETWEEN_SPAWN;

      if (net.predictedChainTime <= canSpawnTimestamp && net.chainTime < canSpawnTimestamp) {
        return false;
      }

      const playerData = extendedDungeon.players.get(player);
      if (!playerData) {
        return false;
      }

      if (playerData.population >= playerData.maxPopulation) {
        return false;
      }

      return true;
    },
    process: async () => {
      emit && emit(events.started, coord);

      const summonTileId = coordToId(coord);

      let submitStart: number;
      let confirmStart: number;

      const { submitted, confirmed } = txExecutor.makeRequest({
        txId: v4(),
        actionId,
        onBalanceTooLow: () => net.getFunds(),
        genTransaction: async (nonce, _) => {
          return net.contracts.creaturesFacet.spawnCreature(summonTileId, creatureSpecies, creatureType, {
            nonce,
            ...net.ethersOverrides,
            ...net.ethersOverridesPerTxType[TxType.SpawnCreature],
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

        // Optimistic Update

        const regionCoord = tileCoordToRegionCoord(coord);
        const region = extendedDungeon.regions.get(regionCoord)!;

        extendedDungeon.setRegion(regionCoord, { ...region, lastSpawnTimestamp: net.predictedChainTime });
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
