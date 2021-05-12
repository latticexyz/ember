/**
 * How it works:
 * 1. During load time, we get all player info currently stored in the cache.
 * 2. For the remaining players that haven't been cached, we add them to the queue
 * 3. After a player in the queue has been processed, we store the player info in the cache
 *
 * When a player spawns, we also add it to the queue
 */

import { JsonRpcProvider } from "@ethersproject/providers";
import { makeObservable, observable } from "mobx";
import { EthAddress } from "../../_types/GlobalTypes";
import GameManager from "../Game/GameManager";
import { Cache, Store } from "../Cache/Cache";
import { Service } from "../../Renderer/game";

export interface PlayerInfo {
  nickname: string | undefined;
  ens: string | undefined;
}

export enum QueueRequestType {
  ENS,
  NICKNAME,
}

export interface QueueRequest {
  address: EthAddress;
  reqType: QueueRequestType[];
  nickname?: string;
}

/**
 * A queue that resolves ENS addresses and caches them in MobX and IndexedDB
 */
export class NameQueue implements Service {
  fetchQueue: QueueRequest[] = [];
  info: Map<EthAddress, PlayerInfo> = new Map();
  provider: JsonRpcProvider;
  cache: Cache;

  constructor() {
    makeObservable(this, {
      info: observable,
    });
  }

  bootService() {
    this.provider = GameManager.getInstance().net.getMainnetProvider();
    this.cache = Cache.getInstance();

    // Load up ENS names.
    this.loadPlayerNames();
  }

  destroyService() {
    this.fetchQueue = [];
    this.info.clear();
  }

  private async loadPlayerNames() {
    const players = GameManager.getInstance().extendedDungeon.players;
    await this.loadPlayers([...players.keys()]);
  }

  public add(req: QueueRequest) {
    console.log("queueing...", req.address);
    this.fetchQueue.push(req);
    this.executeNext();
  }

  public getPlayerInfoFromAddress(address: EthAddress): PlayerInfo {
    return (
      this.info.get(address) || {
        ens: undefined,
        nickname: undefined,
      }
    );
  }
  private async executeNext(): Promise<void> {
    const req = this.fetchQueue.shift();
    if (!req) return;
    let playerInfo = this.getPlayerInfoFromAddress(req.address);
    if (req.reqType.includes(QueueRequestType.ENS)) {
      const ens = await this.fetchENS(req.address);
      playerInfo.ens = ens;
    }
    if (req.reqType.includes(QueueRequestType.NICKNAME)) {
      playerInfo.nickname = req.nickname;
    }
    await this.cache.setItem(Store.PlayerInfo, req.address, JSON.stringify(playerInfo));
    this.info.set(req.address, playerInfo);
  }

  public async loadPlayers(allPlayers: EthAddress[]) {
    await this.loadCache();
    const unCachedPlayers = allPlayers.filter((address) => !this.info.has(address));
    unCachedPlayers.forEach((addr) => {
      this.add({
        address: addr,
        reqType: [QueueRequestType.ENS],
      }); // if player isn't cached, it shouldn't have a nickname. We only need to fetch ENS.
    });
  }

  private async fetchENS(address: EthAddress): Promise<string | undefined> {
    /** ENS does not enforce that an address owns a .eth domain before setting it as a reverse proxy
     * and recommends that you perform a match on the forward resolution
     * see: https://docs.ens.domains/dapp-developer-guide/resolving-names#reverse-resolution
     */
    const ens = await this.provider.lookupAddress(address);
    if (ens) {
      const fwdAddr = await this.provider.resolveName(ens);
      return address === fwdAddr ? ens : undefined;
    }
    return undefined;
  }

  private async loadCache(): Promise<void> {
    const addresses = await this.cache.getKeys(Store.PlayerInfo);
    await Promise.all(
      addresses.map(async (key) => {
        const info = await this.cache.getItem(Store.PlayerInfo, key);
        // info shouldn't be undefined because we use existing keys
        this.info.set(key as EthAddress, JSON.parse(info!));
      })
    );
  }
}
