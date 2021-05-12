import EventEmitter from "events";
import {
  Web3Provider,
  JsonRpcProvider,
  JsonRpcBatchProvider,
  WebSocketProvider,
  TransactionReceipt,
  JsonRpcSigner,
  Formatter,
} from "@ethersproject/providers";
import anylogger, { Logger, BaseLevels } from "anylogger";
import { Wallet, Contract, utils, BigNumber, Overrides, ethers } from "ethers";
import * as gsn from "@opengsn/provider";
import Web3HttpProvider from "web3-providers-http";
import { throttle } from "throttle-debounce";
import { makeObservable, observable, action } from "mobx";
import { EthAddress, NetworkEvent } from "../../_types/GlobalTypes";
import { CheckedTypeUtils } from "../Utils/CheckedTypeUtils";
import { callWithRetry, createStrictEventEmitterClass, deferred, sleep, timeoutAfter } from "../Utils/Utils";
import { ThrottledConcurrentQueue } from "../Utils/ThrottledConcurrentQueue";
import { resolveProperties } from "ethers/lib/utils";

import { FaucetServiceDefinition } from "./Faucet";
import { createChannel, createClient } from "nice-grpc-web";

const IIMPERSONATION_ABI = `
[
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "impersonator",
        "type": "address"
      },
      {
        "internalType": "bytes",
        "name": "sig",
        "type": "bytes"
      }
    ],
    "name": "allowImpersonation",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "impersonator",
        "type": "address"
      }
    ],
    "name": "impersonatorOf",
    "outputs": [
      {
        "internalType": "address",
        "name": "impersonating",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "impersonator",
        "type": "address"
      }
    ],
    "name": "isImpersonator",
    "outputs": [
      {
        "internalType": "bool",
        "name": "",
        "type": "bool"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  } 
]
`;

export interface NetworkEvents {
  [NetworkEvent.BlockNumberChanged]: (blockNumber: number) => void;
  [NetworkEvent.ChainTimeChanged]: (time: number) => void;
  [NetworkEvent.PredictedChainTimeChanged]: (time: number) => void;
}

export type TxOverrides<T extends string> = { [key in T]: Overrides };

export interface NetworkFeatureFlags<C, T extends string> {
  gsn?: {
    preferredRelays: string[];
    paymasterAddress: EthAddress;
  };
  gasPriceOracle?: {
    url: string;
    path: string;
    refreshInterval: number;
  };
  bridge?: {
    getL1Balance: (address: EthAddress) => Promise<BigNumber>;
    bridge: (amount: BigNumber, network: Network<C, T>) => Promise<string>;
  };
  faucet?: {
    // specific faucet function to render in the ui
    getDripFromFaucet: (address: EthAddress, network?: Network<C, T>) => Promise<void>;
  };
}

export enum NetworkStatus {
  NORMAL,
  ERROR,
}

export interface NetworkProps<C, T extends string> {
  chainId: number;
  chainName: string;
  diamondAddress: EthAddress;
  featureFlags: NetworkFeatureFlags<C, T>;
  time: {
    resolution: number;
    blockTimestampRefreshInterval: number;
  };
  rpcUrl: string;
  rcpSupportsBatchQueries: boolean;
  rpcWsUrl?: string;
  mainnetRpc?: string;
  globalTxOverrides: Overrides;
  overridesPerTxType: TxOverrides<T>;
  getFunds: (address: EthAddress, network: Network<C, T>) => Promise<void>;
  loadAbis: () => Promise<any>;
  createContractsWithConnector: (
    contractABI: any,
    diamondAddress: EthAddress,
    connector: JsonRpcProvider | Wallet,
    gsnSigner?: JsonRpcSigner
  ) => C;
}

interface NewBlockEventSubscription {
  contractInterface: ethers.utils.Interface;
  handlers: Partial<Record<string, any>>;
  topics: string[][];
}

export enum SupportedChainId {
  HARDHAT = 31337,
  TESTNET = 4242,
}

export interface ChainConfig {
  readonly chainId: string;
  readonly chainIdHex: string;
  readonly chainName: string;
  readonly nativeCurrency: {
    name: string; // 'Goerli ETH',
    symbol: string; // 'gorETH',
    decimals: number; // 18,
  };
  readonly rpcUrls: string[];
  readonly blockExplorerUrls: string[];
  readonly faucetUrl?: string;
}

export const CHAIN_CONFIG: { [key in SupportedChainId]: ChainConfig } = {
  [SupportedChainId.HARDHAT]: {
    chainId: "31337",
    chainIdHex: "0x7A69",
    chainName: "Hardhat",
    nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
    rpcUrls: ["http://localhost:8545"],
    blockExplorerUrls: ["https://explorer.testnet-chain.linfra.xyz"],
  },
  [SupportedChainId.TESTNET]: {
    chainId: "4242",
    chainIdHex: "0x1092",
    chainName: "Lattice Testnet",
    nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
    rpcUrls: ["https://miner.testnet-chain.linfra.xyz"],
    blockExplorerUrls: ["https://explorer.testnet-chain.linfra.xyz"],
    faucetUrl: "https://faucet.testnet-mud-services.linfra.xyz"
  },
};

const MIN_BALANCE = ethers.utils.parseEther((0.005).toString());

class Network<C, T extends string> extends createStrictEventEmitterClass<NetworkEvents>() {
  private log: Logger<BaseLevels>;
  public chainId: number;
  public chainName: string;

  // feature flag
  public featureFlags: NetworkFeatureFlags<C, T>;

  // GSN stuff
  private web3Provider: any;
  private gsnProvider: gsn.RelayProvider;

  // fund
  public getFunds: () => Promise<void>;
  private isReceivingFunds: boolean;

