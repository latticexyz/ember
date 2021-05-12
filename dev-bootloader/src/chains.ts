export enum SupportedChainId {
  HARDHAT = 31337,
  AOX = 200,
  OOG = 300,
  ARBITRUM_TESTNET = 421611,
  OPTIMISTIC_KOVAN = 69,
  TESTNET = 4242,
}

export const ALL_SUPPORTED_CHAIN_IDS: SupportedChainId[] = [SupportedChainId.HARDHAT, SupportedChainId.AOX, SupportedChainId.TESTNET];

export interface ChainInfo {
  readonly explorer: string;
  readonly label: string;
  readonly rpcUrl: string;
  readonly nativeCurrency: {
    name: string; // 'Goerli ETH',
    symbol: string; // 'gorETH',
    decimals: number; //18,
  };
}

export const CHAIN_INFO: { [key in SupportedChainId]: ChainInfo } = {
  [SupportedChainId.AOX]: {
    explorer: "https://blockscout.com/xdai/aox/",
    label: "Arbitrum on xDai (AoX)",
    nativeCurrency: { name: "xDai", symbol: "XDAI", decimals: 18 },
    rpcUrl: "https://arbitrum.xdaichain.com",
  },
  [SupportedChainId.OOG]: {
    explorer: "https://blockscout.com/xdai/optimism/",
    label: "Optimism on Gnosis Chain",
    nativeCurrency: { name: "xDai", symbol: "XDAI", decimals: 18 },
    rpcUrl: "https://optimism.gnosischain.com",
  },
  [SupportedChainId.ARBITRUM_TESTNET]: {
    explorer: "https://blockscout.com/xdai/aox/",
    label: "Arbitrum Testnet",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrl: "https://rinkeby.arbitrum.io/rpc",
  },
  [SupportedChainId.OPTIMISTIC_KOVAN]: {
    explorer: "https://blockscout.com/xdai/aox/",
    label: "Optimistic Kovan",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrl: "https://kovan.optimism.io",
  },
  [SupportedChainId.HARDHAT]: {
    explorer: "https://blockscout.com/xdai/aox/",
    label: "Hardhat",
    nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
    rpcUrl: "http://localhost:8545",
  },
  [SupportedChainId.TESTNET]: {
    explorer: "https://explorer.testnet-chain.linfra.xyz/",
    label: "Testnet",
    nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
    rpcUrl: "https://miner.testnet-chain.linfra.xyz",
  },
};

export const CHAIN_ID_TO_RPC: { [key in SupportedChainId]: string } = {
  31337: "http://localhost:8545",
  200: "https://arbitrum.xdaichain.com",
  300: "https://optimism.gnosischain.com",
  421611: "https://rinkeby.arbitrum.io/rpc",
  69: "https://kovan.optimism.io",
  4242: "https://miner.testnet-chain.linfra.xyz",
};
