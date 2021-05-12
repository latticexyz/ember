import { BankFacet, ConfigFacet, CreaturesFacet, DungeonFacet, GetterFacet } from "../../typechain";
import { EthAddress, TxType } from "../../_types/GlobalTypes";
import Network, { NetworkProps, TxOverrides } from "./Network";
import { JsonRpcProvider, JsonRpcSigner } from "@ethersproject/providers";
import { Wallet, Contract, ethers } from "ethers";
import { CheckedTypeUtils } from "../Utils/CheckedTypeUtils";

export interface GameContracts {
  dungeonFacet: DungeonFacet;
  configFacet: ConfigFacet;
  creaturesFacet: CreaturesFacet;
  getterFacet: GetterFacet;
  bankFacet: BankFacet;
}

const FAUCET = "https://latticeprotocol.vercel.app/api/request";

const ARBITRUM_BRIDGE_ABI = `
[
  {
    "inputs":[
      {
        "internalType":"uint256",
        "name":"maxSubmissionCost",
        "type":"uint256"
      }
    ],
    "name":"depositEth",
    "outputs":[
      {
        "internalType":"uint256",
        "name":"",
        "type":"uint256"
      }
    ],
    "stateMutability":"payable",
    "type":"function"
  }
]
`;

// TODO: Hide this when we open source?
const ALCHEMY_URL = "https://eth-mainnet.alchemyapi.io/v2/Vw9AVRLp9kptZR5URne0zD5UqYrdKKaG";

const createContractsWithConnector = (
  contractABI: any,
  diamondAddress: EthAddress,
  connector: JsonRpcProvider | Wallet,
  gsnSigner?: JsonRpcSigner
): GameContracts => {
  const dungeonFacetABI = contractABI.DungeonFacet.abi as any;
  const creaturesFacetABI = contractABI.CreaturesFacet.abi as any;
  const getterFacetABI = contractABI.GetterFacet.abi as any;
  const configFacetABI = contractABI.ConfigFacet.abi as any;
  const bankFacetABI = contractABI.BankFacet.abi as any;
  const dungeonFacet = new Contract(diamondAddress, dungeonFacetABI, connector) as DungeonFacet;
  const getterFacet = new Contract(diamondAddress, getterFacetABI, connector) as GetterFacet;
  const configFacet = new Contract(diamondAddress, configFacetABI, connector) as ConfigFacet;
  const bankFacet = new Contract(diamondAddress, bankFacetABI, gsnSigner ? gsnSigner : connector) as BankFacet;
  const creaturesFacet = new Contract(diamondAddress, creaturesFacetABI, connector) as CreaturesFacet;
  return {
    dungeonFacet,
    getterFacet,
    configFacet,
    bankFacet,
    creaturesFacet,
  };
};