  // loaders
  private createContractsWithConnector: (
    contractABI: any,
    diamondAddress: EthAddress,
    connector: JsonRpcProvider | Wallet,
    gsnSigner?: JsonRpcSigner
  ) => C;
  // two providers: bulk and normal. bulk is usually a JsonRPC, event is a ws in prod
  private ethersProviderIsWS: boolean;
  private bulkEthersProvider: JsonRpcBatchProvider | JsonRpcProvider;
  private ethersProvider: JsonRpcProvider;
  private mainnetProvider: JsonRpcProvider;

  // reconnecting state
  public reconnecting: boolean;

  private address: EthAddress;
  private signer: Wallet | undefined;

  public balance: number;
  private gsnSigner: JsonRpcSigner | undefined;
  private rpcURL: string;
  private rpcSupportBatchQueries: boolean;
  private rpcWsURL: string | undefined;
  private mainnetRpc: string | undefined;
  public ethersOverrides: Overrides;
  public ethersOverridesPerTxType: TxOverrides<T>;
  // event sourcing
  private blockSyncincQueue: ThrottledConcurrentQueue;
  public networkStatus: NetworkStatus;
  public syncedBlockNumber: number;
  public blockNumber: number;
  // when loading the state, we immediatly listen to events and apply them after the whole state is downloaded
  // this is an event log accumulator
  private eventsWaitingToBeHandled: ethers.providers.Log[];
  private isHandlingEvents: boolean;
  // mapping of txhash to a promise so we can wait for it
  public eventMap: Map<string, { promise: Promise<void>; resolve: () => void }>;

  // time sync
  // resolution in second of the chain
  public chainTimeResolution: number;

  // how often to fetch a block timestamp to update the real chain time
  // 0 means every block
  public chainTimeBlockTimestampRefreshInterval: number;
  public chainTimeBlockTimestampLastUpdated: number;

  // the current (predicted) chain time
  public predictedChainTime: number;
  // the last time the chain time was updated
  public predictedChainTimeLastUpdated: number;
  // the id of the setInterval that takes care of refreshing the chain time
  private predictedChainTimeUpdateIntervalId: ReturnType<typeof setInterval>;

  // the last "true" chain time that was encountered
  public chainTime: number;
  // the last time the true chain time was updated
  public chainTimeLastUpdated: number;
  // whether the chain time update happened when a block was mined on the chain. this is to cover the case where the client is loaded and the last block might have been mined a long time ago, therefore the predicted chain time is highly speculative
  public freshChainTime: boolean;

  public newBlockEventSubscriptions: NewBlockEventSubscription[];

  // assumes that all contracts are behind a diamond proxy
  public diamondAddress: EthAddress;
  public contracts: C;
  public abis: any;
  // those are always connected to a JSONRpcProvider for bulk loading
  public bulkContracts: C;

  // debounced function
  private debouncedAddBlockSyncincRequestToQueue: Network<C, T>["addBlockSyncincRequestToQueue"];
  private debouncedRefreshLastBlockTimestamp: Network<C, T>["refreshLastBlockTimestamp"];

  private constructor(chainId: number, chainName: string) {
    super();
    this.chainId = chainId;
    this.chainName = chainName;
    this.log = anylogger("net");
    this.log("constructing a network class");
    this.isReceivingFunds = false;
    this.reconnecting = false;
    this.blockNumber = -1;
    this.syncedBlockNumber = -1;
    this.eventsWaitingToBeHandled = [];
    this.isHandlingEvents = false;
    this.chainTime = 0;
    this.freshChainTime = false;
    this.chainTimeLastUpdated = 0;
    this.predictedChainTime = 0;
    this.predictedChainTimeLastUpdated = 0;
    this.chainTimeResolution = 0;
    this.chainTimeBlockTimestampLastUpdated = 0;
    this.networkStatus = NetworkStatus.NORMAL;
    this.newBlockEventSubscriptions = [];
    // disabled any throttling by using a period of 1ms and max invocation to 1000
    this.blockSyncincQueue = new ThrottledConcurrentQueue(1000, 1, 1);
    this.debouncedAddBlockSyncincRequestToQueue = throttle(1000, this.addBlockSyncincRequestToQueue.bind(this));
    this.debouncedRefreshLastBlockTimestamp = throttle(1000, this.refreshLastBlockTimestamp.bind(this));
    this.balance = 0;
    this.eventMap = new Map<string, { promise: Promise<void>; resolve: () => void }>();
    this.log.info("Net initialized");
    makeObservable(this, {
      blockNumber: observable,
      syncedBlockNumber: observable,
      networkStatus: observable,
      reconnecting: observable,
      balance: observable,
      predictedChainTime: observable,
      chainTime: observable,
      predictedChainTimeLastUpdated: observable,
      freshChainTime: observable,
      setChainTime: action,
      setPredictedChainTime: action,
      setBlockNumber: action,
      setSyncedBlockNumber: action,
      setNetworkStatus: action,
      setReconnecting: action,
      setBalance: action,
      refreshBalance: action,
    });
  }

