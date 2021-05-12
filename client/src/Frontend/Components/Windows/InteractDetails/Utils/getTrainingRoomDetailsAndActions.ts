import { InteractData, InteractType } from "../../../../UIManager";
import { ItemType, DetailListItem } from "../../../Common/DetailsList";
import GameManager from "../../../../../Backend/Game/GameManager";
import { TileUpgrade } from "../../../../../_types/ContractTypes";
import { InfoModalProps } from "../../../Common/InfoModal";
import { tileCoordToRegionCoord } from "../../../../../Backend/Utils/Utils";
import { creatureSpeciesToName, creatureTypeToName } from "../../../../../Backend/Game/Naming";

export function getTrainingRoomDetailsAndActions(data: InteractData & { type: InteractType.Upgrade }): {
  details: DetailListItem[];
  hiddenDetails: DetailListItem[];
  actions: InfoModalProps["actions"];
} {
  const gm = GameManager.getInstance();
  const gameConstants = gm.constants.gameConstants;

  if (data.subtype !== TileUpgrade.TRAINING_ROOM) {
    throw new Error("Not a training room");
  }

  const { selectedCoords } = data;
  const regionCoord = tileCoordToRegionCoord(selectedCoords[0]);
  const { controller, disputed } = gm.extendedDungeon.getRegionController(regionCoord);
  const creaturesInRegion = gm.extendedDungeon.getCreaturesInRegion(regionCoord);
  let totalPrice = 0;
  const details: DetailListItem[] = [];
  const maxLevel =
    data.selectedCoords.length >= 16
      ? 3
      : data.selectedCoords.length >= 8
      ? 2
      : data.selectedCoords.length >= 4
      ? 1
      : 0;
  for (const c of creaturesInRegion) {
    const title = `Level ${c.level} ${creatureTypeToName[c.creatureType]} ${creatureSpeciesToName[c.species]}`;
    if (c.level === 3) {
      details.push({
        title,
        type: ItemType.Detail,
        value: `fully upgraded`,
      });
    } else if (c.level + 1 > maxLevel) {
      details.push({
        title,
        type: ItemType.Detail,
        value: `Need bigger room`,
      });
    } else {
      const price = gm.constants.gameConstants.CREATURES_LEVEL_UP_PRICE[c.species][c.creatureType][c.level];
      totalPrice += price;
      details.push({
        title,
        type: ItemType.Detail,
        value: `${c.level} → ${c.level + 1} ${price} gold`,
      });
    }
  }

  return {
    details: [
      {
        type: ItemType.Headline,
        title: "Train Creatures in Region",
      },
      ...details,
    ],
    hiddenDetails: [{ title: "Training details", type: ItemType.Headline }],
    actions:
      controller === gm.address && !disputed && gm.extendedDungeon.getTileAt(selectedCoords[0]).owner === gm.address
        ? [
            {
              title: `Train creatures (${totalPrice} gold)`,
              onClick:
                gm.extendedDungeon.players.get(gm.address)!.gold > totalPrice && totalPrice > 0
                  ? () => {
                      const coordArray = selectedCoords.map((coord) => ({ ...coord }));
                      // console.log(coordArray);
                      gm.harvestTiles(coordArray);
                    }
                  : undefined,
            },
          ]
        : [],
  };
}
