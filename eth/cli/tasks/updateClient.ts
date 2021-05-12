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
    clientUrl: string | undefined;
    netlifySlug: string | undefined;
}

export const updateClient = async () => {
    const logger = new Logger({ useIcons: true });
    renderHeader();
    const config = await getOrCreateConfig();
    const n = new NetlifyAPI(config.netlifyPersonalToken);
    const netlifyAccounts = (await n.listAccountsForUser()).map((a: any) => a.slug);
    inquirer.registerPrompt("suggest", require("inquirer-prompt-suggest"));
    const answers: Answers = (await inquirer.prompt([
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
    try {
        const tasks = new Listr([
            {
                title: "Client",
                task: () => {
                    return new Listr(
                        [
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

                                options: { bottomBar: 3 },
                            },
                            {
                                title: "Finding netlify site id",
                                task: async (ctx, task) => {
                                    const sites = await n.listSites({
                                        filter: "owner",
                                    });
                                    const site = sites.filter((s: any) => s.ssl_url === answers.clientUrl)[0];
                                    ctx.siteId = site.id;
                                    ctx.siteUrl = site.ssl_url;
                                },
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
                                options: { bottomBar: 3 },
                            },
                        ],
                        { concurrent: false }
                    );
                },
            },
        ]);
        await tasks.run();
        console.log();
        console.log(chalk.bgGreen.black.bold(" Congratulation! Your client has been updated"));
        console.log();
        console.log();
        console.log();
    } catch (e) {
        logger.fail((e as Error).message);
    } finally {
    }
    exit(0);
};
