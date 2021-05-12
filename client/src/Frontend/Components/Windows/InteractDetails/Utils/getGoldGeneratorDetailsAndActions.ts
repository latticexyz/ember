import React from "react";
import { DetailListItem, ItemType } from "../../../Common/DetailsList";
import { InfoModalProps } from "../../../Common/InfoModal";
import { TileUpgrade } from "../../../../../_types/ContractTypes";
import GameManager from "../../../../../Backend/Game/GameManager";
import { InteractData, InteractType } from "../../../../UIManager";
import { tileCoordToRegionCoord } from "../../../../../Backend/Utils/Utils";

export function getGoldGeneratorDetailsAndActions(data: InteractData & { type: InteractType.Upgrade }): {
  details: DetailListItem[];
  hiddenDetails: DetailListItem[];
  actions: InfoModalProps["actions"];
} {
  if (data.subtype !== TileUpgrade.GOLD_GENERATOR) {
    throw new Error("Not a gold generator");
  }

  const gm = GameManager.getInstance();
  const cap = gm.constants.gameConstants.TILE_UPGRADE_MAX_HARVEST[TileUpgrade.GOLD_GENERATOR];
  const { selectedCoords } = data;

  const regionCoord = tileCoordToRegionCoord(selectedCoords[0]);
  const { controller, disputed } = gm.extendedDungeon.getRegionController(regionCoord);

  const groupBoost = gm.extendedDungeon.getHarvestBoost(selectedCoords);
  const harvestable = gm.extendedDungeon.getHarvestableAmount(selectedCoords, TileUpgrade.GOLD_GENERATOR);
  const totalHarvestable = Array.from(harvestable.values()).reduce<number>((acc, curr) => {
    return acc + curr.individual + curr.boost;
  }, 0);
  const secondsForHarvest =
    gm.constants.gameConstants.TILE_UPGRADE_NUMBER_OF_SECONDS_FOR_ONE_HARVEST[TileUpgrade.GOLD_GENERATOR];

  let harvestableDetails: DetailListItem[] = [];

  harvestable.toArray().forEach(([coord, { individual, boost, capped }]) => {
    const value = capped ? `${individual} (capped)` : `${individual}+${boost}`;
    const harvestableAmount = {
      title: `Generator (${coord.x},${coord.y})`,
      type: ItemType.Detail,
      value,
      withChainTimeUpdate: true,
    };

    harvestableDetails = [...harvestableDetails, harvestableAmount];
  });

  return {
    details: [
      {
        title: "Count",
        value: selectedCoords.length,
        type: ItemType.Detail,
      },
      { title: "Group boost", value: `${groupBoost}%`, type: ItemType.Detail },
      { title: "Harvestable", value: totalHarvestable, type: ItemType.Detail, withChainTimeUpdate: true },
    ],
    hiddenDetails: [
      { title: "Harvest details", type: ItemType.Headline },
      { title: "Seconds to generate 1 gold", value: `${secondsForHarvest}s`, type: ItemType.Detail },
      { title: "Max harvest per tile", value: `${cap}`, type: ItemType.Detail },
      ...harvestableDetails,
    ],
    actions:
      controller === gm.address && !disputed && gm.extendedDungeon.getTileAt(selectedCoords[0]).owner === gm.address
        ? [
            {
              title: "Harvest",
              onClick: () => {
                const coordArray = selectedCoords.map((coord) => ({ ...coord }));
                gm.harvestTiles(coordArray);
              },
            },
          ]
        : [],
  };
}
