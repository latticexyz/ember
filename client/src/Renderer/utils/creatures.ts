import { Creature } from "../../_types/GlobalTypes";
import { CreatureType, CreatureStat, CreatureSpecies } from "../../_types/ContractTypes";
import GameManager from "../../Backend/Game/GameManager";
import { SpriteName } from "../constants";

export function getMaxLifeOfCreature(c: Creature) {
  const constants = GameManager.getInstance().constants;
  const isUnique = c.creatureType === CreatureType.UNIQUE;
  return (
    constants.gameConstants.CREATURES_BASE_STAT_PER_SPECIES[c.species][CreatureStat.LIFE][c.level] *
    (isUnique ? constants.gameConstants.CREATURES_UNIQUE_STAT_MULTIPLIER : 1)
  );
}

export const creatureToSprite = {
  [CreatureSpecies.BALANCED]: {
    [CreatureType.NORMAL]: SpriteName.BalancedNormal,
    [CreatureType.BLUE]: SpriteName.BalancedBlue,
    [CreatureType.RED]: SpriteName.BalancedRed,
    [CreatureType.BLACK]: SpriteName.BalancedBlack,
    [CreatureType.UNIQUE]: SpriteName.BalancedUnique,
  },
  [CreatureSpecies.HERO]: {
    [CreatureType.NORMAL]: SpriteName.Hero,
    [CreatureType.BLUE]: SpriteName.Hero,
    [CreatureType.RED]: SpriteName.Hero,
    [CreatureType.BLACK]: SpriteName.Hero,
    [CreatureType.UNIQUE]: SpriteName.Hero,
  },
};
