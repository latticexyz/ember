import { Creature } from "../../../../../_types/GlobalTypes";
import { CreatureType } from "../../../../../_types/ContractTypes";
import { GameConstants } from "../../../../../Backend/Game/Constants";

export function getCreatureGroupBoost(creatures: Creature[], constants: GameConstants) {
  const count = {
    [CreatureType.NORMAL]: 0,
    [CreatureType.RED]: 0,
    [CreatureType.BLUE]: 0,
    [CreatureType.BLACK]: 0,
    [CreatureType.UNIQUE]: 0,
  };

  for (const creature of creatures) {
    count[creature.creatureType]++;
  }

  const countToTier = (n: number) => {
    if (n <= 1) {
      return 0;
    }
    if (n <= 3) {
      return 1;
    }
    if (n <= 5) {
      return 2;
    }
    if (n <= 7) {
      return 3;
    }
    return 4;
  };

  const boosts = creatures.map((creature) => {
    const tier = countToTier(count[creature.creatureType]);
    return constants.CREATURES_GROUP_MULTIPLIERS[tier] / 100;
  });

  return boosts;
}
