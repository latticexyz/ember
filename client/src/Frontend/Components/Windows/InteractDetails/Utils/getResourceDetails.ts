import { ItemType, DetailListItem } from "../../../Common/DetailsList";
import { ResourceType } from "../../../../../_types/GlobalTypes";
import { InteractType, InteractData } from "../../../../UIManager";

export function getResourceDetails(data: InteractData & { type: InteractType.Resource }): DetailListItem[] {
  const { subtype, selectedCoords } = data;
  return [
    { title: "Resource", type: ItemType.Headline },
    { title: "Type", value: subtype === ResourceType.Soul ? "Soul" : "Gold", type: ItemType.Detail },
    { title: "Count", value: selectedCoords.length, type: ItemType.Detail },
  ];
}
