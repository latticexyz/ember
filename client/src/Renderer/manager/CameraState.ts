import { computed, makeObservable, observable } from "mobx";
import { WorldCoord } from "../../_types/GlobalTypes";
import { Service } from "../game";

export enum CameraType {
  Static,
  Moving,
}

export interface ICam {
  selection: WorldCoord[] | undefined;
  type: CameraType;
  creatureId?: string;
  spriteIndex?: number;
  creatureSprite?: string;
}
export interface Cameras {
  c1: ICam;
  c2: ICam;
  c3: ICam;
}

export class CameraState implements Service {
  cameras: Cameras = {
    c1: { selection: undefined, type: CameraType.Static },
    c2: { selection: undefined, type: CameraType.Static },
    c3: { selection: undefined, type: CameraType.Static },
  };
  recallPoint: WorldCoord;
  recallable: boolean = false;
  constructor() {
    makeObservable(this, {
      cameras: observable,
      nActive: computed,
    });
  }
  get nActive() {
    let num = 0;
    for (const key of Object.keys(this.cameras)) {
      if (this.cameras[key].selection || this.cameras[key].creature) {
        num++;
      }
    }
    return num;
  }

  bootService(_: Phaser.Scene) { }

  destroyService() { }
}
