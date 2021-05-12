import * as path from "path";
import * as yup from "yup";
import chalk from "chalk";
import dedent from "ts-dedent";
import { cosmiconfigSync } from "cosmiconfig";
import toml from "@iarna/toml";

// HRE stuff
import "hardhat/types/runtime";
import { BigNumber } from "ethers";

declare module "hardhat/types/runtime" {
    interface HardhatRuntimeEnvironment {
        DEPLOYER_MNEMONIC: string | undefined;
        initializers: yup.Asserts<typeof Initializers>;
    }
}
const NUMBER_OF_TILE_UPGRADES = 8;
const NUMBER_OF_CREATURE_SPECIES = 2;
const NUMBER_OF_CREATURE_TYPES = 5;
const NUMBER_OF_CREATURE_LEVELS = 4;
const NUMBER_OF_ACTION_TYPES = 2;
const MAX_NUMBER_OF_SETTLEMENTS = 4;

export const Initializers = yup
    .object({
        gameConstants: yup.object({
            CAN_SPAWN: yup.boolean().required(),
            INITIAL_GOLD: yup.number().min(0).required(),
            INITIAL_SOULS: yup.number().min(0).required(),
            MAX_MANA: yup.number().min(0).required(),
            NUMBER_OF_SECONDS_FOR_ONE_MANA_REGEN: yup.number().min(0).required(),
            MANA_PER_ACTION_TYPE: yup.array(yup.number().min(0)).length(NUMBER_OF_ACTION_TYPES).required(),
            SETTLEMENT_PRICE_PER_LEVEL: yup
                .array(yup.array(yup.number().min(0)).length(2))
                .length(3)
                .required(),
            SETTLEMENT_PRICE_PERCENT_INCREASE_PER_UNIT: yup
                .array(yup.number().min(0))
                .length(MAX_NUMBER_OF_SETTLEMENTS)
                .required(),
            NUMBER_OF_SECONDS_FOR_ONE_ENERGY_REGEN: yup.number().min(0).required(),
            MAX_ENERGY_PER_LEVEL: yup.array(yup.number().min(0)).length(3).required(),
            GOLD_PER_GOLD_BLOCK: yup.number().min(0).required(),
            SOULS_PER_SOUL_BLOCK: yup.number().min(0).required(),
            GOLD_PERLIN_THRESHOLD: yup.number().min(0).required(),
            SOUL_PERLIN_THRESHOLD: yup.number().min(0).required(),
            SOUL_GROUND_RESOURCE_PERLIN_THRESHOLD: yup.number().min(0).required(),
            DRIP_AMOUNT: yup
                .string()
                .transform((s) => BigNumber.from(s).toHexString())
                .required(),
            TIME_BETWEEN_DRIPS: yup.number().min(0).required(),
            WALL_PRICE: yup.number().min(0).required(),
            TILE_UPGRADE_PRICES: yup.array(yup.number().min(0)).length(NUMBER_OF_TILE_UPGRADES).required(),
            TILE_UPGRADE_PRICE_PERCENT_INCREASE_PER_UNIT: yup
                .array(yup.number().min(0))
                .length(NUMBER_OF_TILE_UPGRADES)
                .required(),
            INFLUENCE_PER_TILE_UPGRADE: yup.array(yup.number().min(0)).length(NUMBER_OF_TILE_UPGRADES).required(),
            TILE_UPGRADE_GOLD_STORAGE: yup.array(yup.number().min(0)).length(3).required(),
            TILE_UPGRADE_SOUL_STORAGE: yup.array(yup.number().min(0)).length(3).required(),
            POPULATION_PER_LAIR: yup.number().min(1).required(),
            POPULATION_PER_DH: yup.number().min(1).required(),
            HARVEST_BOOST_TRANCHES: yup.array(yup.number().min(0)).length(4).required(),
            TILE_UPGRADE_NUMBER_OF_SECONDS_FOR_ONE_HARVEST: yup
                .array(yup.number().min(0))
                .length(NUMBER_OF_TILE_UPGRADES)
                .required(),
            TILE_UPGRADE_MAX_HARVEST: yup.array(yup.number().min(0)).length(NUMBER_OF_TILE_UPGRADES).required(),
            MAX_SOULS_HARVESTED_PER_SOUL_TILE: yup.number().min(0).required(),
            MAX_GROUND_BYTE_VALUE_TO_BE_SOUL_TILE: yup.number().min(0).required(),
            DELAYED_ACTIONS_MIN_SECOND_DELAY: yup
                .array(yup.array(yup.number().min(0)).length(2))
                .length(3)
                .required(),
            SECONDS_UNTIL_EXPIRED_DELAYED_ACTION: yup.number().min(1).required(),
            MIN_INFLUENCE_FOR_CONTROL: yup.number().min(1).required(),
            CREATURES_UNIQUE_STAT_MULTIPLIER: yup.number().min(1).required(),
            CREATURES_UNIQUE_GROUP_NEG_BOOST: yup.number().max(0).required(),
            CREATURES_PRICE: yup
                .array(yup.array(yup.array(yup.number().min(0)).length(2)).length(NUMBER_OF_CREATURE_TYPES))
                .length(NUMBER_OF_CREATURE_SPECIES)
                .required(),
            CREATURES_LEVEL_UP_PRICE: yup
                .array(
                    yup
                        .array(yup.array(yup.number().min(0)).length(NUMBER_OF_CREATURE_LEVELS - 1))
                        .length(NUMBER_OF_CREATURE_TYPES)
                )
                .length(NUMBER_OF_CREATURE_SPECIES)
                .required(),
            CREATURES_BASE_STAT_PER_SPECIES: yup
                .array(yup.array(yup.array(yup.number().min(1)).length(NUMBER_OF_CREATURE_LEVELS)).length(2))
                .length(NUMBER_OF_CREATURE_SPECIES)
                .required(),
            CREATURES_TYPE_STRENGTH_AGAINST_TYPE: yup
                .array(yup.array(yup.number().min(0)).length(NUMBER_OF_CREATURE_TYPES))
                .length(NUMBER_OF_CREATURE_TYPES)
                .required(),
            CREATURES_INFLUENCE_PER_SPECIES_AND_LEVEL: yup
                .array(yup.array(yup.number().min(0)).length(NUMBER_OF_CREATURE_LEVELS))
                .length(NUMBER_OF_CREATURE_SPECIES)
                .required(),
            CREATURES_GROUP_MULTIPLIERS: yup.array(yup.number().min(0)).length(5).required(),
            MAX_CREATURES_PER_SPECIES_AND_TYPES: yup
                .array(yup.array(yup.number().min(0)).length(NUMBER_OF_CREATURE_TYPES))
                .length(NUMBER_OF_CREATURE_SPECIES)
                .required(),
            CREATURES_MAX_NUMBER_OF_ROUNDS_PER_COMBAT: yup.number().min(1).required(),
            CREATURES_MAX_REGION_DISTANCE_FOR_MOVE: yup.number().min(1).required(),
            PERLIN_1_KEY: yup.number().min(0).required(),
            PERLIN_2_KEY: yup.number().min(0).required(),
            PERLIN_1_SCALE: yup.number().min(1).required(),
            PERLIN_2_SCALE: yup.number().min(1).required(),
        }),
        numberOfRegionsPerSide: yup
            .number()
            .min(8)
            .required()
            .test("is-divisble", "numberOfRegionsPerSide is not divisibe by 8", (r) =>
                r && r % 8 === 0 ? true : false
            ),
    })
    .defined();

