import { ethers } from "ethers";
import { action, makeObservable, observable } from "mobx";
import { CHAIN_ID_TO_RPC, CHAIN_INFO, SupportedChainId } from "./chains";
import { REGISTRY_ADDRESS, CHAIN_ID } from "@latticexyz/registry/dist/addresses";
import { LatticeRegistry } from "@latticexyz/registry/dist/typechain/LatticeRegistry";
import artifacts from "@latticexyz/registry/dist/artifacts/LatticeRegistry.sol/LatticeRegistry.json";
import { Contract } from "ethers";
import { callWithRetry, sleep } from "./utils";

export interface Deployment {
  deploymentId: number;
  deployedAt: number;
  updatedAt: number;
  chainId: number;
  official: boolean;
  deployer: string;
  diamondAddress: string;
  name: string;
  clientUrl: string;
  artifactCid: string;
  playerJoinedTimestamp: number | null;
  error: string | null;
  local: boolean;
}

interface DeploymentContractData {
  deploymentId: number;
  deployedAt: number;
  updatedAt: number;
  chainId: number;
  official: boolean;
  deployer: string;
  diamondAddress: string;
  name: string;
  clientUrl: string;
  artifactCid: string;
}

const IS_PROD = process.env.NODE_ENV === "production";

const deploymentFromContractData = ({
  deploymentId,
  deployedAt,
  updatedAt,
  chainId,
  official,
  deployer,
  diamondAddress,
  name,
  clientUrl,
  artifactCid,
}: DeploymentContractData): Deployment => {
  return {
    deploymentId,
    deployedAt,
    updatedAt,
    chainId,
    official,
    deployer,
    diamondAddress,
    name,
    clientUrl,
    artifactCid,
    playerJoinedTimestamp: null,
    error: null,
    local: false,
  };
};

export enum OnboardingSteps {
  NEED_CORRECT_CHAIN_ID = 0,
  NEED_BURNER_WALLET = 1,
  NEED_BURNER_WALLET_IMPERSONATION = 2,
  CAN_PLAY = 3,
}

const PLAYER_ABI = `
  [
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "id",
          "type": "address"
        }
      ],
      "name": "getPlayer",
      "outputs": [
        {
          "components": [
            {
              "internalType": "bool",
              "name": "isInitialized",
              "type": "bool"
            },
            {
              "internalType": "address",
              "name": "player",
              "type": "address"
            },
            {
              "internalType": "uint256",
              "name": "initTimestamp",
              "type": "uint256"
            },
            {
              "internalType": "uint256",
              "name": "gold",
              "type": "uint256"
            },
            {
              "internalType": "uint256",
              "name": "souls",
              "type": "uint256"
            },
            {
              "internalType": "uint256",
              "name": "population",
              "type": "uint256"
            },
            {
              "internalType": "uint256",
              "name": "maxGold",
              "type": "uint256"
            },
            {
              "internalType": "uint256",
              "name": "maxSouls",
              "type": "uint256"
            },
            {
              "internalType": "uint256",
              "name": "maxPopulation",
              "type": "uint256"
            }
          ],
          "internalType": "struct LibTypes.Player",
          "name": "player",
          "type": "tuple"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    }
  ]
`;

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

type RPCS = { [key in SupportedChainId]: ethers.providers.JsonRpcProvider };

const FAUCET = "https://latticeprotocol.vercel.app/api/request";
const MIN_BALANCE = ethers.utils.parseEther((0.001).toString());
export async function getFund(address: string, chainId: number): Promise<void> {
  const response = await fetch(FAUCET, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ address, chainId }),
  });
  console.log("Funds from faucet requested");
  const res = await response.text();
  console.log("res: ", res);
  if (res.includes("Not enough fund")) {
    throw new Error("No more funds in the faucet.");
  }
}