export const getConfig = async (chainId: number, diamondAddress: EthAddress) => {
  const abisUrl = window.origin + "/public/abi.json";
  const abis = await fetch(abisUrl).then((x) => x.json());
  const configs: { [key: number]: NetworkProps<GameContracts, TxType> } = {
    31337: {
      chainId: 31337,
      chainName: "localhost",
      createContractsWithConnector,
      diamondAddress,
      getFunds: async (address, network): Promise<void> => {
        throw new Error("not implemented");
      },
      featureFlags: {
        // gsn: {
        //   paymasterAddress: CheckedTypeUtils.address("0x22a34b38C3fA1f49010157a9a9B2eEdfE5b4e3e9"),
        //   preferredRelays: [],
        // },
      },
      globalTxOverrides: {
        gasPrice: 0,
      },
      overridesPerTxType: DEV_TX_OVERRIDES,
      loadAbis: () => {
        return abis;
      },
      rpcUrl: "http://localhost:8545",
      mainnetRpc: ALCHEMY_URL,
      rcpSupportsBatchQueries: true,
      time: {
        blockTimestampRefreshInterval: 30,
        resolution: 1,
      },
    },
    // 100: {
    //   chainId: 100,
    //   chainName: "xdai",
    //   createContractsWithConnector,
    //   diamondAddress,
    //   featureFlags: {
    //     gsn: {
    //       paymasterAddress: CheckedTypeUtils.address(""),
    //       preferredRelays: ["https://gsn.zkdungeon.org/gsn1"],
    //     },
    //     gasPriceOracle: {
    //       path: ".average",
    //       refreshInterval: 100,
    //       url: GAS_PRICE_ORACLE_XDAI,
    //     },
    //   },
    //   globalTxOverrides: {
    //     gasPrice: ethers.BigNumber.from(10 ** 9 * 2),
    //   },
    //   overridesPerTxType: XDAI_TX_OVERRIDES,
    //   loadDeployment: () => {
    //     return deployment;
    //   },
    //   rpcUrl: "https://rpc.xdaichain.com",
    //   rpcWsUrl: "wss://rpc.xdaichain.com/wss",
    //   time: {
    //     blockTimestampRefreshInterval: 60,
    //     resolution: 5,
    //   },
    // },
    200: {
      chainId: 200,
      chainName: "arbitrum on gc",
      createContractsWithConnector,
      diamondAddress,
      getFunds: async (address, network): Promise<void> => {
        const dripAmount = await network.contracts.bankFacet.getDripAmount();
        const bankFunds = await network.getBalance(CheckedTypeUtils.address(network.contracts.bankFacet.address));
        if (dripAmount.gt(bankFunds)) {
          // fallback to faucet
          return network.featureFlags.faucet!.getDripFromFaucet(address);
        } else {
          const submit = await network.contracts.bankFacet.dripToPlayer({
            gasLimit: 300000,
          });
          await network.waitForTransaction(submit.hash);
          return;
        }
      },
      featureFlags: {
        faucet: {
          getDripFromFaucet: async (address: EthAddress): Promise<void> => {
            const response = await fetch(FAUCET, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ address, chainId: 200 }),
            });
            const res = await response.text();
            if (res.includes("Not enough fund")) {
              throw new Error("No more funds in the faucet. Error from faucet: " + res);
            }
          },
        },
        bridge: {
          bridge: async (amount, network) => {
            const p = new ethers.providers.JsonRpcProvider("https://rpc.xdaichain.com");
            const bridge = new Contract(
              "0x556c18a6FDcd52562Ec1130212f6113e3F818335",
              ARBITRUM_BRIDGE_ABI,
              network.getSignerWithDifferentProvider("https://rpc.xdaichain.com")
            );
            try {
              const tx = await bridge.depositEth(0, {
                value: amount,
                nonce: await p.getTransactionCount(network.getAddress()),
              });
              if (!tx.hash) {
                throw new Error("no tx hash");
              }
              await tx.wait();
              return tx.hash;
            } catch (e) {
              throw e;
            }
          },
          getL1Balance: async (address: EthAddress) => {
            const p = new ethers.providers.JsonRpcProvider("https://rpc.xdaichain.com");
            const balance = await p.getBalance(address);
            return balance;
          },
        },
      },
      globalTxOverrides: {
        gasPrice: ethers.BigNumber.from(10 ** 7 * 4),
        // gasLimit: 50000000,
      },
      overridesPerTxType: ARBITRUM_TX_OVERRIDES,
      loadAbis: () => {
        return abis;
      },
      rpcUrl: "https://arbitrum.xdaichain.com",
      mainnetRpc: ALCHEMY_URL,
      rcpSupportsBatchQueries: true,
      rpcWsUrl: "wss://arbitrum.xdaichain.com/wss",
      time: {
        blockTimestampRefreshInterval: 0,
        resolution: 30,
      },
    },
    421611: {
      chainId: 421611,
      chainName: "arbitrum testnet",
      createContractsWithConnector,
      diamondAddress,
      getFunds: async (address, network): Promise<void> => {
        const dripAmount = await network.contracts.bankFacet.getDripAmount();
        const bankFunds = await network.getBalance(CheckedTypeUtils.address(network.contracts.bankFacet.address));
        if (dripAmount.gt(bankFunds)) {
          // fallback to faucet
          return network.featureFlags.faucet!.getDripFromFaucet(address);
        } else {
          const submit = await network.contracts.bankFacet.dripToPlayer({
            gasLimit: 300000,
          });
          await network.waitForTransaction(submit.hash);
          return;
        }
      },
      featureFlags: {
        faucet: {
          getDripFromFaucet: async (address: EthAddress): Promise<void> => {
            const response = await fetch(FAUCET, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ address, chainId: 421611 }),
            });
            const res = await response.text();
            if (res.includes("Not enough fund")) {
              throw new Error("No more funds in the faucet. Error from faucet: " + res);
            }
          },
        },
      },
      globalTxOverrides: {
        // gasPrice: ethers.BigNumber.from(10 ** 7 * 4),
        // gasLimit: 50000000,
      },
      overridesPerTxType: ARBITRUM_TX_OVERRIDES,
      loadAbis: () => {
        return abis;
      },
      rpcUrl: "https://arb-rinkeby.g.alchemy.com/v2/tvHuuzZFX9pKqwQbeH1I-d9ffTsLRun_",
      rcpSupportsBatchQueries: true,
      rpcWsUrl: "wss://arb-rinkeby.g.alchemy.com/v2/tvHuuzZFX9pKqwQbeH1I-d9ffTsLRun_",
      mainnetRpc: ALCHEMY_URL,
      time: {
        blockTimestampRefreshInterval: 0,
        resolution: 60,
      },
    },
    69: {
      chainId: 69,
      chainName: "optimistic kovan",
      createContractsWithConnector,
      diamondAddress,
      getFunds: async (address, network): Promise<void> => {
        const dripAmount = await network.contracts.bankFacet.getDripAmount();
        const bankFunds = await network.getBalance(CheckedTypeUtils.address(network.contracts.bankFacet.address));
        if (dripAmount.gt(bankFunds)) {
          // fallback to faucet
          return network.featureFlags.faucet!.getDripFromFaucet(address);
        } else {
          const submit = await network.contracts.bankFacet.dripToPlayer({
            gasLimit: 300000,
          });
          await network.waitForTransaction(submit.hash);
          return;
        }
      },
      featureFlags: {
        faucet: {
          getDripFromFaucet: async (address: EthAddress): Promise<void> => {
            const response = await fetch(FAUCET, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ address, chainId: 69 }),
            });
            const res = await response.text();
            if (res.includes("Not enough fund")) {
              throw new Error("No more funds in the faucet. Error from faucet: " + res);
            }
          },
        },
      },
      globalTxOverrides: {
        // gasPrice: ethers.BigNumber.from(10 ** 7 * 4),
      },
      overridesPerTxType: ARBITRUM_TX_OVERRIDES,
      loadAbis: () => {
        return abis;
      },
      rpcUrl: "https://kovan.optimism.io",
      rcpSupportsBatchQueries: false,
      rpcWsUrl: "wss://ws-kovan.optimism.io",
      mainnetRpc: ALCHEMY_URL,
      time: {
        blockTimestampRefreshInterval: 0,
        resolution: 180,
      },
    },
    300: {
      chainId: 300,
      chainName: "optimism on gc",
      createContractsWithConnector,
      diamondAddress,
      getFunds: async (address, network): Promise<void> => {
        const dripAmount = await network.contracts.bankFacet.getDripAmount();
        const bankFunds = await network.getBalance(CheckedTypeUtils.address(network.contracts.bankFacet.address));
        if (dripAmount.gt(bankFunds)) {
          // fallback to faucet
          return network.featureFlags.faucet!.getDripFromFaucet(address);
        } else {
          const submit = await network.contracts.bankFacet.dripToPlayer({
            gasLimit: 300000,
          });
          await network.waitForTransaction(submit.hash);
          return;
        }
      },
      featureFlags: {
        faucet: {
          getDripFromFaucet: async (address: EthAddress): Promise<void> => {
            const response = await fetch(FAUCET, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ address, chainId: 300 }),
            });
            const res = await response.text();
            if (res.includes("Not enough fund")) {
              throw new Error("No more funds in the faucet. Error from faucet: " + res);
            }
          },
        },
      },
      globalTxOverrides: {
        // gasPrice: ethers.BigNumber.from(10 ** 7 * 4),
      },
      overridesPerTxType: OE_TX_OVERRIDES,
      loadAbis: () => {
        return abis;
      },
      rpcUrl: "https://optimism.gnosischain.com",
      rcpSupportsBatchQueries: false,
      rpcWsUrl: "wss://optimism.gnosischain.com/wss",
      mainnetRpc: ALCHEMY_URL,
      time: {
        blockTimestampRefreshInterval: 0,
        resolution: 5,
      },
    },
    4242: {
      chainId: 4242,
      chainName: "Lattice Testnet",
      createContractsWithConnector,
      diamondAddress,
      getFunds: async (address, network): Promise<void> => {
        const dripTx = await network.getDripFromFaucet(address);
        console.log("got drip tx");
        console.log(dripTx);
        return;
      },
      featureFlags: {
        faucet: {
          getDripFromFaucet: async (address: EthAddress, network?: Network<GameContracts, TxType>): Promise<void> => {
            if (!network) {
              console.error("can't get drip from faucet, network not provided");
              return
            }
            await network.getDripFromFaucet(address);
          },
        },
      },
      globalTxOverrides: {
        gasPrice: ethers.BigNumber.from(300000),
      },
      overridesPerTxType: TESTNET_TX_OVERRIDES,
      loadAbis: () => {
        return abis;
      },
      rpcUrl: "https://miner.testnet-chain.linfra.xyz",
      rcpSupportsBatchQueries: false,
      rpcWsUrl: "wss://miner.testnet-chain.linfra.xyz/ws",
      mainnetRpc: ALCHEMY_URL,
      time: {
        blockTimestampRefreshInterval: 30,
        resolution: 1,
      },
    },
  };
  if (!Object.keys(configs).includes(chainId.toString())) {
    throw new Error("the config list does not include " + chainId.toString());
  }
  return configs[chainId];
};

