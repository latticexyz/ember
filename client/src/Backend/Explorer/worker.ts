import { expose } from "threads/worker";
import { explorePerlinInRegion } from "./Utils";

export interface ExplorerWorker {
  explorePerlinInRegion: typeof explorePerlinInRegion;
}

expose({ explorePerlinInRegion });
