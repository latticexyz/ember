import { ethers } from "ethers";
import artifacts from "@latticexyz/registry/dist/artifacts/LatticeRegistry.sol/LatticeRegistry.json";
import { LatticeRegistry } from "@latticexyz/registry/dist/typechain/LatticeRegistry";
import { callWithRetry } from "./misc";

export const getRegistry = (address: string, rpcUrl: string, wallet?: ethers.Wallet) => {
    const rpc = new ethers.providers.JsonRpcProvider(rpcUrl);
    if (wallet) {
        const signer = wallet.connect(rpc);
        return new ethers.Contract(address, artifacts.abi, signer) as unknown as LatticeRegistry;
    } else {
        return new ethers.Contract(address, artifacts.abi, rpc) as unknown as LatticeRegistry;
    }
};

export const getDeployments = async (registryAddress: string, rpcUrl: string) => {
    const registry = getRegistry(registryAddress, rpcUrl);
    const numberOfDeployments = (await callWithRetry<ethers.BigNumber>(registry.getNumberOfDeployments, [])).toNumber();
    const deployments = await callWithRetry(registry.bulkGetActiveDeployments, [0, numberOfDeployments]);
    return deployments;
};
