import { ItemType, DetailListItem } from "../../../Common/DetailsList";
import { InteractData } from "../../../../UIManager";
import { Address, UnobservedAddress } from "../../../Common/renderAddress";
import ExtendedDungeon from "../../../../../Backend/Game/ExtendedDungeon";
import { NameQueue } from "../../../../../Backend/Utils/NameQueue";

export function getTileDetails(data: InteractData, extendedDungeon: ExtendedDungeon, nq: NameQueue): DetailListItem[] {
  const tile = data.tile;
  if (!tile) return [];

  const coord = data.selectedCoords[0];

  return [
    { title: "Tile", type: ItemType.Headline },
    {
      title: "Owner",
      value: UnobservedAddress({
        address: tile.owner,
        you: extendedDungeon.player === tile.owner,
        nq,
      }),
      type: ItemType.Detail,
    },
    { title: "Location", value: `(${coord.x},${coord.y})`, type: ItemType.Detail },
  ];
}
