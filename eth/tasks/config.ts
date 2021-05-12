import { task } from "hardhat/config";
import { HardhatRuntimeEnvironment } from "hardhat/types";

task("config:get-local", "dump local config").setAction(getLocalConfig);
task("config:set", "set config").setAction(setConfig);
task("config:set-paused", "set paused").setAction(setPaused).addParam("paused");
task("config:set-trusted-forwarder", "set the trusted forwarder").setAction(setTrustedForwarder);

async function getLocalConfig({}, hre: HardhatRuntimeEnvironment) {
    // console.log(hre.initializers)
}

async function setPaused({ paused: p }: { paused: string }, hre: HardhatRuntimeEnvironment) {
    try {
        const paused = p == "true" ? true : false;
        await hre.deployments.all();
        const { deployer } = await hre.getNamedAccounts();
        const configFacet = await hre.ethers.getContract("Diamond", deployer);
        console.log("setting paused to: ", paused);
        //@ts-ignore
        const receipt = await configFacet.setPaused(paused, {
            gasPrice: hre.ethers.BigNumber.from(10 ** 9),
            gasLimit: 200000,
        });
        console.log(`tx hash: ${receipt.hash}`);
        const confirmation = await receipt.wait();
        console.log(`block hash: ${confirmation.blockHash}. gas used: ${confirmation.gasUsed}`);
    } catch (e) {
        console.error(e);
    }
}

async function setConfig({}, hre: HardhatRuntimeEnvironment) {
    await hre.deployments.all();
    const { deployer } = await hre.getNamedAccounts();
    const configFacet = await hre.ethers.getContract("Diamond", deployer);
    //@ts-ignore
    const receipt = await configFacet.initialize(hre.initializers, {
        gasPrice: hre.ethers.BigNumber.from(10 ** 9),
        gasLimit: 1000000,
    });
    // console.log(`tx hash: ${receipt.hash}`)
    const confirmation = await receipt.wait();
    // console.log(`block hash: ${confirmation.blockHash}. gas used: ${confirmation.gasUsed}`)
}

async function setTrustedForwarder({}, hre: HardhatRuntimeEnvironment) {
    let trustedForwarder: string;
    if (hre.network.name === "xdai") {
        trustedForwarder = "0x7eEae829DF28F9Ce522274D5771A6Be91d00E5ED";
    } else {
        trustedForwarder = require("../build/gsn/Forwarder.json").address;
    }
    await hre.deployments.all();
    const { deployer } = await hre.getNamedAccounts();
    const contract = await hre.ethers.getContract("Diamond", deployer);
    await contract.setTrustedForwarder(trustedForwarder);
    // console.log("Succesfully set the trusted forwarder of the diamond to", trustedForwarder);
}
