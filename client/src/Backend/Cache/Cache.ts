import { TileChunk, RegionChunk } from "../Explorer/types";
import { CoordMap } from "../../Utils/CoordMap";
import { PerlinValues, EthAddress, WorldCoord } from "../../_types/GlobalTypes";
import { PlayerInfo } from "../Utils/NameQueue";

const indexedDB = self.indexedDB;
const VERSION = 5;

export enum Store {
  PerlinValues = "PerlinValues",
  Resources = "Resources",
  DungeonHeartRegions = "DungeonHeartRegions",
  PlayerInfo = "PlayerInfo",
}

type ReturnTypes = {
  [Store.PerlinValues]: CoordMap<PerlinValues>;
  [Store.Resources]: Uint8Array;
  [Store.DungeonHeartRegions]: WorldCoord;
  [Store.PlayerInfo]: string;
};

export class Cache {
  private static instance: Cache;

  public db: IDBDatabase;

  public static getInstance(): Cache {
    if (!this.instance) {
      throw new Error("Cache is not initialized");
    }
    return this.instance;
  }

  private constructor(db: IDBDatabase) {
    this.db = db;
  }

  private getStore(store: Store) {
    const tx = this.db.transaction(store, "readwrite");
    return tx.objectStore(store);
  }

  public static init(): Promise<Cache> {
    if (this.instance) {
      return new Promise((res, _) => res(this.instance));
    }
    return new Promise(async (resolve, reject) => {
      // console.log("Initing the IDB Cache")
      const request = indexedDB.open("Cache", VERSION);

      // Create store and index
      request.onupgradeneeded = () => {
        const db = request.result;

        Object.values(Store).forEach((store) => {
          if (db.objectStoreNames.contains(store)) {
            return;
          }
          // console.log("Creating store", store);
          db.createObjectStore(store, { keyPath: "key" });
        });
      };

      request.onsuccess = () => {
        const db = request.result;
        this.instance = new Cache(db);
        // console.log("Done initing!")
        resolve(this.instance);
      };

      request.onerror = (error) => {
        reject(error);
      };
    });
  }

  public setItem<S extends Store>(store: S, key: string, value: ReturnTypes[S]): Promise<void> {
    return new Promise((resolve, reject) => {
      const objectStore = this.getStore(store);
      const request = objectStore.put({ key, value });
      request.onerror = (error) => {
        reject(error);
      };

      request.onsuccess = () => {
        resolve();
      };
    });
  }

  public getItem<S extends Store>(store: S, key: string): Promise<ReturnTypes[S] | undefined> {
    return new Promise((resolve, reject) => {
      const objectStore = this.getStore(store);
      const request = objectStore.get(key);

      request.onerror = (error) => {
        reject(error);
      };

      request.onsuccess = () => {
        const item = request.result?.value;
        resolve(item);
      };
    });
  }

  public deleteItem<S extends Store>(store: S, key: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const objectStore = this.getStore(store);
      const request = objectStore.delete(key);

      request.onerror = (error) => {
        reject(error);
      };

      request.onsuccess = () => {
        resolve();
      };
    });
  }

  public getKeys<S extends Store>(store: S): Promise<string[]> {
    return new Promise((resolve, reject) => {
      const objectStore = this.getStore(store);
      const request = objectStore.getAllKeys();

      request.onerror = (error) => {
        reject(error);
      };

      request.onsuccess = () => {
        const item = request.result.map((k) => k.toString());
        resolve(item);
      };
    });
  }
}