  public static async createNetwork<C, T extends string>(props: NetworkProps<C, T>): Promise<Network<C, T>> {
    const n = new Network<C, T>(props.chainId, props.chainName);
    n.log.info("Creating a network with props: ");
    n.log.info(props);
    n.featureFlags = props.featureFlags;
    n.ethersOverrides = props.globalTxOverrides;
    n.ethersOverridesPerTxType = props.overridesPerTxType;
    n.chainTimeResolution = props.time.resolution;
    n.chainTimeBlockTimestampRefreshInterval = props.time.blockTimestampRefreshInterval;
    n.createContractsWithConnector = props.createContractsWithConnector.bind(n);
    n.getFunds = async () => {
      if (n.isReceivingFunds) {
        n.log.warn("already receiving funds");
        return;
      }
      try {
        n.isReceivingFunds = true;
        await props.getFunds(n.getImpersonatorAddress(), n);
      } catch (e) {
        n.log.error("Error while receiving funds");
        throw e;
      } finally {
        n.isReceivingFunds = false;
      }
    };
    const abis = await props.loadAbis();
    n.diamondAddress = props.diamondAddress;
    n.abis = abis;
    await n.connectToChain(props.rpcUrl, props.rcpSupportsBatchQueries, props.rpcWsUrl, props.mainnetRpc);
    return n;
  }

  public getProvider(): JsonRpcProvider {
    return this.ethersProvider;
  }

  public getMainnetProvider(): JsonRpcProvider {
    return this.mainnetProvider;
  }

  // private async recomputeEthersOverrides(key: string = "average") {
  //   const currentGasPrice = await fetch(GAS_PRICE_ORACLE).then((x) => x.json());
  //   console.log("Gas price oracle: ", currentGasPrice);
  //   if (!currentGasPrice[key]) {
  //     throw new Error("this key on the oracle's response does not exist");
  //   }
  //   console.log("setting gas price to: ", parseFloat(currentGasPrice[key]));
  //   this.ethersOverrides = {
  //     gasPrice: ethers.BigNumber.from(10 ** 9 * parseFloat(currentGasPrice[key])),
  //   };
  //   // console.log("Prod ethers overrides: ", this.ethersOverrides, this.ethersOverridesPerTxType);
  // }

  public setBlockNumber(blockNumber: number) {
    this.blockNumber = blockNumber;
  }

  public setSyncedBlockNumber(blockNumber: number) {
    this.syncedBlockNumber = blockNumber;
  }

  public setNetworkStatus(networkStatus: NetworkStatus) {
    this.networkStatus = networkStatus;
  }

  public setBalance(balance: number) {
    this.balance = balance;
  }

  public async refreshBalance() {
    this.setBalance(await this.getBalance(this.getImpersonatorAddress()));
  }

  // private periodicallyRefreshEthersOverrides() {
  //   setTimeout(async () => {
  //     await this.recomputeEthersOverrides(this.gasPriceOracleKey);
  //     this.periodicallyRefreshEthersOverrides();
  //   }, 60 * 1000);
  // }

  public getRpcEndpoint(): string {
    return this.rpcURL;
  }

  public hasSigner(): boolean {
    return !!this.signer;
  }
  /**
   * This function connects this network to the chain using a JSON-RPC, and optionally a websocket stream
   * Calling this function again while the network is already connected to the chain will re-initialize all event listeners and reconnect all contracts
   * @param url the url of the JsonRpcProvider
   * @param rpcSupportsBatchQueries whether the Json RPC supports batch queries or not
   * @param wsUrl the websocket url of the WebSocketProvider
   * @returns void
   */

  public async connectToChain(
    url: string,
    rpcSupportsBatchQueries: boolean,
    wsUrl: string | undefined,
    mainnetRpc?: string
  ): Promise<void> {
    try {
      this.rpcURL = url;
      this.rpcSupportBatchQueries = rpcSupportsBatchQueries;
      this.rpcWsURL = wsUrl;
      this.mainnetRpc = mainnetRpc;
      // the web3 providers are just used for GSN
      //@ts-ignore
      const web3Provider = new Web3HttpProvider(this.rpcURL);
      this.log.debug("web3 http provider connected");
      this.web3Provider = web3Provider;
      await timeoutAfter(
        web3Provider.send("eth_chainId", () => { }),
        10000,
        "chainId failed"
      );
      if (this.rpcWsURL) {
        this.ethersProvider = new WebSocketProvider(this.rpcWsURL);
        this.log.debug("websocket provider connected");
        this.ethersProviderIsWS = true;
        const socketInstance = (this.ethersProvider as WebSocketProvider)._websocket as WebSocket;
        socketInstance.onclose = (event) => {
          this.log.warn("socket is closed", event);
          socketInstance.close();
          this.reconnectToChain();
        };
        socketInstance.onerror = (event) => {
          this.log.warn("socket is errored", event);
          socketInstance.close();
          this.reconnectToChain();
        };
      } else {
        this.ethersProvider = new JsonRpcProvider(this.rpcURL);
        this.log.debug("json rpc provider connected");
        this.ethersProvider.pollingInterval = 1000;
        this.ethersProviderIsWS = false;
      }
      if (this.mainnetRpc) {
        this.mainnetProvider = new JsonRpcProvider(mainnetRpc);
        this.mainnetProvider.pollingInterval = 1000;
        this.log.debug("Connected to mainnet");
      } else {
        this.log.warn("No mainnet rpc");
      }
      this.bulkEthersProvider = this.rpcSupportBatchQueries
        ? new JsonRpcBatchProvider(this.rpcURL)
        : new JsonRpcProvider(this.rpcURL);
      if (!this.rpcSupportBatchQueries) {
        this.log.warn(
          "This rpc doesn't support batched requests. Nodes might not be synced when new block events are emitted (as the Network class can't check for that case"
        );
      }
      this.log.debug("bulk json rpc provider connected");
      this.blockNumber = await timeoutAfter(this.ethersProvider.getBlockNumber(), 10000, "getBlockNumber failed");
      this.log.debug("block number loaded");
      await timeoutAfter(this.refreshLastBlockTimestamp(false), 10000, "refreshLastBlockTimestamp failed");
      this.log.debug("block timestamp refreshed");
      if (this.signer) {
        await timeoutAfter(this.setupSigner(this.address, this.signer.privateKey), 10000, "setupSigner failed");
        this.log.debug("signer setup");
      } else {
        this.log.warn("No signer. Skipping setting up the signer and the gsnSigner");
        this.signer = undefined;
        this.gsnSigner = undefined;
      }
      this.setupContracts();
      this.log.debug("contracts setup");
      this.setupEventListeners();
      this.log.debug("event listeners setup");
    } catch (e) {
      this.log.error(`error connecting to chain: ${e}`);
      console.error(e);
      throw new Error("Cant connect to chain");
    }
  }

