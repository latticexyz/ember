import { GameConstants } from "../../../../../Backend/Game/Constants";
import { creatureTypeToName } from "../../../../../Backend/Game/Naming";
import { CreatureSpecies, CreatureType } from "../../../../../_types/ContractTypes";

export function getCreatureEffect(
  creature: { creatureType: CreatureType; species: CreatureSpecies },
  constants: GameConstants
): string | null {
  const strongAgainst = constants.CREATURES_TYPE_STRENGTH_AGAINST_TYPE[creature.creatureType];

  let effectString = "";

  strongAgainst.forEach((strength, type) => {
    if (strength > 0) {
      const typeName = creatureTypeToName[type];
      effectString += `${strength}% attack boost against ${typeName} creatures. `;
    }
  });

  return effectString === "" ? null : effectString;
}
