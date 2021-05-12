import * as fs from "fs";
import * as path from "path";
import { ethers } from "ethers";
import inquirer from "inquirer";
import { REGISTRY_ADDRESS } from "@latticexyz/registry/dist/addresses";
import { isValidHttpUrl } from "./misc";

const CLI_PATH = path.join(require("os").homedir(), ".lattice");
fs.mkdirSync(CLI_PATH, { recursive: true });

export interface Config {
    web3StorageKey: string;
    netlifyPersonalToken: string;
    registryAddress: string;
    registryRpc: string;
    deployerMnemonic: string;
}

const createCLIConfig = (c: Config) => {
    const configP = path.join(CLI_PATH, "config.json");
    fs.writeFileSync(configP, JSON.stringify(c));
};

const getCLIConfig = (): Config | null => {
    const p = path.join(CLI_PATH, "config.json");
    if (!fs.existsSync(p)) {
        return null;
    }
    try {
        const config = fs.readFileSync(p).toString();
        const configParsed = JSON.parse(config);
        return configParsed;
    } catch (e) {
        console.error(e);
        return null;
    }
};
export const getOrCreateConfig = async (): Promise<Config> => {
    const c = getCLIConfig();
    if (c) {
        return c;
    }
    const randomMnemonic = ethers.Wallet.createRandom().mnemonic.phrase;
    const answers: {
        web3StorageKey: string;
        netlifyPersonalToken: string;
        registryAddress: string;
        registryRpc: string;
        deployerMnemonic: string;
    } = await inquirer.prompt([
        {
            type: "input",
            name: "web3StorageKey",
            message: "Your Web3.storage API Key",
            validate: (i) => {
                if (i.length === 0) {
                    return "invalid";
                }
                return true;
            },
        },
        {
            type: "input",
            name: "netlifyPersonalToken",
            message:
                "Netlify Personal Token (press enter to not have one, you won't be able to deploye clients using the CLI)",
        },
        {
            type: "input",
            name: "registryAddress",
            message: "Address of the LatticeRegistry (press enter for the official deployment)",
            default: REGISTRY_ADDRESS,
            validate: (i) => {
                if (ethers.utils.isAddress(i)) {
                    return true;
                } else {
                    return "not a valid address";
                }
            },
        },
        {
            type: "input",
            name: "registryRpc",
            message:
                "RPC to connect to the registry (press enter to get the default offical xDai RPC, use if you didn't modify the registry address)",
            default: "https://rpc.xdaichain.com",
            validate: (i) => {
                if (isValidHttpUrl(i)) {
                    if (i[i.length - 1] === "/") {
                        return "no trailing slash";
                    }
                    return true;
                } else {
                    return "not a valid url";
                }
            },
        },
        {
            type: "input",
            name: "deployerMnemonic",
            default: randomMnemonic,
            message: "Mnemonic of your deployer. A random one has been generated as the default.",
            validate: (i) => {
                try {
                    ethers.Wallet.fromMnemonic(i);
                    return true;
                } catch (e) {
                    return "invalid mnemonic";
                }
            },
        },
    ]);

    const createdConfig: Config = {
        ...answers,
    };
    createCLIConfig(createdConfig);
    console.log("created config!");
    return createdConfig;
};

export const createTempFolder = (id: string) => {
    const tempF = path.join(CLI_PATH, id);
    fs.mkdirSync(tempF, { recursive: true });
    return tempF;
};

export const deleteTempFolder = async (id: string) => {
    const tempF = path.join(CLI_PATH, id);
    await fs.promises.rm(tempF, { recursive: true });
};