  public async reconnectToChain() {
    if (this.reconnecting) {
      this.log.warn("Already reconnecting. Ignoring call to reconnectToChain");
      return;
    }
    this.setReconnecting(true);
    this.log.info("reconnecting to chain");
    try {
      this.blockSyncincQueue.clear();
      await callWithRetry<void>(
        this.connectToChain.bind(this),
        [this.rpcURL, this.rpcSupportBatchQueries, this.rpcWsURL],
        (i, e) => {
          this.log.warn(`error while reconnecting to chain, attempt ${i + 1}`);
          this.log.warn(e);
        },
        300,
        2000
      );
      this.log.info("reconnected to chain!");
      this.blockSyncincQueue.clear();
      await timeoutAfter(this.addBlockSyncincRequestToQueue(this.blockNumber), 60000, "block syncing request failed");
    } catch (e) {
      this.log.error("Error while reconnecting to chain");
      console.error(e);
      this.setNetworkStatus(NetworkStatus.ERROR);
      throw e;
    } finally {
      this.setReconnecting(false);
    }
  }

  public setReconnecting(reconnecting: boolean) {
    this.log.debug("setting reconnecting to: ", reconnecting);
    this.reconnecting = reconnecting;
  }

  public chainTimeAndPredictedChainTimeSynced(): boolean {
    return this.chainTime === this.predictedChainTime;
  }

  public setChainTime(time: number, fresh: boolean) {
    this.log.info("time: chain time has been set to", time);
    this.chainTime = time;
    this.chainTimeLastUpdated = Date.now();
    if (fresh && !this.freshChainTime) {
      this.freshChainTime = true;
    }
    this.emit(NetworkEvent.ChainTimeChanged, time);
    if (fresh) {
      this.log.debug("time: fresh chain time");
      this.setPredictedChainTime(time);
    } else {
      this.log.debug("time: stale chain time");
      // we need to compute a very conservative chain time
      const predictedChainTime = Math.floor(Date.now() / 1000) - this.chainTimeResolution;
      this.log.info("time: computed conservative predicted chain time: " + predictedChainTime);
      this.setPredictedChainTime(predictedChainTime);
    }
    // re-schedule the predicted chain time to be updated every chainTimeResolution
    this.schedulePredictedChainTimeUpdate();
  }

  public setPredictedChainTime(time: number) {
    this.log.info("time: predicted chain time has been set to", time);
    this.predictedChainTime = time;
    this.predictedChainTimeLastUpdated = Date.now();
    this.emit(NetworkEvent.PredictedChainTimeChanged, time);
  }

  /**
   * Refresh the last block timestamp by fetching the last block and calling setChainTime
   * @param fresh whether the last block of the chain has just been mined
   * @param blockNumber whether to check the block number to make sure the node has synced that block
   */
  public async refreshLastBlockTimestamp(fresh: boolean, blockNumber?: number) {
    const t = Math.floor(Date.now() / 1000);
    if (
      this.chainTimeBlockTimestampRefreshInterval === 0 ||
      t > Math.floor(this.chainTimeBlockTimestampLastUpdated / 1000) + this.chainTimeBlockTimestampRefreshInterval
    ) {
      this.log.info(
        "time: updating chain time with last block timestamp. fresh: " + fresh + ". blockNumber: " + blockNumber
      );
      let block: ethers.providers.Block;
      while (true) {
        // we are manually crafting a JSON rpc request here because ethers is not flexible enough
        // it forces to refresh the chain using getChainId which prevents us from using the bulk providers to make sure
        // the getBlock request and the getBlockNumber requests are batched and executed by the same node (so we don't have events being dropped when the ws node has the block but the bulk node does not)
        const blockPromise = async () => {
          const rawBlock = await this.bulkEthersProvider.perform("getBlock", {
            includeTransactions: false,
            blockTag: this.bulkEthersProvider.formatter.blockTag(await this.bulkEthersProvider._getBlockTag("latest")),
          });
          return this.ethersProvider.formatter.block(rawBlock);
        };
        const blockNumberPromise = async () => {
          const _blockNumber = await this.bulkEthersProvider.perform("getBlockNumber", {});
          const blockNumber = BigNumber.from(_blockNumber).toNumber();
          return blockNumber;
        };
        try {
          if (blockNumber && this.rpcSupportBatchQueries) {
            const call = () => Promise.all([blockPromise(), blockNumberPromise()]);
            const [b, bn] = await callWithRetry<[ethers.providers.Block, number]>(
              call,
              [],
              (i, e) => {
                this.log.warn(`error while downloading block info, attempt ${i + 1}`);
                this.log.warn(e);
              },
              10,
              1000
            );
            if (bn < blockNumber) {
              await sleep(500);
              this.log.warn("the node we hit doesn't have the latest block! waiting");
            } else {
              block = b;
              break;
            }
          } else {
            const b = await callWithRetry<ethers.providers.Block>(
              blockPromise,
              [],
              (i, e) => {
                this.log.warn(`error while downloading block info, attempt ${i + 1}`);
                this.log.warn(e);
              },
              10,
              1000
            );
            block = b;
            break;
          }
        } catch (e) {
          // can't recover from this yet. die.
          this.log.error("fatal error retrieving logs");
          this.log.error(e);
          this.reconnectToChain();
          return;
        }
      }
      this.chainTimeBlockTimestampLastUpdated = Date.now();
      if (block.timestamp !== this.chainTime) {
        if (fresh) {
          this.log.debug("updating fresh chain time");
        }
        this.setChainTime(block.timestamp, fresh);
      } else {
        this.setPredictedChainTime(block.timestamp);
        this.schedulePredictedChainTimeUpdate();
      }
    }
  }

