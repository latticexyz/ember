import { ethers } from "ethers";

export const getBalance = (address: string, rpcUrl: string) => {
    const rpc = new ethers.providers.JsonRpcProvider(rpcUrl);
    return rpc.getBalance(address);
};
