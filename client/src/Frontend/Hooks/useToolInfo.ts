import { UpgradeItem } from "../../_types/GlobalTypes";
import { useGameManager } from "./useGameManager";
import { ActionType, TileUpgrade } from "../../_types/ContractTypes";

export const NAMES = {
  [UpgradeItem.GoldStorage]: "Gold chest",
  [UpgradeItem.GoldGenerator]: "Gold generator",
  [UpgradeItem.SoulStorage]: "Soul chest",
  [UpgradeItem.SoulGenerator]: "Soul extractor",
  [UpgradeItem.Lair]: "Lair",
  [UpgradeItem.Wall]: "Wall",
};

export const useToolInfo = () => {
  const gm = useGameManager();
  if (!gm) return null;

  const contractPrices = gm.constants.gameConstants.TILE_UPGRADE_PRICES;
  const goldStorageCapacity = gm.constants.gameConstants.TILE_UPGRADE_GOLD_STORAGE[1];
  const soulStorageCapacity = gm.constants.gameConstants.TILE_UPGRADE_SOUL_STORAGE[2];
  const maxPopulationIncrease = gm.constants.gameConstants.POPULATION_PER_LAIR;

  // TODO: This is kind of a mess. Should unify UpgradeItem and TileUpgrade sometime or have a utility to convert
  const GOLD_PRICES = {
    [UpgradeItem.GoldStorage]: contractPrices[TileUpgrade.GOLD_STORAGE],
    [UpgradeItem.GoldGenerator]: contractPrices[TileUpgrade.GOLD_GENERATOR],
    [UpgradeItem.SoulStorage]: contractPrices[TileUpgrade.SOUL_STORAGE],
    [UpgradeItem.SoulGenerator]: contractPrices[TileUpgrade.SOUL_GENERATOR],
    [UpgradeItem.Lair]: contractPrices[TileUpgrade.LAIR],
    [UpgradeItem.Wall]: gm.constants.gameConstants.WALL_PRICE,
  };

  const MANA_PRICE = gm.constants.gameConstants.MANA_PER_ACTION_TYPE[ActionType.UPGRADE];

  const INFO_TEXT = {
    [UpgradeItem.GoldStorage]: `Gold chests increase your gold storage capacity by ${goldStorageCapacity}.`,
    [UpgradeItem.GoldGenerator]: "Gold generators turn time into gold.",
    [UpgradeItem.SoulStorage]: `Soul chests increase your soul storage capacity by ${soulStorageCapacity}.`,
    [UpgradeItem.SoulGenerator]: "Soul extractors harvest souls from soul pits.",
    [UpgradeItem.Lair]: `Lairs increase your population limit by ${maxPopulationIncrease}.`,
    [UpgradeItem.Wall]: "Walls are more difficult to destroy than regular rock. Use them to protect your empire.",
  };

  return { GOLD_PRICES, MANA_PRICE, INFO_TEXT };
};
