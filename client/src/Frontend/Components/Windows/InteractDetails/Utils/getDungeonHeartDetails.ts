import { ItemType, DetailListItem } from "../../../Common/DetailsList";
import { InteractType, InteractData } from "../../../../UIManager";
import GameManager from "../../../../../Backend/Game/GameManager";
import { InfoModalProps } from "../../../Common/InfoModal";
import { tileCoordToRegionCoord } from "../../../../../Backend/Utils/Utils";

export function getDungeonHeartDetails(data: InteractData & { type: InteractType.Upgrade }): {
  details: DetailListItem[];
  hiddenDetails: DetailListItem[];
  actions: InfoModalProps["actions"];
} {
  const { selectedCoords } = data;
  const gm = GameManager.getInstance();
  const dungeonOwnerAddress = gm.extendedDungeon.getTileAt(selectedCoords[0]).owner;
  const dungeonOwner = gm.extendedDungeon.players.get(dungeonOwnerAddress);
  const regionCoord = tileCoordToRegionCoord(selectedCoords[0]);
  const { controller, disputed } = gm.extendedDungeon.getRegionController(regionCoord);

  const generalInfo: DetailListItem[] = [
    { title: "Player", type: ItemType.Headline },
    { title: "Address", value: dungeonOwnerAddress.substr(0, 6), type: ItemType.Detail },
    { title: "Gold", value: dungeonOwner?.gold || 0, type: ItemType.Detail },
    { title: "Souls", value: dungeonOwner?.souls || 0, type: ItemType.Detail },
  ];

  const moreDetails: DetailListItem[] = [
    { title: "Details", type: ItemType.Headline },
    { title: "Full address", value: dungeonOwnerAddress, type: ItemType.Detail },
  ];

  // Add nickname to details, if set.
  const nickname = gm.services.nameQueue.getPlayerInfoFromAddress(dungeonOwnerAddress).nickname;
  if (nickname) {
    moreDetails.push({ title: "Nickname", value: nickname, type: ItemType.Detail });
  }

  return {
    details: generalInfo,
    hiddenDetails: moreDetails,
    actions:
      controller === gm.address && !disputed && dungeonOwner?.player !== gm.address
        ? [
          {
            title: "Claim",
            onClick: () => {
              gm.claimDungeonHeart(regionCoord);
            },
          },
        ]
        : [],
  };
}