export const ARBITRUM_TX_OVERRIDES: TxOverrides<TxType> = {
  [TxType.InitializePlayer]: {},
  [TxType.MineTile]: {},
  [TxType.MineResourceTile]: {},
  [TxType.ClaimTile]: {},
  [TxType.UpgradeTile]: {},
  [TxType.HarvestTiles]: {},
  [TxType.InitiateWallTile]: {},
  [TxType.CompleteWallTile]: {
    gasLimit: 10_000_000,
  },
  [TxType.InitiateUnwallTile]: {},
  [TxType.CompleteUnwallTile]: {
    gasLimit: 10_000_000,
  },
  [TxType.InitiateForceMineTile]: {},
  [TxType.CompleteForceMineTile]: {
    gasLimit: 10_000_000,
  },
  [TxType.ClaimResourcesOnRegion]: {},
  [TxType.SpawnCreature]: {
    gasLimit: 10_000_000,
  },
  [TxType.MoveCreatures]: {},
  [TxType.ClaimDungeonHeart]: {},
};

export const XDAI_TX_OVERRIDES: TxOverrides<TxType> = {
  [TxType.InitializePlayer]: {
    gasLimit: 10000000,
  },
  [TxType.MineTile]: {
    gasLimit: 1000000,
  },
  [TxType.MineResourceTile]: {
    gasLimit: 1000000,
  },
  [TxType.ClaimTile]: {
    gasLimit: 1000000,
  },
  [TxType.UpgradeTile]: {
    gasLimit: 500000,
  },
  [TxType.HarvestTiles]: {
    gasLimit: 5000000,
  },
  [TxType.InitiateWallTile]: {
    gasLimit: 1000000,
  },
  [TxType.CompleteWallTile]: {
    gasLimit: 1000000,
  },
  [TxType.InitiateUnwallTile]: {
    gasLimit: 1000000,
  },
  [TxType.CompleteUnwallTile]: {
    gasLimit: 1000000,
  },
  [TxType.InitiateForceMineTile]: {
    gasLimit: 1000000,
  },
  [TxType.CompleteForceMineTile]: {
    gasLimit: 1000000,
  },
  [TxType.ClaimResourcesOnRegion]: {
    gasLimit: 2000000,
  },
  [TxType.SpawnCreature]: {
    gasLimit: 2000000,
  },
  [TxType.MoveCreatures]: {
    gasLimit: 3000000,
  },
  [TxType.ClaimDungeonHeart]: {
    gasLimit: 2000000,
  },
};