export class DeploymentsManager {
  static instance: DeploymentsManager | null = null;
  private rpcs: RPCS;
  public playerAddress: string | null = null;
  public chainId: number | null = null;
  public loadedDeployment: Deployment[] = [];
  public loadingDeployments: boolean = false;
  public selectedDeployment: Deployment | null = null;
  public playedDeployment: Deployment | null = null;
  public onboardingStep: OnboardingSteps | null = null;
  public onboardingStepLoading: boolean = false;
  public onboardingError: string | null = null;
  public onboardingLoadingMessage: string | null = null;
  // development
  public overrideClientUrl: string | null = null;
  static getInstance(): DeploymentsManager {
    if (!DeploymentsManager.instance) {
      const d = new DeploymentsManager();
      this.instance = d;
      return d;
    }
    return DeploymentsManager.instance;
  }
  constructor() {
    makeObservable(this, {
      onboardingLoadingMessage: observable,
      chainId: observable,
      onboardingError: observable,
      loadedDeployment: observable,
      loadingDeployments: observable,
      selectedDeployment: observable,
      playedDeployment: observable,
      onboardingStep: observable,
      onboardingStepLoading: observable,
      playerAddress: observable,
      overrideClientUrl: observable,
      refreshOnboardingStep: action,
      allowBurnerWalletToImpersonate: action,
      setOnboardingError: action,
      setOnboardingStep: action,
      setOnboardingStepLoading: action,
      setChainId: action,
      setLoadingDeployments: action,
      setLoadedDeployment: action,
      loadDeployments: action,
      selectDeployment: action,
      setPlayerAddress: action,
      clearSelectedDeployment: action,
      clearPlayedDeployment: action,
      play: action,
      setOverrideClientUrl: action,
    });
    // create an rpc for each supported chain
    const rpcs = {} as RPCS;
    for (const c of [CHAIN_ID, ...Object.keys(CHAIN_INFO)]) {
      if (c === SupportedChainId.HARDHAT && IS_PROD) {
        continue;
      }
      const rpc = new ethers.providers.JsonRpcProvider(CHAIN_ID_TO_RPC[c]);
      rpcs[c] = rpc;
    }
    this.rpcs = rpcs;
    if (localStorage.getItem("devMode") && JSON.parse(localStorage.getItem("devMode")!)) {
      this.toggleDevMode();
    }
  }
  public setPlayerAddress(address: string) {
    console.log("setting player address", address);
    this.playerAddress = ethers.utils.getAddress(address);
  }
  public setChainId(chainId: number) {
    console.log("setting chain id", chainId);
    this.chainId = chainId;
  }
  public setOnboardingError(error: string) {
    this.onboardingError = error;
  }
  private async getDeploymentsFromRegistry(registry: LatticeRegistry): Promise<Deployment[]> {
    const numberOfDeployments = (await callWithRetry(registry.getNumberOfDeployments, [])).toNumber();
    const deployments: Deployment[] = (
      await callWithRetry(registry.bulkGetActiveDeployments, [0, numberOfDeployments])
    ).map((d) => deploymentFromContractData(d));
    return deployments;
  }
  private async isLocalNodeRunning(): Promise<boolean> {
    try {
      const f = await fetch(CHAIN_ID_TO_RPC[SupportedChainId.HARDHAT]);
      return f.status === 200;
    } catch (e) {
      return false;
    }
  }
  private async getLocalRegistryAddress(): Promise<string | null> {
    try {
      const abisUrl = window.origin + "/public/contracts.json";
      const f = await fetch(abisUrl);
      if (f.status !== 200) {
        return null;
      }
      const abis = await f.json();
      return abis.contracts.LatticeRegistry.address;
    } catch (e) {
      return null;
    }
  }
  private async getLocalRegistryDeployments(): Promise<Deployment[]> {
    if (await this.isLocalNodeRunning()) {
      const localRegistryAddress = await this.getLocalRegistryAddress();
      if (localRegistryAddress) {
        const registry = new Contract(
          localRegistryAddress,
          artifacts.abi,
          this.rpcs[SupportedChainId.HARDHAT]
        ) as unknown as LatticeRegistry;
        const deployments = await this.getDeploymentsFromRegistry(registry);
        return deployments;
      }
    }
    return [];
  }

  public setLoadingDeployments(value: boolean) {
    this.loadingDeployments = value;
  }

  public setLoadedDeployment(loadedDeployments: Deployment[]) {
    this.loadedDeployment = [...loadedDeployments];
  }

