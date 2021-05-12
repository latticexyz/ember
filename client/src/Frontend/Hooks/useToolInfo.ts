import { UpgradeItem, WorldCoord } from "../../_types/GlobalTypes";
import { useGameManager } from "./useGameManager";
import { ActionType, TileUpgrade } from "../../_types/ContractTypes";

export const NAMES = {
  [UpgradeItem.GoldStorage]: "Gold chest",
  [UpgradeItem.GoldGenerator]: "Gold generator",
  [UpgradeItem.SoulStorage]: "Soul chest",
  [UpgradeItem.SoulGenerator]: "Soul extractor",
  [UpgradeItem.Lair]: "Lair",
  [UpgradeItem.TrainingRoom]: "Training Room",
  [UpgradeItem.Wall]: "Wall",
};

export const useToolInfo = (regionCoord: WorldCoord) => {
  const gm = useGameManager();
  if (!gm) return null;

  const contractPrices = gm.constants.gameConstants.TILE_UPGRADE_PRICES;
  const goldStorageCapacity = gm.constants.gameConstants.TILE_UPGRADE_GOLD_STORAGE[1];
  const soulStorageCapacity = gm.constants.gameConstants.TILE_UPGRADE_SOUL_STORAGE[2];
  const maxPopulationIncrease = gm.constants.gameConstants.POPULATION_PER_LAIR;

  const { found, regionCoord: settlementRegionCoord } = gm.extendedDungeon.getSettlement(regionCoord);
  if (!found) {
    throw new Error("No settlement for this region " + JSON.stringify(regionCoord));
  }
  const tilesInSettlement = gm.extendedDungeon.getTilesInSettlement(settlementRegionCoord);
  const getUpgradePrice = (upgrade: TileUpgrade) => {
    const numberOfUpgradesOfSameType = tilesInSettlement
      .map((t) => gm.extendedDungeon.getTileAt(t))
      .filter((t) => t.upgrade === upgrade).length;
    const initialGoldCost = gm.constants.gameConstants.TILE_UPGRADE_PRICES[upgrade];
    const pricePercentIncrease = gm.constants.gameConstants.TILE_UPGRADE_PRICE_PERCENT_INCREASE_PER_UNIT[upgrade];
    const goldCost = initialGoldCost * Math.pow(1 + pricePercentIncrease / 100, numberOfUpgradesOfSameType);
    return Math.floor(goldCost);
  };
  const getNumberOfInstances = (upgrade: TileUpgrade) => {
    const numberOfUpgradesOfSameType = tilesInSettlement
      .map((t) => gm.extendedDungeon.getTileAt(t))
      .filter((t) => t.upgrade === upgrade).length;
    return numberOfUpgradesOfSameType;
  };

  const INITIAL_PRICE = {
    [UpgradeItem.GoldStorage]: contractPrices[TileUpgrade.GOLD_STORAGE],
    [UpgradeItem.GoldGenerator]: contractPrices[TileUpgrade.GOLD_GENERATOR],
    [UpgradeItem.SoulStorage]: contractPrices[TileUpgrade.SOUL_STORAGE],
    [UpgradeItem.SoulGenerator]: contractPrices[TileUpgrade.SOUL_GENERATOR],
    [UpgradeItem.Lair]: contractPrices[TileUpgrade.LAIR],
    [UpgradeItem.TrainingRoom]: contractPrices[TileUpgrade.TRAINING_ROOM],
    [UpgradeItem.Wall]: gm.constants.gameConstants.WALL_PRICE,
  };
  const NUMBER_OF_INSTANCES = {
    [UpgradeItem.GoldStorage]: getNumberOfInstances(TileUpgrade.GOLD_STORAGE),
    [UpgradeItem.GoldGenerator]: getNumberOfInstances(TileUpgrade.GOLD_GENERATOR),
    [UpgradeItem.SoulStorage]: getNumberOfInstances(TileUpgrade.SOUL_STORAGE),
    [UpgradeItem.SoulGenerator]: getNumberOfInstances(TileUpgrade.SOUL_GENERATOR),
    [UpgradeItem.Lair]: getNumberOfInstances(TileUpgrade.LAIR),
    [UpgradeItem.TrainingRoom]: getNumberOfInstances(TileUpgrade.TRAINING_ROOM),
    [UpgradeItem.Wall]: undefined,
  };
  const PRICES = {
    [UpgradeItem.GoldStorage]: getUpgradePrice(TileUpgrade.GOLD_STORAGE),
    [UpgradeItem.GoldGenerator]: getUpgradePrice(TileUpgrade.GOLD_GENERATOR),
    [UpgradeItem.SoulStorage]: getUpgradePrice(TileUpgrade.SOUL_STORAGE),
    [UpgradeItem.SoulGenerator]: getUpgradePrice(TileUpgrade.SOUL_GENERATOR),
    [UpgradeItem.Lair]: getUpgradePrice(TileUpgrade.LAIR),
    [UpgradeItem.TrainingRoom]: getUpgradePrice(TileUpgrade.TRAINING_ROOM),
    [UpgradeItem.Wall]: gm.constants.gameConstants.WALL_PRICE,
  };

  const INFO_TEXT = {
    [UpgradeItem.GoldStorage]: `Gold chests increase your gold storage capacity by ${goldStorageCapacity}.`,
    [UpgradeItem.GoldGenerator]: "Gold generators turn time into gold.",
    [UpgradeItem.SoulStorage]: `Soul chests increase your soul storage capacity by ${soulStorageCapacity}.`,
    [UpgradeItem.SoulGenerator]: "Soul extractors harvest souls from soul pits.",
    [UpgradeItem.Lair]: `Lairs increase your population limit by ${maxPopulationIncrease}.`,
    [UpgradeItem.TrainingRoom]: `Training Rooms allow you to upgrade the level of your creatures`,
    [UpgradeItem.Wall]: "Walls are more difficult to destroy than regular rock. Use them to protect your empire.",
  };

  return { PRICES, INITIAL_PRICE, NUMBER_OF_INSTANCES, INFO_TEXT };
};
