import { CreatureSpecies, CreatureType } from "../../../../_types/ContractTypes";
import { spritesheets } from "../../../../Assets/spritesheets";
// NOTE: those are sprites for the React Renderer
export const creatureToReactSpritesheet = {
  [CreatureSpecies.BALANCED]: {
    [CreatureType.NORMAL]: spritesheets.skeleton2,
    [CreatureType.RED]: spritesheets.fire2,
    [CreatureType.BLUE]: spritesheets.ice2,
    [CreatureType.BLACK]: spritesheets.demon2,
    [CreatureType.UNIQUE]: spritesheets.legendary,
  },
  [CreatureSpecies.HERO]: {
    [CreatureType.NORMAL]: spritesheets.hero,
    [CreatureType.RED]: spritesheets.hero,
    [CreatureType.BLUE]: spritesheets.hero,
    [CreatureType.BLACK]: spritesheets.hero,
    [CreatureType.UNIQUE]: spritesheets.hero,
  },
};
