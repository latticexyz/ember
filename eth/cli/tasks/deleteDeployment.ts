const NetlifyAPI = require("netlify");
import chalk from "chalk";
import { cli } from "cli-ux";
import { ethers } from "ethers";
import inquirer from "inquirer";
import { Listr, Logger } from "listr2";
import { exit } from "process";
import { getOrCreateConfig } from "../utils/config";
import { renderHeader, sleep } from "../utils/misc";
import { getDeployments, getRegistry } from "../utils/registry";

export const deleteDeployment = async () => {
  const logger = new Logger({ useIcons: true });
  renderHeader();
  const config = await getOrCreateConfig();
  const n = new NetlifyAPI(config.netlifyPersonalToken);
  const wallet = ethers.Wallet.fromMnemonic(config.deployerMnemonic);
  const deployments = (await getDeployments(config.registryAddress, config.registryRpc)).filter(
    (d) => d.deployer === wallet.address
  );
  const answers = await inquirer.prompt([
    {
      type: "list",
      name: "deploymentId",
      choices: deployments.map((d) => ({ name: d.name, value: d.deploymentId })),
      message: "choose a deployment to delete",
      loop: false,
    },
  ]);
  const deployment = deployments.filter((d) => d.deploymentId === answers.deploymentId)[0];
  const { name: deploymentName, clientUrl } = deployment;
  const confirm = await cli.confirm("Are you sure you want to delete " + deploymentName + "?");
  if (!confirm) {
    process.exit(0);
  }
  let deleteNetlifySite: string | undefined;
  if (clientUrl.includes("netlify") && config.netlifyPersonalToken.length > 0) {
    const sites = await n.listSites({
      filter: "owner",
    });
    const site = sites.filter((s: any) => s.ssl_url === clientUrl)[0];
    if (site) {
      const answers = await inquirer.prompt([
        {
          type: "list",
          message: "do you want to also delete the netlify deployment? (id: " + site.id + ")",
          choices: [
            { name: "Yes", value: true },
            { name: "No", value: false },
          ],
          name: "deleteNetlifySite",
        },
      ]);
      if (answers.deleteNetlifySite) {
        deleteNetlifySite = site.id;
      }
    }
  }
  console.log(chalk.red(`>> deleting ${chalk.bgRed.black.bold(" " + deploymentName + " ")} <<`));
  console.log();
  try {
    const tasks = new Listr([
      {
        title: "Deleting",
        task: () => {
          return new Listr(
            [
              {
                title: "Delete netlify deployment",
                task: async (ctx, task) => {
                  await n.deleteSite({
                    site_id: deleteNetlifySite,
                  });
                  task.output = chalk.red("Netlify site deleted");
                  await sleep(2000);
                },
                skip: !deleteNetlifySite,
              },
              {
                title: "Deleting from registry",
                task: async (ctx, task) => {
                  const registryContract = getRegistry(config.registryAddress, config.registryRpc, wallet);
                  task.output = chalk.blue("sending a tx to the registry...");
                  const tx = await registryContract.deleteDeployment(answers.deploymentId);
                  task.output = "tx submitted. hash: " + tx.hash;
                  const r = await tx.wait();
                  if (r.status === 0) {
                    throw new Error("tx reverted");
                  }
                  task.output = chalk.yellow("tx confirmed! block hash: ", r.blockHash);
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
    console.log(chalk.bgRed.black.bold(" Your deployment has been deleted "));
    console.log();
    console.log(chalk.red("It will not be visible on the registry anymore (however players can still play)"));
    console.log();
  } catch (e) {
    logger.fail((e as Error).message);
  }
  exit(0);
};
