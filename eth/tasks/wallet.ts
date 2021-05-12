import { task, types } from "hardhat/config";
import { HardhatRuntimeEnvironment } from "hardhat/types";

task("wallet:new", "generate a new wallet mnemonic").setAction(walletNew);

async function walletNew({}, hre: HardhatRuntimeEnvironment) {
    const mnemonic = await hre.ethers.utils.entropyToMnemonic(hre.ethers.utils.randomBytes(16));
    const wallet = hre.ethers.Wallet.fromMnemonic(mnemonic);
    // console.log("mnemonic:", mnemonic);
    // console.log("address:", wallet.address);
    // console.log("privateKey: ", wallet.privateKey);
}

task("wallet:info", "show deployer wallet public address and balance").setAction(walletInfo);

async function walletInfo({}, hre: HardhatRuntimeEnvironment) {
    const [deployer] = await hre.ethers.getSigners();

    // console.log("address:", deployer.address);
    const balance = await hre.ethers.provider.getBalance(deployer.address);
    // console.log("balance:", hre.ethers.utils.formatEther(balance));
}

task("wallet:fund", "send the native currency of this chain (ETH on mainnet, xDAI on xDAI chain)")
    .addParam("to", "receiver address", undefined, types.string)
    .addParam("value", "value to send (in units of ETH/xDAI)", undefined, types.string)
    .addParam(
        "dry",
        "dry run only (doesn't carry out transaction, just verifies that it's valid). default: true",
        true,
        types.boolean
    )
    .setAction(fundValue);

async function fundValue(args: { to: string; value: string; dry: boolean }, hre: HardhatRuntimeEnvironment) {
    const toIsAddress = hre.ethers.utils.isAddress(args.to);
    if (!toIsAddress) {
        throw new Error(`TO address ${args.to} is NOT a valid address.`);
    }

    const { deployer: sender } = await hre.ethers.getNamedSigners();

    const parsedValue = hre.ethers.utils.parseEther(args.value);
    const balance = await sender.getBalance();

    if (balance.lt(parsedValue)) {
        throw new Error(
            `${sender.address} trying to send ~$${hre.ethers.utils.formatEther(
                parsedValue
            )} but has ${hre.ethers.utils.formatEther(balance)}. top up and rerun`
        );
    }

    // console.log(`[${hre.network.name}] Sending ${args.value} from ${sender.address} to ${args.to}`);

    if (!args.dry) {
        await sender.sendTransaction({
            to: args.to,
            value: parsedValue,
        });
    } else {
        // console.log('Dry run successful; exiting without performing transaction. Run with "--dry false" to execute tx');
    }
}

task("wallet:send", "send the native currency of this chain (ETH on mainnet, xDAI on xDAI chain)")
    .addParam("from", "sender address", undefined, types.string)
    .addParam("to", "receiver address", undefined, types.string)
    .addParam("value", "value to send (in units of ETH/xDAI)", undefined, types.string)
    .addParam(
        "dry",
        "dry run only (doesn't carry out transaction, just verifies that it's valid). default: true",
        true,
        types.boolean
    )
    .setAction(sendValue);

async function sendValue(
    args: { from: string; to: string; value: string; dry: boolean },
    hre: HardhatRuntimeEnvironment
) {
    const toIsAddress = hre.ethers.utils.isAddress(args.to);
    if (!toIsAddress) {
        throw new Error(`TO address ${args.to} is NOT a valid address.`);
    }
    const fromIsAddress = hre.ethers.utils.isAddress(args.from);
    if (!fromIsAddress) {
        throw new Error(`FROM address ${args.from} is NOT a valid address.`);
    }

    const accounts = await hre.ethers.getSigners();
    const sender = accounts.filter((account) => account.address.toLowerCase() === args.from.toLowerCase())[0];
    if (!sender) {
        throw new Error(`FROM address ${args.from} not found in local wallet! Check your hardhat.config file`);
    }

    const parsedValue = hre.ethers.utils.parseEther(args.value);
    const balance = await sender.getBalance();

    if (balance.lt(parsedValue)) {
        throw new Error(
            `${sender.address} trying to send ~$${hre.ethers.utils.formatEther(
                parsedValue
            )} but has ${hre.ethers.utils.formatEther(balance)}. top up and rerun`
        );
    }

    // console.log(`[${hre.network.name}] Sending ${args.value} from ${sender.address} to ${args.to}`);

    if (!args.dry) {
        await sender.sendTransaction({
            to: args.to,
            value: parsedValue,
        });
    } else {
        // console.log('Dry run successful; exiting without performing transaction. Run with "--dry false" to execute tx');
    }
}
