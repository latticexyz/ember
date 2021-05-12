import { InteractData, InteractType } from "../../../../UIManager";
import { ItemType, DetailListItem } from "../../../Common/DetailsList";
import GameManager from "../../../../../Backend/Game/GameManager";
import { TileUpgrade } from "../../../../../_types/ContractTypes";
import { InfoModalProps } from "../../../Common/InfoModal";
import { tileCoordToRegionCoord } from "../../../../../Backend/Utils/Utils";

export function getLairDetailsAndActions(data: InteractData & { type: InteractType.Upgrade }): {
  details: DetailListItem[];
  hiddenDetails: DetailListItem[];
  actions: InfoModalProps["actions"];
} {
  const gm = GameManager.getInstance();
  const gameConstants = gm.constants.gameConstants;
  const cap = gameConstants.TILE_UPGRADE_MAX_HARVEST[TileUpgrade.LAIR];
  if (data.subtype !== TileUpgrade.LAIR) {
    throw new Error("Not a lair");
  }

  const { selectedCoords } = data;
  const regionCoord = tileCoordToRegionCoord(selectedCoords[0]);
  const { controller, disputed } = gm.extendedDungeon.getRegionController(regionCoord);
  const groupBoost = gm.extendedDungeon.getHarvestBoost(selectedCoords);
  const harvestable = gm.extendedDungeon.getHarvestableAmount(selectedCoords, TileUpgrade.LAIR);
  const totalHarvestable = Array.from(harvestable.values()).reduce<number>((acc, curr) => {
    return acc + curr.individual + curr.boost;
  }, 0);

  const secondsForHarvest = gm.constants.gameConstants.TILE_UPGRADE_NUMBER_OF_SECONDS_FOR_ONE_HARVEST[TileUpgrade.LAIR];

  let harvestableDetails: DetailListItem[] = [];

  harvestable.toArray().forEach(([coord, { individual, boost, capped }]) => {
    const value = capped ? `${individual} (capped)` : `${individual}+${boost}`;
    const harvestableAmount = {
      title: `Lair (${coord.x},${coord.y})`,
      type: ItemType.Detail,
      value,
      withChainTimeUpdate: true,
    };

    harvestableDetails = [...harvestableDetails, harvestableAmount];
  });
  const popIncrease = gameConstants.POPULATION_PER_LAIR * data.selectedCoords.length;
  return {
    details: [
      {
        type: ItemType.Headline,
        title: "Healing creatures in region",
      },
      {
        title: "Count",
        value: selectedCoords.length,
        type: ItemType.Detail,
      },
      { title: "Group boost", value: `${groupBoost}%`, type: ItemType.Detail },
      { title: "Heal available", value: totalHarvestable, type: ItemType.Detail, withChainTimeUpdate: true },
      {
        type: ItemType.Headline,
        title: "Population limit increase",
      },
      {
        type: ItemType.Text,
        value: `${
          data.selectedCoords.length > 1 ? "These lairs increase" : "A lair increases"
        } your population limit by ${popIncrease} creature${popIncrease > 1 ? "s" : ""}.`,
      },
    ],
    hiddenDetails: [
      { title: "Healing details", type: ItemType.Headline },
      { title: "Seconds to generate 1 life point", value: `${secondsForHarvest}s`, type: ItemType.Detail },
      { title: "Max heal per tile", value: `${cap}`, type: ItemType.Detail },
      ...harvestableDetails,
    ],
    actions:
      controller === gm.address && !disputed && gm.extendedDungeon.getTileAt(selectedCoords[0]).owner === gm.address
        ? [
            {
              title: "Heal creatures in region",
              onClick: () => {
                const coordArray = selectedCoords.map((coord) => ({ ...coord }));
                // console.log(coordArray);
                gm.harvestTiles(coordArray);
              },
            },
          ]
        : [],
  };
}
