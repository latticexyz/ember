import { InteractData, InteractType } from "../../../../UIManager";
import { ItemType, DetailListItem } from "../../../Common/DetailsList";
import GameManager from "../../../../../Backend/Game/GameManager";
import { TileUpgrade } from "../../../../../_types/ContractTypes";
import { InfoModalProps } from "../../../Common/InfoModal";

export function getSoulStorageDetails(data: InteractData & { type: InteractType.Upgrade }): {
  details: DetailListItem[];
  hiddenDetails: DetailListItem[];
  actions: InfoModalProps["actions"];
} {
  if (data.subtype !== TileUpgrade.SOUL_STORAGE) {
    throw new Error("Not a soul storage");
  }

  const { selectedCoords } = data;
  const gm = GameManager.getInstance();
  const ownerAddress = gm.extendedDungeon.getTileAt(selectedCoords[0]).owner;
  const owner = gm.extendedDungeon.players.get(ownerAddress);
  const ownerBalance = owner?.souls || 0;
  const groupCapacity = gm.constants.gameConstants.TILE_UPGRADE_SOUL_STORAGE[2] * selectedCoords.length;
  const ownerStorageCapacity = owner?.maxSouls || groupCapacity;
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
