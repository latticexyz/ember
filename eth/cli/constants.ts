export const SUPPORTED_CHAINS: { [key: number]: { network: string; friendlyName: string; rpcUrl: string } } = {
    200: {
        friendlyName: "AoX (Arbitrum on xDai)",
        network: "arbitrum",
        rpcUrl: "https://arbitrum.xdaichain.com",
    },
    300: {
        friendlyName: "Optimism on xDai",
        network: "optimism",
        rpcUrl: "https://optimism.gnosischain.com",
    },
    69: {
        friendlyName: "Optimistic Kovan",
        network: "optimisticKovan",
        rpcUrl: "https://kovan.optimism.io",
    },
    421611: {
        friendlyName: "Arbitrum Tesnet",
        network: "arbitrumTestnet",
        rpcUrl: "https://rinkeby.arbitrum.io/rpc",
    },
    4242: {
        friendlyName: "Lattice Testnet",
        network: "testnet",
        rpcUrl: "https://miner.testnet-chain.linfra.xyz"
    }
};
