import { task } from "hardhat/config";
import { HardhatRuntimeEnvironment } from "hardhat/types";

task("impersonate:add", "add an impersonator").setAction(addImpersonation).addParam("pkey1").addParam("pkey2");

async function addImpersonation({ pkey1, pkey2 }: { pkey1: string; pkey2: string }, hre: HardhatRuntimeEnvironment) {
    try {
        await hre.deployments.all();
        const user1 = new hre.ethers.Wallet(pkey1, hre.ethers.provider);
        const user2 = new hre.ethers.Wallet(pkey2, hre.ethers.provider);
        const sig = await user2.signMessage(
            hre.ethers.utils.arrayify(
                hre.ethers.utils.solidityKeccak256(["address", "address"], [user1.address, user2.address])
            )
        );
        const impersonationFacet = await hre.ethers.getContract("Diamond", user1);
        const receipt = await impersonationFacet.allowImpersonation(user2.address, sig, {
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