  private schedulePredictedChainTimeUpdate() {
    if (this.predictedChainTimeUpdateIntervalId) {
      clearInterval(this.predictedChainTimeUpdateIntervalId);
    }
    this.predictedChainTimeUpdateIntervalId = setInterval(async () => {
      this.setPredictedChainTime(this.predictedChainTime + this.chainTimeResolution);
    }, this.chainTimeResolution * 1000);
  }

  private setupContracts() {
    const connector = this.signer ? this.signer : this.ethersProvider;
    const bulkConnector = this.bulkEthersProvider;
    this.contracts = this.createContractsWithConnector(this.abis, this.diamondAddress, connector, this.gsnSigner);
    this.bulkContracts = this.createContractsWithConnector(
      this.abis,
      this.diamondAddress,
      bulkConnector,
      this.gsnSigner
    );
  }

  public getAddress(): EthAddress {
    if (!this.address) {
      throw new Error("account not selected yet");
    }
    return this.address;
  }

  public getImpersonatorAddress(): EthAddress {
    if (!this.signer) {
      throw new Error("account not selected yet");
    }
    return CheckedTypeUtils.address(this.signer.address);
  }

  public getNonce(): Promise<number> {
    // throws if no account has been set yet
    if (!this.signer) {
      throw new Error("account not selected yet");
    }

    return callWithRetry<number>(this.ethersProvider.getTransactionCount.bind(this.ethersProvider), [
      this.signer.address,
    ]);
  }

  public getChainId(): number {
    return this.chainId;
  }

  public getExplorerUrl(): string {
    return CHAIN_CONFIG[this.resolveChainIdToSupportedChainId(`${this.chainId}`)].blockExplorerUrls[0];
  }

  public async setupAccountAndImpersonator(address: EthAddress, impersonatorSecretKey: string) {
    await this.setupSigner(address, impersonatorSecretKey);
    this.setupContracts();
    // check that impersonator is actually impersonating the address
    const impersonationInterfaceContract = new Contract(this.diamondAddress, IIMPERSONATION_ABI, this.ethersProvider);
    if (this.signer?.address === address) {
      // it's the same account
      return;
    }
    const addressImpersonated = CheckedTypeUtils.address(
      await impersonationInterfaceContract.impersonatorOf(this.signer!.address)
    );
    if (addressImpersonated !== address) {
      throw new Error(
        "this impersonator, " +
        this.signer!.address +
        ", is not impersonating " +
        address +
        "!. It is impersonating " +
        addressImpersonated +
        " instead."
      );
    }
  }

  public async prepareForGameplay(chainId: SupportedChainId, provider: ethers.providers.Web3Provider): Promise<boolean> {
    const chainConfig = CHAIN_CONFIG[chainId];

    try {
      // 1. Connect to account.
      await provider.send("eth_requestAccounts", []);

      // 2. Add chain.
      await provider.send("wallet_addEthereumChain", [{
        chainId: chainConfig.chainIdHex,
        chainName: chainConfig.chainName,
        nativeCurrency: chainConfig.nativeCurrency,
        rpcUrls: chainConfig.rpcUrls,
        blockExplorerUrls: chainConfig.blockExplorerUrls,
      }]);

      // 3. Switch to chain.
      await provider.send("wallet_switchEthereumChain", [{ chainId: chainConfig.chainIdHex }]);

      return true;
    } catch (err) {
      console.log(err);

      if (confirm(`${err.message}. Retry?`)) {
        // Re-try.
        return await this.prepareForGameplay(chainId, provider);
      } else {
        return false;
      }
    }
  }

  public resolveChainIdToSupportedChainId(chainId: string): SupportedChainId {
    if (chainId === "31337") {
      return SupportedChainId.HARDHAT;
    } else if (chainId === "4242") {
      return SupportedChainId.TESTNET;
    } else {
      throw new Error(`provided chainId: ${chainId} not currently supported`);
    }
  }

  public async getDripFromFaucet(address: string): Promise<string> {
    const faucet = this.createFaucetService(CHAIN_CONFIG[SupportedChainId.TESTNET].faucetUrl!);
    const response = await faucet?.dripDev({ address: address });
    return response.dripTxHash
  }

  public createFaucetService(url: string) {
    return createClient(FaucetServiceDefinition, createChannel(url));
  }

  public getBurnerWalletPkeyForCurrentPlayer(diamondAddress: string, playerAddress: string): string | null {
    const pkey = localStorage.getItem("burner-wallet-pkey-" + diamondAddress + "-" + playerAddress);
    return pkey;
  }

  private createBurnerWalletPkey(diamondAddress: string, playerAddress: string): string {
    const pkey = ethers.Wallet.createRandom().privateKey;
    if (this.getBurnerWalletPkeyForCurrentPlayer(diamondAddress, playerAddress)) {
      throw new Error("a burner wallet already exists for this deployment");
    }
    localStorage.setItem("burner-wallet-pkey-" + diamondAddress + "-" + playerAddress, pkey);
    return pkey;
  }

