import "./type-extensions";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import * as ethers from "ethers";
import { HardhatUserConfig, extendEnvironment } from "hardhat/config";
import "hardhat-deploy";
import "@nomiclabs/hardhat-ethers";
import "@typechain/hardhat";
import "@nomiclabs/hardhat-waffle";
import "hardhat-gas-reporter";
import "hardhat-contract-sizer";
import { lazyObject } from "hardhat/plugins";
import "./tasks/wallet";
import "./tasks/abi";
import "./tasks/config";
import "./tasks/paymaster";
import "./tasks/bank";
import "./tasks/impersonate";
import * as settings from "./settings";

const { DEPLOYER_MNEMONIC } = process.env;

extendEnvironment((env: HardhatRuntimeEnvironment) => {
    env.DEPLOYER_MNEMONIC = DEPLOYER_MNEMONIC;
    env.initializers = lazyObject(() => {
        let environment: settings.EnvironmentString = "local";
        if (env.network.live) {
            environment = "prod";
        } else if (process.argv.includes("test")) {
            environment = "test";
        }
        const { initializers = {} } = settings.load(environment);
        return settings.parse(settings.Initializers, initializers);
    });
});

const xdai = {
    url: "https://rpc.xdaichain.com/",
    accounts: {
        mnemonic: DEPLOYER_MNEMONIC,
    },
    chainId: 100,
};

const arbitrum = {
    url: "https://arbitrum.xdaichain.com/",
    accounts: {
        mnemonic: DEPLOYER_MNEMONIC,
    },
    chainId: 200,
};

const optimism = {
    url: "https://optimism.gnosischain.com",
    accounts: {
        mnemonic: DEPLOYER_MNEMONIC,
    },
    chainId: 300,
};

const arbitrumTestnet = {
    url: "https://rinkeby.arbitrum.io/rpc",
    accounts: {
        mnemonic: DEPLOYER_MNEMONIC,
    },
    chainId: 421611,
};

const optimisticKovan = {
    url: "https://kovan.optimism.io",
    accounts: {
        mnemonic: DEPLOYER_MNEMONIC,
    },
    chainId: 69,
};

const testnet = {
    url: "https://miner.testnet-chain.linfra.xyz",
    accounts: {
        mnemonic: DEPLOYER_MNEMONIC,
    },
    chainId: 4242,
    gasPrice: 300000,
};

const config: HardhatUserConfig = {
    defaultNetwork: "hardhat",
    namedAccounts: {
        deployer: 0, // first skey derived from the hd wallet
        user1: 1,
        user2: 2,
    },
    networks: {
        // Check for a DEPLOYER_MNEMONIC before we add xdai network to the list of networks
        // If you try to deploy to xdai without DEPLOYER_MNEMONIC, you'll see this error:
        // > Error HH100: Network xdai doesn't exist
        ...(DEPLOYER_MNEMONIC ? { xdai } : undefined),
        ...(DEPLOYER_MNEMONIC ? { arbitrum } : undefined),
        ...(DEPLOYER_MNEMONIC ? { optimism } : undefined),
        ...(DEPLOYER_MNEMONIC ? { arbitrumTestnet } : undefined),
        ...(DEPLOYER_MNEMONIC ? { optimisticKovan } : undefined),
        ...(DEPLOYER_MNEMONIC ? { testnet } : undefined),
        // this is when connecting to a localhost hh instance, it doesn't actually configure the hh network. for this setup stuff in the 'hardhat' key.
        localhost: {
            url: "http://localhost:8545/",
            accounts: [
                "0x044C7963E9A89D4F8B64AB23E02E97B2E00DD57FCB60F316AC69B77135003AEF",
                "0x523170AAE57904F24FFE1F61B7E4FF9E9A0CE7557987C2FC034EACB1C267B4AE",
                "0x67195c963ff445314e667112ab22f4a7404bad7f9746564eb409b9bb8c6aed32",
            ],
            chainId: 31337,
        },
        hardhat: {
            mining: {
                auto: false,
                interval: 1000,
            },
            gasPrice: 0,
            initialBaseFeePerGas: 0,
            blockGasLimit: 16777215,
            accounts: [
                // from/deployer is default the first address in accounts
                {
                    privateKey: "0x044C7963E9A89D4F8B64AB23E02E97B2E00DD57FCB60F316AC69B77135003AEF",
                    balance: "100000000000000000000",
                },
                // user1 in tests
                {
                    privateKey: "0x523170AAE57904F24FFE1F61B7E4FF9E9A0CE7557987C2FC034EACB1C267B4AE",
                    balance: "100000000000000000000",
                },
                // user2 in tests
                {
                    privateKey: "0x67195c963ff445314e667112ab22f4a7404bad7f9746564eb409b9bb8c6aed32",
                    balance: "100000000000000000000",
                },
            ],
        },
    },
    solidity: {
        version: "0.7.6",
        settings: {
            optimizer: {
                enabled: true,
                runs: 200,
            },
        },
    },
    external: {
        contracts: [
            {
                artifacts: "../node_modules/@latticexyz/registry/dist/artifacts/LatticeRegistry.sol",
            },
        ],
    },
    deterministicDeployment: {
        200: {
            factory: "0xdbccbc7d9d9bf946d28b6148962dc01f1e6e0b5b",
            deployer: "0xb6cb5e842e0b593efe95c543ab3a026662d53366",
            funding: ethers.BigNumber.from(100000000).mul(30000000).toString(),
            signedTx:
                "0xf8a5808405f5e1008401c9c3808080b853604580600e600039806000f350fe7fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe03601600081602082378035828234f58015156039578182fd5b8082525050506014600cf31ba02222222222222222222222222222222222222222222222222222222222222222a02222222222222222222222222222222222222222222222222222222222222222",
        },
        300: {
            factory: "0x41e83a26c0e8d8bba5c6126d8ee47e8781cf9a89",
            deployer: "0xe48eb613942f3c8878b5d2b397ab0008f75f0be2",
            funding: ethers.BigNumber.from(100000000).mul(60000000).toString(),
            signedTx:
                "0xf8a380830f4240830186a08080b853604580600e600039806000f350fe7fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe03601600081602082378035828234f58015156039578182fd5b8082525050506014600cf31ba02222222222222222222222222222222222222222222222222222222222222222a02222222222222222222222222222222222222222222222222222222222222222",
        },
        421611: {
            factory: "0xdbccbc7d9d9bf946d28b6148962dc01f1e6e0b5b",
            deployer: "0xb6cb5e842e0b593efe95c543ab3a026662d53366",
            funding: ethers.BigNumber.from(100000000).mul(30000000).toString(),
            signedTx:
                "0xf8a5808405f5e1008401c9c3808080b853604580600e600039806000f350fe7fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe03601600081602082378035828234f58015156039578182fd5b8082525050506014600cf31ba02222222222222222222222222222222222222222222222222222222222222222a02222222222222222222222222222222222222222222222222222222222222222",
        },
    },
};

export default config;
