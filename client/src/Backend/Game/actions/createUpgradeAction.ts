import { Action } from "./Action";
import { ActionState, ResourceType } from "../../../_types/GlobalTypes";
import { ActionType, WorldCoord, TxType, UpgradeItem as UpgradeTool } from "../../../_types/GlobalTypes";
import { ActionTypeToContractActionType, tileCoordToRegionCoord } from "../../Utils/Utils";
import { v4 } from "uuid";
import { ActionCreator } from "./types";
import { TileUpgrade } from "../../../_types/ContractTypes";
import { getActionId } from "../../Utils/Ids";
import { assert } from "./utils";
import { tileIsMined, playerControlsRegion } from "./assertions";
import { actionEvents } from "./events";
import { coordToId } from "../../Utils/PackedCoords";

interface CreateTileUpgradeData {
  tool: UpgradeTool;
  coord: WorldCoord;
}

// We have this mapping because not all TileUpgrades are user-initiatable (eg DungeonHeart)
// TODO: share to other files
const upgradeToolToType: { [key in UpgradeTool]?: TileUpgrade } = {
  [UpgradeTool.GoldStorage]: TileUpgrade.GOLD_STORAGE,
  [UpgradeTool.GoldGenerator]: TileUpgrade.GOLD_GENERATOR,
  [UpgradeTool.SoulStorage]: TileUpgrade.SOUL_STORAGE,
  [UpgradeTool.SoulGenerator]: TileUpgrade.SOUL_GENERATOR,
  [UpgradeTool.Lair]: TileUpgrade.LAIR,
};

export const createUpgradeAction: ActionCreator<CreateTileUpgradeData, Action<boolean | null>> = (
  { tool, coord },
  context
) => {
  const { extendedDungeon, emit, txExecutor, net, movingAverages, player, constants } = context;
  const actionId = getActionId(coord, ActionType.UpgradeTile);
  const events = actionEvents[ActionType.UpgradeTile];

  const action = new Action({
    id: actionId,
    type: ActionType.UpgradeTile,
    name: `Upgrade ${tool} ${coord.x}/${coord.y}`,
    costByResource: {
      [ResourceType.Gold]: constants.gameConstants.TILE_UPGRADE_PRICES[upgradeToolToType[tool]!],
      [ResourceType.Mana]:
        constants.gameConstants.MANA_PER_ACTION_TYPE[ActionTypeToContractActionType[ActionType.UpgradeTile]],
    },
    onStateChange: (state) => {
      if (!emit) return;
      if (state === ActionState.Queued) emit(events.scheduled, coord);
      if (state === ActionState.Cancelled) emit(events.cancelled, coord);
    },
    requirement: async () => {
      const { pass } = assert([
        tileIsMined(coord, context),
        playerControlsRegion(tileCoordToRegionCoord(coord), context),
      ]);
      if (!pass) return false;

      const tile = extendedDungeon.getTileAt(coord);
      if (!tile.isMined || tile.owner !== player || tile.upgrade !== TileUpgrade.NONE) {
        return false;
      }

      return true;
    },
    process: async () => {
      emit && emit(events.started, coord);

      const tileId = coordToId(coord);
      const upgrade = upgradeToolToType[tool]!;

      let submitStart: number;
      let confirmStart: number;

      const { submitted, confirmed } = txExecutor.makeRequest({
        txId: v4(),
        actionId,
        onBalanceTooLow: () => net.getFunds(),
        genTransaction: async (nonce, _) => {
          if (!tileId) {
            throw new Error("Tile does not exist in Unobfuscated Dungeon");
          }

          if (!upgrade) {
            throw new Error("Unknown upgrade");
          }

          return net.contracts.dungeonFacet.upgradeTile(tileId, upgrade, {
            nonce,
            ...net.ethersOverrides,
            ...net.ethersOverridesPerTxType[TxType.UpgradeTile],
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
