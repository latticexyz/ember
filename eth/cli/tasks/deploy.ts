const NetlifyAPI = require("netlify");
import fetch from "node-fetch";
import { ethers } from "ethers";
import * as path from "path";
import * as fs from "fs";
import chalk from "chalk";
import inquirer from "inquirer";
import { v4 } from "uuid";
import { SUPPORTED_CHAINS } from "../constants";
import { createTempFolder, deleteTempFolder, getOrCreateConfig } from "../utils/config";
import { isValidHttpUrl, renderHeader, sleep } from "../utils/misc";
import { Listr, Logger } from "listr2";
import execa from "execa";
import { uploadArtifactsToIpfs } from "../utils/ipfs";
import { exit } from "process";
import { getRegistry } from "../utils/registry";
import { getBalance } from "../utils/balance";
import { getFund } from "../utils/faucet";

const MIN_BALANCE = ethers.utils.parseEther((0.001).toString());

interface Answers {
    chainId: number;
    deploymentName: string;
    deployClient: boolean;
    deployContracts: boolean;
    clientUrl: string | undefined;
    netlifySlug: string | undefined;
}

const deleteArtifacts = async (network: string) => {
    const tempF = path.join(process.cwd(), "deployments", network);
    await fs.promises.rm(tempF, { recursive: true });
};

const checkIfClientIsCompatible = async (url: string, tempFolder: string): Promise<boolean> => {
    try {
        const abiUrl = url + "/public/abi.json";
        const f = await fetch(abiUrl);
        if (f.status !== 200) {
            throw new Error("can't fetch client abi at " + abiUrl);
        }
        const abis = await f.json();
        const abiPath = path.join(tempFolder, "abi.json");
        await execa("yarn", ["run", "hh-export-abi", "--path", abiPath]);
        const ourAbi = JSON.parse(fs.readFileSync(abiPath).toString());
        return JSON.stringify(abis) === JSON.stringify(ourAbi);
    } catch (e) {
        console.error(e);
        throw e;
    }
};