  private async checkImpersonationStatus(chainId: SupportedChainId, diamondAddress: string, burnerWalletAddress: string): Promise<string> {
    // Get an RPC for the chain.
    const rpc = new ethers.providers.JsonRpcProvider(CHAIN_CONFIG[chainId].rpcUrls[0]);

    const rpcChainId = (await rpc.getNetwork()).chainId;
    if (rpcChainId !== chainId) {
      throw new Error("mismatch between rpc chain id and deployment chain id");
    }
    const code = await rpc.getCode(diamondAddress);
    if (code.length === 0) {
      throw new Error("no deployment here");
    }
    const impersonationInterfaceContract = new ethers.Contract(diamondAddress, IIMPERSONATION_ABI, rpc);
    const addressImpersonated = await impersonationInterfaceContract.impersonatorOf(burnerWalletAddress);
    return ethers.utils.getAddress(addressImpersonated);
  }

  public async dripToAddress(provider: ethers.providers.Web3Provider, chainId: SupportedChainId, address: string) {
    const addressBalance = await provider.getBalance(address);

    console.log(`balance for address ${address} = ${addressBalance} (on network ${(await provider.getNetwork()).chainId})`);

    if (addressBalance.lt(MIN_BALANCE)) {
      if (chainId !== SupportedChainId.HARDHAT) {
        console.log(`requesting funds for address: ${address}`);
        const faucet = this.createFaucetService(CHAIN_CONFIG[SupportedChainId.TESTNET].faucetUrl!);
        const response = await faucet?.dripDev({ address: address });

        console.log("drip response:")
        console.log(response)
      } else {
        console.log(`not requesting drip, current chainId = ${chainId}`)
      }
    }
  }

  public async allowBurnerWalletToImpersonate(provider: ethers.providers.Web3Provider, playerAddress: string, chainId: SupportedChainId, diamondAddress: string): Promise<string> {
    let pkey = this.getBurnerWalletPkeyForCurrentPlayer(diamondAddress, playerAddress);
    if (!pkey) {
      console.log("this burner wallet does not have a private key in local storage");
      pkey = this.createBurnerWalletPkey(diamondAddress, playerAddress);
      console.log("created burner wallet: ", pkey)
    }
    const s = new ethers.Wallet(pkey);

    console.log("burner wallet address:")
    console.log(s.address)

    // Drip to the burner address, if necessary.
    await this.dripToAddress(provider, chainId, s.address);

    // Drip to the "real" address, if necessary.
    await this.dripToAddress(provider, chainId, playerAddress);

    // Check if already impersonating.
    const impersonatedAddress = await this.checkImpersonationStatus(chainId, diamondAddress, s.address);
    if (impersonatedAddress === playerAddress) {
      console.log("already impersonating, don't do anything");
      return pkey;
    }

    // Sign the tx.
    const sig = s.signMessage(
      ethers.utils.arrayify(ethers.utils.solidityKeccak256(["address", "address"], [playerAddress, s.address]))
    );
    const signer = provider.getSigner();

    console.log("signer:")
    console.log(signer)

    const impersonationInterfaceContract = new ethers.Contract(diamondAddress, IIMPERSONATION_ABI, signer);

    // Send the tx.
    try {
      const tx = await impersonationInterfaceContract.allowImpersonation(s.address, sig, {
        ...(chainId === SupportedChainId.HARDHAT ? { gasPrice: 0 } : {}),
      });

      await tx.wait(1);
    } catch (err) {
      console.log(err);

      if (confirm(`${err.message}. Retry?`)) {
        // Re-try.
        return await this.allowBurnerWalletToImpersonate(provider, playerAddress, chainId, diamondAddress);
      } else {
        return "";
      }
    }

    return pkey;
  }

  public getSignerWithDifferentProvider(rpcUrl: string) {
    if (!this.signer) {
      throw new Error("no existing signer");
    }
    const p = new JsonRpcProvider(rpcUrl);
    return new Wallet(this.signer.privateKey, p);
  }

  private async setupSigner(address: EthAddress, impersonatorSecretKey: string): Promise<void> {
    this.address = address;
    this.signer = new Wallet(impersonatorSecretKey, this.ethersProvider);
    await this.refreshBalance();
    this.log.info("[setupSigner] address:", this.signer.address, "balance: ", this.balance);
    if (this.featureFlags.gsn) {
      this.log.debug("setting up gsn");
      let gasPriceOracleConfig: Partial<gsn.GSNConfig> = {};
      if (this.featureFlags.gasPriceOracle) {
        this.log.debug("adding the gas price oracle to gsn");
        gasPriceOracleConfig = {
          gasPriceOracleUrl: this.featureFlags.gasPriceOracle.url,
          gasPriceOraclePath: this.featureFlags.gasPriceOracle.path,
        };
      }
      const config: Partial<gsn.GSNConfig> = {
        paymasterAddress: this.featureFlags.gsn.paymasterAddress,
        relayLookupWindowBlocks: 2000000,
        preferredRelays: this.featureFlags.gsn.preferredRelays,
        ...gasPriceOracleConfig,
        loggerConfiguration: {
          logLevel: "debug",
        },
      };
      const gsnProvider = await gsn.RelayProvider.newProvider({
        provider: this.web3Provider,
        config,
      }).init();
      this.gsnProvider = gsnProvider;
      this.gsnProvider.addAccount(impersonatorSecretKey);
      const wrappedProvider = new Web3Provider(gsnProvider);
      this.gsnSigner = wrappedProvider.getSigner(this.signer.address);
    }
  }

  public async signMessage(message: string): Promise<string> {
    if (!this.signer) {
      throw new Error("no signer yet");
    }

    return this.signer.signMessage(message);
  }

