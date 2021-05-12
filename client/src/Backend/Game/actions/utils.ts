import { Resource } from "../../../_types/ContractTypes";
import { WorldCoord } from "../../../_types/GlobalTypes";
import { ActionContextInterface } from "../ActionContext";
import { Assertion } from "./types";
import anylogger from "anylogger";

const log = anylogger("assertions");

export function optimisticallyIncreaseResourceOfPlayerInRegion(
  amount: number,
  resource: Resource,
  regionCoord: WorldCoord,
  context: ActionContextInterface
) {
  const player = context.extendedDungeon.players.get(context.player);
  if (!player) return;
  if (resource === Resource.GOLD) {
    const maxAmount = player.maxGold - player.gold;
    const amountIncreased = Math.min(maxAmount, amount);
    const remainingAmount = amount - amountIncreased;
    context.extendedDungeon.increaseGold(context.player, amountIncreased);
    if (remainingAmount > 0) {
      const region = context.extendedDungeon.getRegionAt(regionCoord);
      if (region) {
        context.extendedDungeon.setRegion(regionCoord, {
          ...region,
          gold: region.gold + remainingAmount,
        });
      }
    }
  } else if (resource === Resource.SOULS) {
    const maxAmount = player.maxSouls - player.souls;
    // TODO: cap with the ground resources. Actually it should be capped already? weird bug
    const amountIncreased = Math.min(maxAmount, amount);
    const remainingAmount = amount - amountIncreased;
    context.extendedDungeon.increaseSouls(context.player, amountIncreased);
    if (remainingAmount > 0) {
      const region = context.extendedDungeon.getRegionAt(regionCoord);
      if (region) {
        context.extendedDungeon.setRegion(regionCoord, {
          ...region,
          souls: region.souls + remainingAmount,
        });
      }
    }
  }
}

export const assert = (assertions: Assertion[]): { pass: boolean; error?: string } => {
  for (const assertion of assertions) {
    if (!assertion.check()) {
      log.info("Assertion error:", assertion.errorMessage);
      return { pass: false, error: assertion.errorMessage };
    }
  }
  return { pass: true };
};
