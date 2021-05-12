import { InteractData, InteractType } from "../../../../UIManager";
import { ItemType, DetailListItem } from "../../../Common/DetailsList";
import GameManager from "../../../../../Backend/Game/GameManager";
import { TileUpgrade } from "../../../../../_types/ContractTypes";
import { InfoModalProps } from "../../../Common/InfoModal";

export function getGoldStorageDetails(data: InteractData & { type: InteractType.Upgrade }): {
  details: DetailListItem[];
  hiddenDetails: DetailListItem[];
  actions: InfoModalProps["actions"];
} {
  if (data.subtype !== TileUpgrade.GOLD_STORAGE) {
    throw new Error("Not a gold storage");
  }

  const { selectedCoords } = data;
  const gm = GameManager.getInstance();
  const ownerAddress = gm.extendedDungeon.getTileAt(selectedCoords[0]).owner;
  const owner = gm.extendedDungeon.players.get(ownerAddress);
  const ownerBalance = owner?.gold || 0;
  const groupCapacity = gm.constants.gameConstants.TILE_UPGRADE_GOLD_STORAGE[1] * selectedCoords.length;
  const ownerStorageCapacity = owner?.maxGold || groupCapacity;
  const groupShare = groupCapacity / ownerStorageCapacity;
  const groupBalance = Math.floor(ownerBalance * groupShare);

  return {
    details: [
      {
        title: "Count",
        value: selectedCoords.length,
        type: ItemType.Detail,
      },
      {
        title: selectedCoords.length > 1 ? "Group balance" : "Balance",
        value: `${groupBalance}/${groupCapacity}`,
        type: ItemType.Detail,
      },
    ],
    hiddenDetails: [],
    actions: [],
  };
}
