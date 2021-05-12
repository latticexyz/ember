import { DetailListItem, ItemType } from "../../../Common/DetailsList";
import { InfoModalProps } from "../../../Common/InfoModal";
import { TileUpgrade } from "../../../../../_types/ContractTypes";
import { getGoldGeneratorDetailsAndActions } from "./getGoldGeneratorDetailsAndActions";
import { getGoldStorageDetails } from "./getGoldStorageDetails";
import { InteractData, InteractType } from "../../../../UIManager";
import { getDungeonHeartDetails } from "./getDungeonHeartDetails";
import { getSoulGeneratorDetailsAndActions } from "./getSoulGeneratorDetailsAndActions";
import { getSoulStorageDetails } from "./getSoulStorageDetails";
import { getLairDetailsAndActions } from "./getLairDetailsAndActions";

export function getUpgradeDetailsAndActions(data: InteractData & { type: InteractType.Upgrade }): {
  details: DetailListItem[];
  hiddenDetails: DetailListItem[];
  actions: InfoModalProps["actions"];
} {
  if (data.subtype === TileUpgrade.GOLD_STORAGE) {
    return getGoldStorageDetails(data);
  }

  if (data.subtype === TileUpgrade.GOLD_GENERATOR) {
    return getGoldGeneratorDetailsAndActions(data);
  }

  if (data.subtype === TileUpgrade.SOUL_GENERATOR) {
    return getSoulGeneratorDetailsAndActions(data);
  }

  if (data.subtype === TileUpgrade.SOUL_STORAGE) {
    return getSoulStorageDetails(data);
  }

  if (data.subtype === TileUpgrade.LAIR) {
    return getLairDetailsAndActions(data);
  }

  if (data.subtype === TileUpgrade.DUNGEON_HEART) {
    return getDungeonHeartDetails(data);
  }
  return { details: [], actions: [], hiddenDetails: [] };
}