// Util for parsing & validating schemas with pretty printing
export function parse<S extends yup.BaseSchema>(schema: S, data: unknown): yup.Asserts<S> {
    try {
        return schema.validateSync(data, { abortEarly: false });
    } catch (err) {
        printValidationErrors(err);
        process.exit(1);
    }
}

// A function that iterates over a Hardhat `lazyObject` to force them to be loaded.
//
// This is needed because some of our Yup Schemas have `.required()` properties but aren't
// immediately validated due to `lazyObject`.
export function required<S extends { [key: string]: unknown }>(schema: S, keys: Array<keyof S>) {
    const header = "* Required keys/values:";
    const messages = keys.map((key, idx) => {
        if (typeof key === "string" || typeof key === "number") {
            return `* ${idx + 1}. ${key}: ${schema[key]}`;
        } else {
            console.error(chalk.red("Invalid key"), key);
            process.exit(1);
        }
    });

    const longest = messages.reduce((max, msg) => Math.max(msg.length, max), header.length);
    const stars = "*".repeat(longest);

    const msg = dedent`
    ${stars}
    ${header}
    *
    ${messages.join("\n")}
    ${stars}
  `;

    // We pretty much just log them so we have something to do with them.
    // console.log(chalk.green(msg));
}

function printValidationErrors(err: yup.ValidationError) {
    const header = "* Encountered configuration errors:";
    const messages = err.errors.map((msg: string, idx: number) => `* ${idx + 1}. ${msg}`);

    const longest = messages.reduce((max, msg) => Math.max(msg.length, max), header.length);
    const stars = "*".repeat(longest);

    const msg = dedent`
    ${stars}
    ${header}
    *
    ${messages.join("\n")}
    ${stars}
  `;

    console.error(chalk.red(msg));
}

// Config file loading stuff
const explorer = (environment: string) =>
    cosmiconfigSync("ember", {
        cache: true,
        searchPlaces: [`ember.${environment}.toml`],
        loaders: {
            ".toml": (filename, content) => {
                try {
                    return toml.parse(content);
                } catch (err) {
                    console.error(chalk.red(`Error parsing ${path.basename(filename)}`));
                    console.error(chalk.yellow(err.message));
                    process.exit(1);
                }
            },
        },
    });

export type EnvironmentString = "prod" | "staging" | "local" | "test";

export function load(environment: EnvironmentString): { [key: string]: unknown } {
    const result = explorer(environment).search();
    if (result) {
        return result.config;
    } else {
        console.error(chalk.yellow("Could not find `ember." + environment + ".toml`"));
        throw new Error("No config file found");
    }
}

// Util for generating a number representing seconds timestamp from input datetime
function dateInSeconds() {
    return yup.number().transform(function (value, originalValue) {
        if (this.isType(value)) return value;

        return Math.floor(new Date(originalValue).getTime() / 1000);
    });
}
