import { ContractFunction, BigNumber, ethers } from "ethers";
import { callWithRetry } from "../Utils/Utils";
import { ThrottledConcurrentQueue } from "../Utils/ThrottledConcurrentQueue";
import { REGION_LENGTH } from "../Utils/Defaults";
import { PerlinConfig } from "../../../../packages/hashing/dist";
import { GameContracts } from "../ETH/NetworkConfig";
import Network from "../ETH/Network";
import { TxType } from "../../_types/GlobalTypes";

export interface GameConstants {
  INITIAL_GOLD: number;
  INITIAL_SOULS: number;

  NUMBER_OF_SECONDS_FOR_ONE_MANA_REGEN: number;
  MAX_MANA: number;
  MANA_PER_ACTION_TYPE: [number, number, number];

  GOLD_PER_GOLD_BLOCK: number;
  SOULS_PER_SOUL_BLOCK: number;
  GOLD_PERLIN_THRESHOLD: number;
  SOUL_PERLIN_THRESHOLD: number;
  SOUL_GROUND_RESOURCE_PERLIN_THRESHOLD: number;

  TIME_BETWEEN_DRIPS: number;
  WALL_PRICE: number;
  TILE_UPGRADE_PRICES: [number, number, number, number, number, number, number];
  INFLUENCE_PER_TILE_UPGRADE: [number, number, number, number, number, number, number];

  TILE_UPGRADE_GOLD_STORAGE: [number, number, number];
  TILE_UPGRADE_SOUL_STORAGE: [number, number, number];

  POPULATION_PER_LAIR: number;

  HARVEST_BOOST_TRANCHES: [number, number, number, number];
  TILE_UPGRADE_MAX_HARVEST: [number, number, number, number, number, number, number];
  TILE_UPGRADE_NUMBER_OF_SECONDS_FOR_ONE_HARVEST: [number, number, number, number, number, number, number];
  MAX_SOULS_HARVESTED_PER_SOUL_TILE: number;

  DELAYED_ACTIONS_MIN_SECOND_DELAY: [[number, number], [number, number], [number, number]];
  SECONDS_UNTIL_EXPIRED_DELAYED_ACTION: number;

  MIN_INFLUENCE_FOR_CONTROL: number;
  CREATURES_MIN_SECOND_DELAY_BETWEEN_SPAWN: number;
  CREATURES_UNIQUE_STAT_MULTIPLIER: number;
  CREATURES_UNIQUE_GROUP_NEG_BOOST: number;
  // CreatureSpecies -> CreatureType -> (gold, souls)
  CREATURES_PRICE: [[[number, number], [number, number], [number, number], [number, number], [number, number]]];
  // CreatureSpecies -> ATK/LIFE -> value
  CREATURES_BASE_STAT_PER_SPECIES: [[number, number]];
  // CreaturesType -> CreaturesType -> value;
  CREATURES_TYPE_STRENGTH_AGAINST_TYPE: [
    [number, number, number, number, number],
    [number, number, number, number, number],
    [number, number, number, number, number],
    [number, number, number, number, number],
    [number, number, number, number, number]
  ];
  // CreatureSpecies -> 0-3 -> value
  CREATURES_INFLUENCE_PER_SPECIES_AND_LEVEL: [[number, number, number, number]];
  CREATURES_GROUP_MULTIPLIERS: [number, number, number, number, number];
  CREATURES_MAX_NUMBER_OF_ROUNDS_PER_COMBAT: number;
  CREATURES_MAX_REGION_DISTANCE_FOR_MOVE: number;
  PERLIN_1_KEY: number;
  PERLIN_2_KEY: number;
  PERLIN_1_SCALE: number;
  PERLIN_2_SCALE: number;
}

interface GameConstantsUnparsed {
  INITIAL_GOLD: BigNumber;
  INITIAL_SOULS: BigNumber;
  MAX_MANA: BigNumber;
  NUMBER_OF_SECONDS_FOR_ONE_MANA_REGEN: BigNumber;
  MANA_PER_ACTION_TYPE: [number, number, number];
  GOLD_PER_GOLD_BLOCK: BigNumber;
  SOULS_PER_SOUL_BLOCK: BigNumber;
  GOLD_PERLIN_THRESHOLD: BigNumber;
  SOUL_PERLIN_THRESHOLD: BigNumber;
  SOUL_GROUND_RESOURCE_PERLIN_THRESHOLD: BigNumber;

  TIME_BETWEEN_DRIPS: BigNumber;
  WALL_PRICE: BigNumber;
  TILE_UPGRADE_PRICES: [number, number, number, number, number, number, number];
  INFLUENCE_PER_TILE_UPGRADE: [number, number, number, number, number, number, number];

  TILE_UPGRADE_GOLD_STORAGE: [number, number, number];
  TILE_UPGRADE_SOUL_STORAGE: [number, number, number];

  POPULATION_PER_LAIR: BigNumber;

  HARVEST_BOOST_TRANCHES: [number, number, number, number];
  TILE_UPGRADE_MAX_HARVEST: [number, number, number, number, number, number, number];
  TILE_UPGRADE_NUMBER_OF_SECONDS_FOR_ONE_HARVEST: [number, number, number, number, number, number, number];
  MAX_SOULS_HARVESTED_PER_SOUL_TILE: BigNumber;

