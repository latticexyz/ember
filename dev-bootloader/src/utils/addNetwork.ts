import { BigNumber } from "@ethersproject/bignumber";
import { hexStripZeros } from "@ethersproject/bytes";
import { Provider } from "@web3-react/types";
import { ChainInfo, SupportedChainId } from "../chains";

interface AddNetworkArguments {
  provider: Provider;
  chainId: SupportedChainId;
  info: ChainInfo;
}

// provider.request returns Promise<any>, but wallet_switchEthereumChain must return null or throw
// see https://github.com/rekmarks/EIPs/blob/3326-create/EIPS/eip-3326.md for more info on wallet_switchEthereumChain
export async function addNetwork({ provider, chainId, info }: AddNetworkArguments): Promise<null | void> {
  if (!provider?.request) {
    return;
  }
  const formattedChainId = hexStripZeros(BigNumber.from(chainId).toHexString());
  try {
    await provider.request({
      method: "wallet_addEthereumChain",
      params: [
        {
          chainId: formattedChainId,
          chainName: info.label,
          rpcUrls: [info.rpcUrl],
          nativeCurrency: info.nativeCurrency,
          blockExplorerUrls: [info.explorer],
        },
      ],
    });
  } catch (error) {
    console.error("error adding eth network: ", chainId, info, error);
    throw error;
  }
}
