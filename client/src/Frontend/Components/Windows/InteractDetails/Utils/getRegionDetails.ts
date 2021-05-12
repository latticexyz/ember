import { InteractData } from "../../../../UIManager";
import { ItemType, DetailListItem } from "../../../Common/DetailsList";
import ExtendedDungeon from "../../../../../Backend/Game/ExtendedDungeon";
import { Address, UnobservedAddress } from "../../../Common/renderAddress";
import { NameQueue } from "../../../../../Backend/Utils/NameQueue";

export function getRegionDetails(
  data: InteractData,
  extendedDungeon: ExtendedDungeon,
  nq: NameQueue
): DetailListItem[] {
  if (!data.region) return [];

  const region = extendedDungeon.getRegionAt(data.region.coord);
  let influences = extendedDungeon.influenceDataByRegion.get(data.region.coord);
  const { controller, disputed } = extendedDungeon.getRegionController(data.region.coord);
  if (!influences) {
    influences = new Map();
  }

  const influenceList: DetailListItem[] = [];
  if (influences) {
    for (const [address, influence] of influences) {
      if (influence === 0) {
        continue;
      }
      influenceList.push({
        title: UnobservedAddress({ address, you: extendedDungeon.player === address, nq: nq }),
        value: influence,
        type: ItemType.Detail,
      });
    }
  }

  const claimableResources: DetailListItem[] = [];
  if (region.gold > 0 || region.souls > 0) {
    claimableResources.push({ title: "Claimable resources in region", type: ItemType.Headline });
    if (region.gold > 0) {
      claimableResources.push({ title: "Gold", type: ItemType.Detail, value: region.gold });
    }
    if (region.souls > 0) {
      claimableResources.push({ title: "Souls", type: ItemType.Detail, value: region.souls });
    }
  }

  return [
    { title: "Region", type: ItemType.Headline },
    {
      title: "Coordinate (region space)",
      value: `(${data.region.coord.x},${data.region.coord.y})`,
      type: ItemType.Detail,
    },
    { title: "Region influence", type: ItemType.Headline },
    ...influenceList,
    { title: "Total", value: [...influences?.values()].reduce((a, b) => a + b, 0) || 0, type: ItemType.Detail },
    {
      title: "Controller",
      value: !disputed
        ? UnobservedAddress({ address: controller, you: extendedDungeon.player === controller, nq })
        : "disputed!",
      type: ItemType.Detail,
    },
    ...claimableResources,
  ];
}
