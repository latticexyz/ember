import { task } from "hardhat/config";
import { HardhatRuntimeEnvironment } from "hardhat/types";

task("bank:fund", "fund the bank").setAction(fundBank);
task("bank:get-funds", "get the funds in the bank").setAction(getFunds);
task("bank:get-total-drip", "get the total drip of a player")
    .setAction(getTotalDrip)
    .addParam("account", "The account's address");

async function fundBank({}, hre: HardhatRuntimeEnvironment) {
    await hre.deployments.all();
    const diamond = await hre.ethers.getContract("Diamond");
    const { deployer } = await hre.getNamedAccounts();
    const deployerSigner = await hre.ethers.getSigner(deployer);
    const value = hre.ethers.utils.parseEther("0.10");
    console.log("Sending " + hre.ethers.utils.formatEther(value) + " to the diamond...");
    const receipt = await deployerSigner.sendTransaction({
        to: diamond.address,
        value,
        gasPrice: hre.ethers.BigNumber.from(2 * 10 ** 9),
        gasLimit: 21000,
    });
    console.log(receipt.hash);
}

async function getTotalDrip({ account }: { account: string }, hre: HardhatRuntimeEnvironment) {
    if (!account || account.length === 0) {
        throw new Error("no address");
    }
    await hre.deployments.all();
    const { user1 } = await hre.getNamedAccounts();
    const bankFacet = await hre.ethers.getContract("Diamond", user1);
    const drip = await bankFacet.getTotalDrip(account);
    console.log({
        drip: hre.ethers.utils.formatEther(drip),
    });
}

async function getFunds({}, hre: HardhatRuntimeEnvironment) {
    await hre.deployments.all();
    const diamond = await hre.ethers.getContract("Diamond");
    const diamondSigner = new hre.ethers.VoidSigner(diamond.address, hre.ethers.provider);
    console.log({
        funds: hre.ethers.utils.formatEther(await diamondSigner.getBalance()),
    });
}