  public async loadDeployments() {
    if (!this.playerAddress) {
      throw new Error("can't load deployments, no player address");
    }
    console.log("reloading deployments...", this.playerAddress);
    this.clearSelectedDeployment();
    this.clearPlayedDeployment();
    this.setLoadingDeployments(true);
    // real deployment
    const registry = new Contract(REGISTRY_ADDRESS, artifacts.abi, this.rpcs[100]) as unknown as LatticeRegistry;
    const [deployments, localDeployments] = await Promise.all([
      this.getDeploymentsFromRegistry(registry),
      ...(IS_PROD ? [new Promise<Deployment[]>((res, _) => res([]))] : [this.getLocalRegistryDeployments()]),
    ]);
    const loadedDeployment = [...localDeployments.map((d) => ({ ...d, local: true })), ...deployments];
    this.setLoadedDeployment(loadedDeployment);
    this.setLoadingDeployments(false);
    // now check if the player has spawned
    for (const [i, d] of this.loadedDeployment.entries()) {
      try {
        const c = new ethers.Contract(d.diamondAddress, PLAYER_ABI, this.rpcs[d.chainId]);
        const playerStruct = await c.getPlayer(this.playerAddress);
        if (playerStruct.isInitialized) {
          loadedDeployment[i] = {
            ...this.loadedDeployment[i],
            playerJoinedTimestamp: playerStruct.initTimestamp.toNumber(),
          };
          this.setLoadedDeployment(loadedDeployment);
        } else {
          loadedDeployment[i] = {
            ...this.loadedDeployment[i],
            playerJoinedTimestamp: 0,
          };
          this.setLoadedDeployment(loadedDeployment);
        }
      } catch (e) {
        console.error(e);
        loadedDeployment[i].error = e.name + " " + e.message;
        this.setLoadedDeployment(loadedDeployment);
      }
    }
  }
  public getBurnerWalletPkeyForCurrentPlayer(diamondAddress: string): string | null {
    const pkey = localStorage.getItem("burner-wallet-pkey-" + diamondAddress + "-" + this.playerAddress);
    return pkey;
  }
  private createBurnerWalletPkey(diamondAddress: string): string {
    const pkey = ethers.Wallet.createRandom().privateKey;
    if (this.getBurnerWalletPkeyForCurrentPlayer(diamondAddress)) {
      throw new Error("a burner wallet already exists for this deployment");
    }
    localStorage.setItem("burner-wallet-pkey-" + diamondAddress + "-" + this.playerAddress, pkey);
    return pkey;
  }
  private async checkImpersonationStatus(chainId, diamondAddress, burnerWalletAddress): Promise<string> {
    const rpc = this.rpcs[chainId];
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

  public setOnboardingStep(step: OnboardingSteps | null) {
    this.onboardingStep = step;
  }

  public setOnboardingStepLoading(loading: boolean) {
    this.onboardingStepLoading = loading;
  }

  public clearSelectedDeployment() {
    this.selectedDeployment = null;
    this.onboardingStep = null;
    this.onboardingError = null;
    this.onboardingStepLoading = false;
    this.onboardingLoadingMessage = null;
  }
  public clearPlayedDeployment() {
    this.playedDeployment = null;
  }
  public async play(deployment: Deployment, skipChecks?: boolean) {
    if (!this.playerAddress) {
      throw new Error("no player address");
    }
    if (!skipChecks) {
      const onboardingStep = await this.getOnboardingStep(deployment);
      if (onboardingStep !== OnboardingSteps.CAN_PLAY) {
        throw new Error("cannot play this deployment yet");
      }
    }
    this.clearSelectedDeployment();
    this.playedDeployment = deployment;
  }
  public async selectDeployment(deployment: Deployment) {
    if (!this.playerAddress) {
      throw new Error("no player address");
    }
    this.selectedDeployment = deployment;
    await this.refreshOnboardingStep();
  }
  public createBurnerWalletForSelectedDeployment() {
    this.onboardingError = null;
    if (!this.selectedDeployment) {
      throw new Error("no deployment currently selected");
    }
    if (!this.playerAddress) {
      throw new Error("no player address");
    }
    this.createBurnerWalletPkey(this.selectedDeployment.diamondAddress);
  }
  public async allowBurnerWalletToImpersonate(provider: ethers.providers.Web3Provider) {
    this.onboardingError = null;
    try {
      if (!this.selectedDeployment) {
        throw new Error("no deployment currently selected");
      }
      if (!this.playerAddress) {
        throw new Error("no player address");
      }
      const { chainId, diamondAddress } = this.selectedDeployment;
      const { chainId: providerChainId } = await provider.getNetwork();
      if (chainId !== providerChainId) {
        throw new Error("this provider chain id is different from the deployment chain id");
      }
      const pkey = this.getBurnerWalletPkeyForCurrentPlayer(diamondAddress);
      if (!pkey) {
        throw new Error("this burner wallet does not have a private key in local storage");
      }
      const s = new ethers.Wallet(pkey);
      const sig = s.signMessage(
        ethers.utils.arrayify(ethers.utils.solidityKeccak256(["address", "address"], [this.playerAddress, s.address]))
      );
      const signer = provider.getSigner();
      this.onboardingLoadingMessage = "checking balance of your metamask wallet...";
      const balance = await provider.getBalance(this.playerAddress);
      const impersonationInterfaceContract = new ethers.Contract(diamondAddress, IIMPERSONATION_ABI, signer);
      // this.onboardingWaitingForApproval = true;
      if (balance.lt(MIN_BALANCE) && chainId !== SupportedChainId.HARDHAT) {
        console.log("requesting fund for main wallet");
        this.onboardingLoadingMessage = "requesting funds for your wallet on l2...";
        await getFund(await signer.getAddress(), chainId);
        let attemptsLeft = 60;
        while (attemptsLeft >= 0) {
          this.onboardingLoadingMessage = "checking balance...";
          const newBalance = await provider.getBalance(this.playerAddress);
          if (newBalance.gte(MIN_BALANCE)) {
            break;
          } else {
            await sleep(1000);
            attemptsLeft--;
          }
        }
        if (attemptsLeft === 0) {
          throw new Error("balance for wallet never increased after faucet funding");
        }
      }
      this.onboardingLoadingMessage = "please approve transaction on metamask";
      const tx = await impersonationInterfaceContract.allowImpersonation(s.address, sig, {
        ...(chainId === SupportedChainId.HARDHAT ? { gasPrice: 0 } : {}),
      });
      if ((await provider.getBalance(s.address)).lt(MIN_BALANCE) && chainId !== SupportedChainId.HARDHAT) {
        console.log("requesting fund for burner");
        this.onboardingLoadingMessage = "requesting funds for burner wallet on l2...";
        await getFund(s.address, chainId);
      }
      this.onboardingLoadingMessage = "waiting for tx to be approved...";
      await tx.wait(1);
      // this.onboardingWaitingForTxToApprove = true;
    } catch (e) {
      throw e;
    } finally {
      this.onboardingLoadingMessage = null;
    }
  }
  public async refreshOnboardingStep() {
    if (!this.selectedDeployment) {
      throw new Error("no deployment selected");
    }
    this.setOnboardingStepLoading(true);
    const onboardingStep = await this.getOnboardingStep(this.selectedDeployment);
    this.setOnboardingStep(onboardingStep);
    this.setOnboardingStepLoading(false);
  }
  private async getOnboardingStep(deployment: Deployment): Promise<OnboardingSteps> {
    const { chainId, diamondAddress } = deployment;
    if (this.chainId !== chainId) {
      return OnboardingSteps.NEED_CORRECT_CHAIN_ID;
    }
    if (!this.playerAddress) {
      throw new Error("no player address");
    }
    const burnerPkey = this.getBurnerWalletPkeyForCurrentPlayer(diamondAddress);
    if (!burnerPkey) {
      return OnboardingSteps.NEED_BURNER_WALLET;
    }
    const burnerAddress = new ethers.Wallet(burnerPkey).address;
    const impersonatedAddress = await this.checkImpersonationStatus(chainId, diamondAddress, burnerAddress);
    if (impersonatedAddress !== this.playerAddress) {
      return OnboardingSteps.NEED_BURNER_WALLET_IMPERSONATION;
    }
    return OnboardingSteps.CAN_PLAY;
  }
  public toggleDevMode() {
    if (this.overrideClientUrl) {
      this.setOverrideClientUrl(null);
      localStorage.setItem("devMode", JSON.stringify(false));
    } else {
      this.setOverrideClientUrl("http://localhost:8081");
      localStorage.setItem("devMode", JSON.stringify(true));
    }
  }
  public setOverrideClientUrl(overrideClientUrl: string | null) {
    this.overrideClientUrl = overrideClientUrl;
  }
}