const DEV_TX_OVERRIDES: TxOverrides<TxType> = {
  [TxType.InitializePlayer]: {
    gasLimit: 10000000,
  },
  // we have a weird error on hardhat where turning off gas estimation by setting the gas limit breaks the node
  [TxType.MineTile]: {
    gasLimit: 1_000_000,
  },
  [TxType.MineResourceTile]: {
    gasLimit: 1_000_000,
  },
  [TxType.ClaimTile]: {
    gasLimit: 1_000_000,
  },
  [TxType.UpgradeTile]: {
    gasLimit: 1_000_000,
  },
  [TxType.HarvestTiles]: {
    gasLimit: 2000000,
  },
  [TxType.InitiateWallTile]: {},
  [TxType.CompleteWallTile]: {},
  [TxType.InitiateUnwallTile]: {},
  [TxType.CompleteUnwallTile]: {},
  [TxType.InitiateForceMineTile]: {},
  [TxType.CompleteForceMineTile]: {},
  [TxType.ClaimResourcesOnRegion]: {},
  [TxType.SpawnCreature]: {},
  [TxType.MoveCreatures]: {
    gasLimit: 2000000,
  },
  [TxType.ClaimDungeonHeart]: {},
};

export const OE_TX_OVERRIDES: TxOverrides<TxType> = {
  [TxType.InitializePlayer]: {},
  [TxType.MineTile]: {
    gasLimit: 1_000_000,
  },
  [TxType.MineResourceTile]: {
    gasLimit: 1_000_000,
  },
  [TxType.ClaimTile]: {
    gasLimit: 1_000_000,
  },
  [TxType.UpgradeTile]: {
    gasLimit: 1_000_000,
  },
  [TxType.HarvestTiles]: {
    gasLimit: 1_000_000,
  },
  [TxType.InitiateWallTile]: {
    gasLimit: 1_000_000,
  },
  [TxType.CompleteWallTile]: {
    gasLimit: 1_000_000,
  },
  [TxType.InitiateUnwallTile]: {
    gasLimit: 1_000_000,
  },
  [TxType.CompleteUnwallTile]: {
    gasLimit: 1_000_000,
  },
  [TxType.InitiateForceMineTile]: {
    gasLimit: 1_000_000,
  },
  [TxType.CompleteForceMineTile]: {
    gasLimit: 1_000_000,
  },
  [TxType.ClaimResourcesOnRegion]: {
    gasLimit: 1_000_000,
  },
  [TxType.SpawnCreature]: {
    gasLimit: 5_000_000,
  },
  [TxType.MoveCreatures]: {
    gasLimit: 10_000_000,
  },
  [TxType.ClaimDungeonHeart]: {
    gasLimit: 10_000_000,
  },
};

