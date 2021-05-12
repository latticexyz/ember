import { CreatureSpecies, CreatureType } from "../../../../_types/ContractTypes";
import { spritesheets } from "../../../../Assets/spritesheets";

export const creatureToSpritesheet = {
  [CreatureSpecies.BALANCED]: {
    [CreatureType.NORMAL]: spritesheets.skeleton2,
    [CreatureType.RED]: spritesheets.fire2,
    [CreatureType.BLUE]: spritesheets.ice2,
    [CreatureType.BLACK]: spritesheets.demon2,
    [CreatureType.UNIQUE]: spritesheets.legendary,
  },
};
