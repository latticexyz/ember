import GameManager from "../Backend/Game/GameManager";
import { ActivePhaserGame } from "../Renderer/singleton";
import { config } from "../Renderer/game";
import { Cache } from "../Backend/Cache/Cache";
import Network, { SupportedChainId } from "../Backend/ETH/Network";
import { GameContracts, getConfig } from "../Backend/ETH/NetworkConfig";
import { UIManager } from "./UIManager";
import { CheckedTypeUtils } from "../Backend/Utils/CheckedTypeUtils";
import { TxType } from "../_types/GlobalTypes";
import { ethers } from "ethers";

export class AppManager {
  static instance?: AppManager;

  constructor() { }

  static getInstance() {
    if (!this.instance) {
      this.instance = new AppManager();
    }
    return this.instance;
  }

  async startup() {
    // Boot GameManager
    if (!GameManager.hasInstance()) {
      // Setup cache
      console.log("Initializing cache");
      await Cache.init();
      console.log("Cache initialized!");

      // Parse params
      const urlParams = new URLSearchParams(window.location.search);
      const chainId = urlParams.get("chainId");
      const diamondAddress = urlParams.get("diamondAddress");

      if (ActivePhaserGame.hasInstance()) {
        ActivePhaserGame.shutdown();
      }
      ActivePhaserGame.boot(config);

      if (!chainId || !diamondAddress) {
        console.error(
          "chainId: ",
          chainId,
          "diamondAddress: ",
          diamondAddress,
        );
        console.error("some params are missing from the Bootloader");
        return
      }

      // Setup ETH connection.
      const netConfig = await getConfig(parseFloat(chainId), CheckedTypeUtils.address(diamondAddress));
      const net = await Network.createNetwork<GameContracts, TxType>(netConfig);

      // Resolve the chainId.
      const chain: SupportedChainId = net.resolveChainIdToSupportedChainId(chainId);

      //@ts-ignore
      const provider = new ethers.providers.Web3Provider(window.ethereum, "any");

      // Prepare for gameplay. Connect metamask + add chain + switch to chain.
      const connected = await net.prepareForGameplay(chain, provider);
      if (!connected) {
        console.error("user did not connect account");
        return;
      }

      // Setup impresonation (if necessary). If already impersonating, there will be no request to
      // sign + send a transaction.
      const address = await provider.getSigner().getAddress();
      const privateKey = await net.allowBurnerWalletToImpersonate(provider, address, chain, diamondAddress);
      if (!privateKey) {
        console.error("user did not authorize burner wallet to impersonate");
        return;
      }

      // Link up the connected account + the impersonating account.
      const playerAddress = CheckedTypeUtils.address(address);

      await net.setupAccountAndImpersonator(playerAddress, privateKey);

      // Setup GameManager.
      const gm = await GameManager.create(net);
      gm.load();
      //@ts-ignore
      window.gm = gm;
      //@ts-ignore
      window.ui = UIManager.getInstance();
    }

    if (module.hot) {
      const restart = () => {
        console.warn("Hot Reload: Reloading ActivePhaserGame");
        // Shut down the Phaser game, which in turn removes all scenes. Every scene has to listen
        // to the 'destroy' event and clean their event listeners as well as any services or Phaser
        // objects that the scene uses.
        ActivePhaserGame.shutdown();
        setTimeout(() => {
          ActivePhaserGame.boot(config);
        }, 10);
      };

      module.hot.accept("../Renderer/game.ts", () => {
        restart();
      });
      //@ts-ignore
      window.restart = restart;
    }
  }

  public destroy() {
    if (GameManager.hasInstance()) {
      GameManager.getInstance().destroy();
    }

    if (ActivePhaserGame.hasInstance()) {
      ActivePhaserGame.shutdown();
    }
  }
}