export const TESTNET_TX_OVERRIDES: TxOverrides<TxType> = {
  [TxType.InitializePlayer]: {},
  [TxType.MineTile]: {
    gasLimit: 1_000_000,
  },
  [TxType.MineResourceTile]: {
    gasLimit: 1_000_000,
  },
  [TxType.ClaimTile]: {
    gasLimit: 1_000_000,
  },
  [TxType.UpgradeTile]: {
    gasLimit: 1_000_000,
  },
  [TxType.HarvestTiles]: {
    gasLimit: 1_000_000,
  },
  [TxType.InitiateWallTile]: {
    gasLimit: 1_000_000,
  },
  [TxType.CompleteWallTile]: {
    gasLimit: 1_000_000,
  },
  [TxType.InitiateUnwallTile]: {
    gasLimit: 1_000_000,
  },
  [TxType.CompleteUnwallTile]: {
    gasLimit: 1_000_000,
  },
  [TxType.InitiateForceMineTile]: {
    gasLimit: 1_000_000,
  },
  [TxType.CompleteForceMineTile]: {
    gasLimit: 1_000_000,
  },
  [TxType.ClaimResourcesOnRegion]: {
    gasLimit: 1_000_000,
  },
  [TxType.SpawnCreature]: {
    gasLimit: 5_000_000,
  },
  [TxType.MoveCreatures]: {
    gasLimit: 10_000_000,
  },
  [TxType.ClaimDungeonHeart]: {
    gasLimit: 10_000_000,
  },
};