  public async getBalance(address: EthAddress): Promise<number> {
    const balanceWeiBN = await callWithRetry<BigNumber>(this.ethersProvider.getBalance.bind(this.ethersProvider), [
      address,
    ]);

    return parseFloat(utils.formatEther(balanceWeiBN));
  }

  public setupEventListeners() {
    this.ethersProvider.on("block", async (latestBlockNumber: number) => {
      this.log.debug("eth: ws event: new block=" + latestBlockNumber);
      this.onNewBlock(latestBlockNumber);
      this.debouncedRefreshLastBlockTimestamp(true, latestBlockNumber);
    });
  }

  public destroy() {
    this.ethersProvider.removeAllListeners();
    if (this.predictedChainTimeUpdateIntervalId) clearInterval(this.predictedChainTimeUpdateIntervalId);
  }

  public handleEvents() {
    if (this.isHandlingEvents) {
      this.log.warn("this network instance is already handling events");
      return;
    } else {
      this.log.info(
        `reducing ${this.eventsWaitingToBeHandled.length} events with ${this.newBlockEventSubscriptions.length} reducers`
      );
      this.handleLogs(this.eventsWaitingToBeHandled);
      this.eventsWaitingToBeHandled = [];
      this.isHandlingEvents = true;
    }
  }

  public subscribeToContractEvents(
    contract: Contract,
    // map from contract event to function. using type 'any' here to satisfy typescript - each of
    // the functions has a different type signature.
    handlers: Partial<Record<string, any>>,
    topics: string[][]
  ) {
    this.log.info(
      `adding a new block event subscription w/ contract address ${contract.address} and topics ${JSON.stringify(
        topics
      )}. ⚠️ synced block number will be set to the current block to avoid downloading all events since genesis. Make sure all your subscribeToContractEvents calls are batched in one method.`
    );
    this.setSyncedBlockNumber(this.blockNumber);
    this.newBlockEventSubscriptions.push({
      contractInterface: contract.interface,
      handlers,
      topics,
    });
  }
  /**
   * Whenever we become aware of the fact that there have been one or more new blocks mined on the
   * blockchain, we need to update the internal game state of the game to reflect everything that
   * has happnened in those blocks. The way we find out what happened during those blocks is by
   * filtering all the events that have occured in those blocks to those that represent the various
   * actions that can occur on the game.
   */
  private async onNewBlock(latestBlockNumber: number) {
    if (latestBlockNumber < this.blockNumber) {
      //re-org
      this.setNetworkStatus(NetworkStatus.ERROR);
    }
    this.setBlockNumber(latestBlockNumber);
    this.emit(NetworkEvent.BlockNumberChanged, this.blockNumber);
    if (this.newBlockEventSubscriptions.length > 0) {
      this.debouncedAddBlockSyncincRequestToQueue(this.blockNumber);
    } else {
      this.log.info("skipping a block synncin request due to the absence of newBlockEventSubscriptions");
    }
  }

  private async addBlockSyncincRequestToQueue(latestBlockNumber: number) {
    this.log.info(`queueing a block syncinc request till ${latestBlockNumber}`);

    return this.blockSyncincQueue.add(async () => {
      const previousSyncedBlockNumber = this.syncedBlockNumber;
      if (previousSyncedBlockNumber < 0) {
        throw new Error(
          "addBlockSyncincRequestToQueue was called with this.syncedBlockNumber = " +
          previousSyncedBlockNumber +
          ". You probaly do not want that."
        );
      }
      this.log.info(
        `getting logs from block ${previousSyncedBlockNumber} till ${latestBlockNumber} (${latestBlockNumber - previousSyncedBlockNumber
        } blocks)`
      );
      await this.processEvents(Math.min(previousSyncedBlockNumber + 1, latestBlockNumber), latestBlockNumber);
      this.setSyncedBlockNumber(latestBlockNumber);
    });
  }

  /**
   * Downloads and processes all the events that have occurred in the given range of blocks for one contract.
   *
   * @param startBlock inclusive
   * @param endBlock inclusive
   */
  private async processEvents(startBlock: number, endBlock: number) {
    let allTopics: string[][] = [[]];
    let txReduced = new Set<string>();
    for (const { topics } of this.newBlockEventSubscriptions) {
      allTopics[0].push(...topics[0]);
    }
    let logs: Array<ethers.providers.Log>;
    const logPromise = async () => {
      const params = await resolveProperties({
        filter: this.bulkEthersProvider._getFilter({
          fromBlock: startBlock, // inclusive
          toBlock: endBlock, // inclusive
          address: this.diamondAddress,
          topics: allTopics,
        }),
      });
      const logs: Array<ethers.providers.Log> = await this.bulkEthersProvider.perform("getLogs", params);
      logs.forEach((log) => {
        if (log.removed == null) {
          log.removed = false;
        }
      });
      return Formatter.arrayOf(this.bulkEthersProvider.formatter.filterLog.bind(this.bulkEthersProvider.formatter))(
        logs
      );
    };
    const blockPromise = async () => {
      const _blockNumber = await this.bulkEthersProvider.perform("getBlockNumber", {});
      const blockNumber = BigNumber.from(_blockNumber).toNumber();
      return blockNumber;
    };
    if (!this.rpcSupportBatchQueries) {
      logs = await callWithRetry<Array<ethers.providers.Log>>(
        logPromise,
        [],
        (i, e) => {
          this.log.warn(`error while downloading logs, attempt ${i + 1}`);
          this.log.warn(e);
        },
        10,
        1000
      );
    } else {
      // we can check if the node we hit as synced the block we just received
      while (true) {
        // we are manually crafting a JSON rpc request here because ethers is not flexible enough
        // it forces to refresh the chain using getChainId which prevents us from using the bulk providers to make sure
        // the getBlock request and the gotLog requests are batched and executed by the same node (so we don't have events being dropped when the ws node has the block but the bulk node does not)
        try {
          const call = () => Promise.all([logPromise(), blockPromise()]);
          const [l, b] = await callWithRetry<[Array<ethers.providers.Log>, number]>(
            call,
            [],
            (i, e) => {
              this.log.warn(`error while downloading logs, attempt ${i + 1}`);
              this.log.warn(e);
            },
            10,
            1000
          );
          if (b < endBlock) {
            await sleep(500);
            this.log.warn("the node we hit doesn't have the latest block! waiting");
          } else {
            logs = l;
            break;
          }
        } catch (e) {
          // can't recover from this yet. die.
          this.log.error("fatal error retrieving logs");
          this.log.error(e);
          this.reconnectToChain();
          return;
        }
      }
    }
    // we need to sort per block and per log index (as we might be fetching multiple blocks)
    logs.sort((a: ethers.providers.Log, b: ethers.providers.Log) => {
      if (a.blockNumber < b.blockNumber) {
        return -1;
      } else if (a.blockNumber > b.blockNumber) {
        return 1;
      } else {
        return a.logIndex < b.logIndex ? -1 : 1;
      }
    });

    if (this.isHandlingEvents) {
      this.log.info(`reducing ${logs.length} events with ${this.newBlockEventSubscriptions.length} reducers`);
      txReduced = this.handleLogs(logs);
    } else {
      this.log.info(`adding ${logs.length} events to the list of events waiting to be handled`);
      this.eventsWaitingToBeHandled.push(...logs);
    }

    for (const tx of txReduced) {
      const { resolve, promise } = this.eventMap.get(tx) || {
        resolve: () => { },
        promise: Promise.resolve(),
      };
      resolve();
      this.eventMap.set(tx, { resolve, promise });
    }
  }

