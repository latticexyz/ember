import { ActionContext } from "../ActionContext";
import { PlayerStatus, WorldCoord } from "../../../_types/GlobalTypes";
import { Assertion } from "./types";
import { TileDelayedActionType, TileUpgrade } from "../../../_types/ContractTypes";

export function playerIsWhitelisted(context: ActionContext): Assertion {
  return {
    check: () => context.playerStatus === PlayerStatus.WHITELISTED,
    errorMessage: "the player cannot be initialized now",
  };
}

export function playerIsInitialized(context: ActionContext): Assertion {
  return {
    check: () => context.playerStatus === PlayerStatus.INITIALIZED,
    errorMessage: "the player has not been initialized yet",
  };
}

export function tileIsMined(tileCoord: WorldCoord, context: ActionContext): Assertion {
  return {
    check: () => {
      const tile = context.extendedDungeon.getTileAt(tileCoord);
      return tile.isMined;
    },
    errorMessage: "tile is not mined yet",
  };
}

export function tileIsWalled(tileCoord: WorldCoord, context: ActionContext): Assertion {
  return {
    check: () => {
      const tile = context.extendedDungeon.getTileAt(tileCoord);
      return tile.isWalled;
    },
    errorMessage: "tile is not walled yet",
  };
}

export function tileIsUnmined(tileCoord: WorldCoord, context: ActionContext): Assertion {
  return {
    check: () => {
      const tile = context.extendedDungeon.getTileAt(tileCoord);
      return !tile.isMined;
    },
    errorMessage: "tile is already mined",
  };
}

export function regionIsMined(regionCoord: WorldCoord, context: ActionContext): Assertion {
  return {
    check: () => {
      const region = context.extendedDungeon.getRegionAt(regionCoord);
      return region.isMined;
    },
    errorMessage: "region is not mined yet",
  };
}

export function playerControlsRegion(regionCoord: WorldCoord, context: ActionContext): Assertion {
  return {
    check: () => {
      const { controller, disputed } = context.extendedDungeon.getRegionController(regionCoord);
      return controller === context.player && !disputed;
    },
    errorMessage: "player does not control the region",
  };
}

export function tileIsOwnedByPlayer(tileCoord: WorldCoord, context: ActionContext): Assertion {
  return {
    check: () => {
      const tile = context.extendedDungeon.getTileAt(tileCoord);
      return tile.owner === context.player;
    },
    errorMessage: "player does not own this tile",
  };
}

export function tileHasAnyUpgrade(tileCoord: WorldCoord, context: ActionContext): Assertion {
  return {
    check: () => {
      const tile = context.extendedDungeon.getTileAt(tileCoord);
      return tile.upgrade !== TileUpgrade.NONE;
    },
    errorMessage: `tile has no upgrade`,
  };
}

export function tileHasUpgrade(tileCoord: WorldCoord, tileUpgrade: TileUpgrade, context: ActionContext): Assertion {
  return {
    check: () => {
      const tile = context.extendedDungeon.getTileAt(tileCoord);
      return tile.upgrade === tileUpgrade;
    },
    errorMessage: `tile does not have the correct upgrade. Expected: ${tileUpgrade}`,
  };
}

export function tileHasNoUpgrade(tileCoord: WorldCoord, context: ActionContext): Assertion {
  return {
    check: () => {
      const tile = context.extendedDungeon.getTileAt(tileCoord);
      return tile.upgrade === TileUpgrade.NONE;
    },
    errorMessage: `tile is upgraded`,
  };
}

export function tileIsNotOwnedByPlayer(tileCoord: WorldCoord, context: ActionContext): Assertion {
  return {
    check: () => {
      const tile = context.extendedDungeon.getTileAt(tileCoord);
      return tile.owner !== context.player;
    },
    errorMessage: "player already owns this tile",
  };
}

export function noDelayedActionOnTile(
  coord: WorldCoord,
  type: TileDelayedActionType,
  context: ActionContext
): Assertion {
  return {
    check: () => {
      // make sure there is no delayedAction already on this tile with same type and same initiator
      const currentDelayedActions = context.extendedDungeon.getDelayedActionsAt(coord);

      return !(
        currentDelayedActions.filter(
          (d) =>
            d.initiator === context.player &&
            d.delayedActionType === type &&
            context.net.predictedChainTime - d.submittedTimestamp <
              context.constants.gameConstants.SECONDS_UNTIL_EXPIRED_DELAYED_ACTION
        ).length > 0
      );
    },
    errorMessage: `there already is a delayed action on this tile: ${coord}`,
  };
}