export const deploy = async () => {
    const logger = new Logger({ useIcons: true });
    renderHeader();
    const config = await getOrCreateConfig();
    const n = new NetlifyAPI(config.netlifyPersonalToken);
    const netlifyAccounts = (await n.listAccountsForUser()).map((a: any) => a.slug);
    inquirer.registerPrompt("suggest", require("inquirer-prompt-suggest"));
    const answers: Answers = (await inquirer.prompt([
        {
            type: "list",
            name: "chainId",
            choices: Object.entries(SUPPORTED_CHAINS).map(([chainId, { friendlyName }]) => ({
                name: friendlyName,
                value: parseInt(chainId),
            })),
            message: "choose a chain",
            loop: false,
        },
        {
            type: "suggest",
            name: "deploymentName",
            message: "Enter a name for your deployment:",
            suggestions: [
                "Fast game",
                "Custom ZKD: no gold generator",
                "PartyDAO custom game (must hold token to enter)",
                "DoTA",
                "HackCambridge 2021",
            ],
            validate: (i) => {
                if (i.length < 4) {
                    return "invalid: 4 characters minimum";
                }
                return true;
            },
        },
        {
            type: "list",
            message: "do you want to deploy contracts?",
            choices: [
                { name: "Yes", value: true },
                { name: "No", value: false },
            ],
            name: "deployContracts",
        },
        {
            type: "list",
            message: "do you want to deploy your client?",
            choices: [
                { name: "Yes", value: true },
                { name: "No", value: false },
            ],
            name: "deployClient",
            validate: (i) => {
                if (!!i && config.netlifyPersonalToken.length === 0) {
                    return "you don't have a netlify api token. can't deploy clients using the cli.";
                }
            },
        },
        {
            type: "list",
            message: "from which netlify account?",
            choices: netlifyAccounts,
            name: "netlifySlug",
            when: (answers) => answers.deployClient,
        },
        {
            type: "input",
            name: "clientUrl",
            message: "url of client",
            when: (answers) => !answers.deployClient,
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
    ])) as Answers;
    const id = v4().substring(0, 6);
    const tempFolder = createTempFolder(id);
    console.log();
    console.log(chalk.yellow(`>> deploying ${chalk.bgYellow.black.bold(" " + answers.deploymentName + " ")} <<`));
    const wallet = ethers.Wallet.fromMnemonic(config.deployerMnemonic);
    console.log(chalk.red(`deployer address: ${chalk.bgYellow.black.bold(" " + wallet.address + " ")}`));
    console.log();
    const { network, friendlyName, rpcUrl } = SUPPORTED_CHAINS[answers.chainId];

    let deployedDiamondAddress;
    let deployedSiteUrl;

    try {
        const tasks = new Listr([
            {
                title: "Client",
                task: () => {
                    return new Listr(
                        [
                            {
                                title: "Checking ABIs",
                                task: async (ctx) => {
                                    const compatible = await checkIfClientIsCompatible(answers.clientUrl!, tempFolder);
                                    if (!compatible) {
                                        throw new Error(
                                            "client (" + answers.clientUrl + ") is incompatible with current ABI"
                                        );
                                    }
                                },
                                skip: () => answers.deployClient || !answers.clientUrl,
                            },
                            {
                                title: "Building client",
                                task: async (ctx, task) => {
                                    const time = Date.now();
                                    task.output = "Building local client...";
                                    const child = execa("yarn", ["workspace", "client", "build"]);
                                    await child;
                                    const duration = Date.now() - time;
                                    task.output = "Client built in " + Math.round(duration / 1000) + "s";
                                    await sleep(2000);
                                },
                                skip: () => !answers.deployClient,
                                options: { bottomBar: 3 },
                            },
                            {
                                title: "Creating new netlify site",
                                task: async (ctx, task) => {
                                    const site = await n.createSite({
                                        body: {
                                            name: `ember-deployment-${wallet.address.substr(2, 8)}-${id}`,
                                            account_slug: answers.netlifySlug!,
                                            ssl: true,
                                            force_ssl: true,
                                        },
                                    });
                                    ctx.siteId = site.id;
                                    ctx.siteUrl = site.ssl_url;
                                    task.output = "Netlify site created with id: " + chalk.bgYellow.black(site.id);
                                    deployedSiteUrl = site.ssl_url
                                    await sleep(2000);
                                },
                                skip: () => !answers.deployClient || !answers.netlifySlug,
                                options: { bottomBar: 1 },
                            },
                            {
                                title: "Deploying to netlify",
                                task: async (ctx, task) => {
                                    const child = execa(
                                        "yarn",
                                        ["workspace", "client", "run", "netlify", "deploy", "--prod"],
                                        {
                                            env: {
                                                NETLIFY_AUTH_TOKEN: config.netlifyPersonalToken,
                                                NETLIFY_SITE_ID: ctx.siteId,
                                            },
                                        }
                                    );
                                    child.stdout?.pipe(task.stdout());
                                    await child;
                                    task.output = chalk.yellow("Netlify site deployed!");
                                    await sleep(2000);
                                },
                                skip: () => !answers.deployClient,
                                options: { bottomBar: 3 },
                            },
                        ],
                        { concurrent: false }
                    );
                },
            },
            {
                title: "Contracts",
                task: () => {
                    return new Listr(
                        [
                            {
                                title: "Funding",
                                task: async (ctx, task) => {
                                    const balance = await getBalance(wallet.address, rpcUrl);
                                    if (balance.lt(MIN_BALANCE)) {
                                        task.output = chalk.yellow("Requesting funds from faucet...");
                                        await getFund(wallet.address);
                                        task.output = chalk.yellow("Funds dripped");
                                        await sleep(2000);
                                    } else {
                                        task.output = chalk.yellow("No need for funding");
                                    }
                                },
                                skip: () => !answers.deployContracts,
                                options: { bottomBar: 3 },
                            },
                            {
                                title: "Deploying to chain",
                                task: async (ctx, task) => {
                                    const child = execa(
                                        "yarn",
                                        ["workspace", "eth", "hh-deploy", "--network", network, "--reset"],
                                        {
                                            env: {
                                                DEPLOYER_MNEMONIC: config.deployerMnemonic,
                                            },
                                        }
                                    );
                                    child.stdout?.pipe(task.stdout());
                                    const { stderr } = await child;
                                    const lines = stderr.split("\n");
                                    const diamondAddress = lines[lines.length - 1];
                                    ctx.diamondAddress = diamondAddress;
                                    task.output = chalk.yellow(
                                        "Universe deployed at: " +
                                        chalk.bgYellow.black(diamondAddress) +
                                        " on chain: " +
                                        chalk.bgYellow.black(friendlyName) +
                                        "!"
                                    );
                                    deployedDiamondAddress = diamondAddress;
                                    await sleep(2000);
                                },
                                skip: () => !answers.deployContracts,
                                options: { bottomBar: 3 },
                            },
                            // {
                            //     title: "Uploading artifacts to IPFS",
                            //     task: async (ctx, task) => {
                            //         const log = (s: string) => (task.output = s);
                            //         const cid = await uploadArtifactsToIpfs(config.web3StorageKey, network, log);
                            //         task.output = chalk.yellow(
                            //             "Artifacts uploaded to IPFS with CID: " + chalk.bgYellow.black(cid)
                            //         );
                            //         ctx.cid = cid;
                            //         await sleep(2000);
                            //         await deleteArtifacts(network);
                            //     },
                            //     options: { bottomBar: 3 },
                            // },
                            // {
                            //     title: "Adding to registry",
                            //     task: async (ctx, task) => {
                            //         const registryContract = getRegistry(
                            //             config.registryAddress,
                            //             config.registryRpc,
                            //             wallet
                            //         );
                            //         task.output = chalk.blue("sending a tx to the registry...");
                            //         const tx = await registryContract.createDeployment({
                            //             artifactCid: ctx.cid,
                            //             name: answers.deploymentName,
                            //             chainId: answers.chainId,
                            //             clientUrl: answers.clientUrl ? answers.clientUrl : ctx.siteUrl,
                            //             diamondAddress: ctx.diamondAddress,
                            //         });
                            //         task.output = "tx submitted. hash: " + tx.hash;
                            //         const r = await tx.wait();
                            //         if (r.status === 0) {
                            //             throw new Error("tx reverted");
                            //         }
                            //         task.output = chalk.yellow("tx confirmed! block hash: ", r.blockHash);
                            //         await sleep(2000);
                            //     },
                            //     options: { bottomBar: 3 },
                            // },
                        ],
                        { concurrent: false }
                    );
                },
            },
        ]);
        await tasks.run();
        console.log();
        console.log(chalk.bgGreen.black.bold(" Congratulation! Ember has been deployed "));
        console.log();
        if (answers.deployContracts) {
            console.log(
                chalk.green(
                    "It will be visible on the registry with name " + '"' + chalk.bold(answers.deploymentName) + '"' + " and diamondAddress at " + '"' + chalk.bold(deployedDiamondAddress) + '"'
                )
            );
        }
        if (answers.deployClient) {
            console.log(
                chalk.green(
                    "Frontend is accessible at " + '"' + chalk.bold(deployedSiteUrl) + '"'
                )
            );
        }
        console.log();
    } catch (e) {
        logger.fail((e as Error).message);
    } finally {
        deleteTempFolder(id);
    }
    exit(0);
};
