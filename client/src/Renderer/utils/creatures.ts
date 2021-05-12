import { Creature } from "../../_types/GlobalTypes";
import { CreatureType, CreatureStat, CreatureSpecies } from "../../_types/ContractTypes";
import GameManager from "../../Backend/Game/GameManager";

export function getMaxLifeOfCreature(c: Creature) {
  const constants = GameManager.getInstance().constants;
  const isUnique = c.creatureType === CreatureType.UNIQUE;
  return (
    constants.gameConstants.CREATURES_BASE_STAT_PER_SPECIES[c.species][CreatureStat.LIFE] *
    (isUnique ? constants.gameConstants.CREATURES_UNIQUE_STAT_MULTIPLIER : 1)
  );
}

export const creatureToSprite = {
  [CreatureSpecies.BALANCED]: {
    [CreatureType.NORMAL]: "skeleton",
    [CreatureType.BLUE]: "ice-skeleton",
    [CreatureType.RED]: "fire-skeleton",
    [CreatureType.BLACK]: "demon-skeleton",
    [CreatureType.UNIQUE]: "beholder",
  },
};
