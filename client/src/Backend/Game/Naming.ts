import { CreatureSpecies, CreatureType } from "../../_types/ContractTypes";

export const creatureSpeciesToName = {
  [CreatureSpecies.BALANCED]: "Servant",
  [CreatureSpecies.HERO]: "Hero",
};

export const creatureTypeToName = {
  [CreatureType.NORMAL]: "Regular",
  [CreatureType.BLUE]: "Ice",
  [CreatureType.RED]: "Fire",
  [CreatureType.BLACK]: "Demon",
  [CreatureType.UNIQUE]: "Legendary",
};