  DELAYED_ACTIONS_MIN_SECOND_DELAY: [[number, number], [number, number], [number, number]];
  SECONDS_UNTIL_EXPIRED_DELAYED_ACTION: BigNumber;

  MIN_INFLUENCE_FOR_CONTROL: BigNumber;
  CREATURES_MIN_SECOND_DELAY_BETWEEN_SPAWN: BigNumber;
  CREATURES_UNIQUE_STAT_MULTIPLIER: BigNumber;
  CREATURES_UNIQUE_GROUP_NEG_BOOST: BigNumber;
  // CreatureSpecies -> CreatureType -> (gold, souls)
  CREATURES_PRICE: [[[number, number], [number, number], [number, number], [number, number], [number, number]]];
  CREATURES_BASE_STAT_PER_SPECIES: [[number, number]];
  // CreaturesType -> CreaturesType -> value;
  CREATURES_TYPE_STRENGTH_AGAINST_TYPE: [
    [number, number, number, number, number],
    [number, number, number, number, number],
    [number, number, number, number, number],
    [number, number, number, number, number],
    [number, number, number, number, number]
  ];
  // CreatureSpecies -> 0-3 -> value
  CREATURES_INFLUENCE_PER_SPECIES_AND_LEVEL: [[number, number, number, number]];
  CREATURES_GROUP_MULTIPLIERS: [number, number, number, number, number];
  CREATURES_MAX_NUMBER_OF_ROUNDS_PER_COMBAT: BigNumber;
  CREATURES_MAX_REGION_DISTANCE_FOR_MOVE: BigNumber;
  PERLIN_1_KEY: BigNumber;
  PERLIN_2_KEY: BigNumber;
  PERLIN_1_SCALE: BigNumber;
  PERLIN_2_SCALE: BigNumber;
}

const UNPARSED_KEYS: string[] = ["DRIP_AMOUNT"];

class Constants {
  public net: Network<GameContracts, TxType>;
  private readonly callQueue = new ThrottledConcurrentQueue(20, 1000);
  public gameConstants: GameConstants;
  public perlinConfig1: PerlinConfig;
  public perlinConfig2: PerlinConfig;
  public MAX_X: number;
  public MAX_Y: number;
  public MAX_REGION_X: number;
  public MAX_REGION_Y: number;
  public TILES_X: number;
  public TILES_Y: number;
  public REGIONS_X: number;
  public REGIONS_Y: number;

  private constructor(net: Network<GameContracts, TxType>) {
    this.net = net;
  }

  public static async create(net: Network<GameContracts, TxType>): Promise<Constants> {
    const c = new Constants(net);
    await c.load();
    return c;
  }

  private makeCall<T>(contractViewFunction: ContractFunction<T>, args: unknown[] = []): Promise<T> {
    return this.callQueue.add(() => callWithRetry<T>(contractViewFunction, args));
  }

  public async load(): Promise<void> {
    this.gameConstants = await this.getGameConstants();
    const [maxX, maxY] = await this.getUniverseBoundaries();
    this.MAX_X = maxX;
    this.MAX_Y = maxY;
    this.TILES_X = (maxX + 1) * 2;
    this.TILES_Y = (maxY + 1) * 2;
    this.MAX_REGION_X = (maxX + 1) / REGION_LENGTH;
    this.MAX_REGION_Y = (maxY + 1) / REGION_LENGTH;
    this.REGIONS_X = this.MAX_REGION_X * 2;
    this.REGIONS_Y = this.MAX_REGION_Y * 2;
    this.perlinConfig1 = {
      key: this.gameConstants.PERLIN_1_KEY,
      scale: this.gameConstants.PERLIN_1_SCALE,
    };
    this.perlinConfig2 = {
      key: this.gameConstants.PERLIN_2_KEY,
      scale: this.gameConstants.PERLIN_2_SCALE,
    };
  }

  private async getGameConstants(): Promise<GameConstants> {
    const ret = await this.makeCall<GameConstantsUnparsed>(this.net.bulkContracts.getterFacet.getGameConstants, []);
    const gameConstants: any = {};
    for (const k of Object.keys(ret)) {
      // add keys you don't want to parse here
      if (UNPARSED_KEYS.includes(k) || !isNaN(k as unknown as number)) {
        continue;
      } else if (BigNumber.isBigNumber(ret[k])) {
        try {
          gameConstants[k] = (ret[k] as BigNumber).toNumber();
        } catch (e) {
          gameConstants[k] = parseFloat(ethers.utils.formatEther((ret[k] as BigNumber).toString()));
        }
      } else {
        gameConstants[k] = ret[k];
      }
    }
    return gameConstants as GameConstants;
  }

  private async getUniverseBoundaries(): Promise<[number, number]> {
    const ret = await this.makeCall<[BigNumber, BigNumber]>(this.net.bulkContracts.getterFacet.getUniverseBoundaries);
    return [ret[0].toNumber(), ret[1].toNumber()];
  }
}

export default Constants;
