import { ItemType, DetailListItem } from "../../../Common/DetailsList";
import { InteractType, InteractData } from "../../../../UIManager";

export function getHarvestableGroundResourcesDetails(
  data: InteractData & { type: InteractType.HarvestableGroundResources }
): DetailListItem[] {
  const { subtype, selectedCoords } = data;
  return [
    { title: "Resource", type: ItemType.Headline },
    { title: "Ground resource (souls)", value: subtype.souls, type: ItemType.Detail },
    { title: "Count", value: selectedCoords.length, type: ItemType.Detail },
  ];
}
