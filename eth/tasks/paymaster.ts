import { task } from "hardhat/config";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { Contract } from "@ethersproject/contracts";

task("paymaster:deploy", "deploy paymaster").setAction(deploy);
task("paymaster:whitelist", "whitelist the diamond on the paymaster").setAction(whitelist);
task("paymaster:setup", "setup the paymaster").setAction(setup);
task("paymaster:fund", "fund the paymaster").setAction(fund);

async function deploy({}, hre: HardhatRuntimeEnvironment) {
    await hre.deployments.all();
    const { deployments, getNamedAccounts } = hre;
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();
    const d = await deploy("Paymaster", {
        from: deployer,
        log: true,
        deterministicDeployment: true,
        // 1 gwei
        gasPrice: hre.ethers.BigNumber.from(10 ** 9),
    });
    const signer = await hre.ethers.getSigner(deployer);
    const contract = new Contract(d.address, d.abi, signer);
    if ((await contract.owner()) === hre.ethers.constants.AddressZero) {
        // console.log("Setting the deployer as the owner for the paymaster contract...");
        await contract.setOwner(deployer, {
            gasPrice: hre.ethers.BigNumber.from(10 ** 9),
        });
    }
    // console.log("Succesfully deployed paymaster at " + d.address);
}

async function setup({}, hre: HardhatRuntimeEnvironment) {
    let forwarder;
    let relayHub;
    if (hre.network.name === "xdai") {
        // from https://docs.opengsn.org/contracts/addresses.html#xdai-network
        forwarder = "0x7eEae829DF28F9Ce522274D5771A6Be91d00E5ED";
        relayHub = "0x727862794bdaa3b8Bc4E3705950D4e9397E3bAfd";
    } else {
        forwarder = require("../build/gsn/Forwarder").address;
        relayHub = require("../build/gsn/RelayHub").address;
    }
    await hre.deployments.all();
    const { deployments, getNamedAccounts } = hre;
    const paymaster = await deployments.get("Paymaster");
    const { deployer } = await getNamedAccounts();
    const signer = await hre.ethers.getSigner(deployer);
    const address = paymaster.address;
    const contract = new Contract(address, paymaster.abi, signer);
    const currentTrustedForwader = await contract.trustedForwarder();
    if (currentTrustedForwader !== forwarder) {
        // console.log("Current trusted forwarder: ", currentTrustedForwader);
        // console.log("Setting trusted forwarder to", forwarder);
        const trustedForwarderReceipt = await contract.setTrustedForwarder(forwarder, {
            gasPrice: hre.ethers.BigNumber.from(10 ** 9 + 1),
        });
        // console.log(trustedForwarderReceipt.hash);
    } else {
        // console.log("The trusted forwarder is already ", forwarder)
    }
    // console.log("Setting relay hub to", relayHub);
    const relayHubReceipt = await contract.setRelayHub(relayHub, {
        gasPrice: hre.ethers.BigNumber.from(10 ** 9 + 1),
    });
    // console.log(relayHubReceipt.hash);
    // console.log("Succesfully setup the paymaster");
}

async function whitelist({}, hre: HardhatRuntimeEnvironment) {
    await hre.deployments.all();
    const { deployments, getNamedAccounts } = hre;
    const paymaster = await deployments.get("Paymaster");
    const { deployer } = await getNamedAccounts();
    const signer = await hre.ethers.getSigner(deployer);
    const address = paymaster.address;
    const contract = new Contract(address, paymaster.abi, signer);
    const diamond = await deployments.get("Diamond");
    const receipt = await contract.addTarget(diamond.address, {
        gasPrice: hre.ethers.BigNumber.from(10 ** 9),
    });
    // console.log(receipt.hash);
    // console.log("Succesfully whitelisted diamond in paymaster");
}

async function fund({}, hre: HardhatRuntimeEnvironment) {
    await hre.deployments.all();
    const { deployments, getNamedAccounts } = hre;
    const paymaster = await deployments.get("Paymaster");
    const { deployer } = await getNamedAccounts();
    const signer = await hre.ethers.getSigner(deployer);
    await signer.sendTransaction({
        value: hre.ethers.utils.parseEther("1"),
        to: paymaster.address,
        gasPrice: hre.ethers.BigNumber.from(10 ** 9),
    });
    // console.log("Succesfully funded paymaster");
}