  private handleLogs(logs: ethers.providers.Log[]): Set<string> {
    // try every handles/contract combination from the newBlockEventSubscriptions
    let txReduced = new Set<string>();
    for (const log of logs) {
      for (const { contractInterface: contratInterface, handlers } of this.newBlockEventSubscriptions) {
        try {
          const parsedData = contratInterface.parseLog(log);
          const handler = handlers[parsedData.name];
          if (handler !== undefined) {
            this.log.debug(
              "reducing event:",
              parsedData,
              "tx hash: ",
              log.transactionHash,
              "block number: ",
              log.blockNumber,
              "log index: ",
              log.logIndex
            );
            txReduced.add(log.transactionHash);
            handler(parsedData.args, log.transactionHash, log.logIndex);
          }
          // we succesfully parsed
          break;
        } catch (e) {
          // probably can't parse because this is from another facet. silently fail.
        }
      }
    }

    return txReduced;
  }

  public getPrivateKey(): string {
    if (!this.signer) {
      throw new Error("no signer yet");
    }
    return this.signer.privateKey;
  }

  public async waitForTransaction(txHash: string): Promise<TransactionReceipt> {
    return new Promise(async (resolve) => {
      let receipt: TransactionReceipt | undefined = undefined;
      let tries = 0;
      let resolved: undefined | Promise<TransactionReceipt>;
      if (this.ethersProviderIsWS) {
        const [res, _, wsEventResolved] = deferred<TransactionReceipt>();
        this.ethersProvider.once(txHash, (receipt) => {
          res(receipt);
          resolve(receipt);
        });
        resolved = wsEventResolved;
      }

      while (!receipt) {
        receipt = await Promise.race([
          sleep(30 * 1000, undefined),
          this.ethersProvider.getTransactionReceipt(txHash).catch((e) => {
            return undefined;
          }),
          ...(resolved ? [resolved] : []),
        ]);

        if (receipt) {
          resolve(receipt);
          return;
        }

        // exponential backoff, in seconds:
        // 5 * (1, 1, 2, 3, 4, 6, 9, 13, 19, 29, 43, 65 ...)
        // But never more than a minute
        const sleepTime = Math.min(1000 * 1.2 ** tries, 60000);
        await sleep(sleepTime);
        tries += 1;
      }
    });
  }
  public async bridge(amount: number, log: (l: string) => void) {
    const l = (m) => {
      log(m);
      this.log.info(m);
    };
    if (!this.featureFlags.bridge) {
      throw new Error("can't bridge with this network");
    }
    if (amount < 0.01) {
      throw new Error("need to bridge more");
    }
    l(`Bridging ${amount} eth`);
    const balanceBeforeBridge = await this.getBalance(this.getImpersonatorAddress());
    l(`Balance before bridge: ${balanceBeforeBridge} eth`);
    const amountBN = ethers.utils.parseEther(amount.toString());
    const txHash = await this.featureFlags.bridge.bridge(amountBN, this);
    l(`TX on L1: ${txHash}`);
    while (true) {
      await sleep(30000);
      l("Refreshing L2 balance...");
      await this.refreshBalance();
      l(`Refreshed balance: ${this.balance} eth`);
      if (this.balance > balanceBeforeBridge) {
        l(`Done bridging!`);
        return txHash;
      } else {
        l("Waiting...");
      }
    }
  }

  public addTransactionPromise(txHash: string) {
    const exists = this.eventMap.get(txHash);
    if (exists) {
      return exists.promise;
    }
    const [resolve, _, promise] = deferred<void>();
    this.eventMap.set(txHash, { resolve, promise });
  }

  public waitForAllTransactionLogsToBeHandled(txHash: string): Promise<void> {
    const { promise } = this.eventMap.get(txHash) || { promise: Promise.resolve() };
    return promise;
  }
}

export default Network;
