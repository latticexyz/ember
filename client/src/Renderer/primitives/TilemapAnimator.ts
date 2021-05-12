import { WorldCoord } from "../../_types/GlobalTypes";
import { Service } from "../game";
import { isTileInArea } from "../utils/area";

interface AnimationRequest {
  coordinate: WorldCoord;
  layer: number | string;
}
interface AnimationSet {
  frames: number[];
}

export class TilemapAnimator implements Service {
  private scene: Phaser.Scene;
  private maps: { [key: string]: Phaser.Tilemaps.Tilemap } = {};
  private animationRequests: { [key: string]: AnimationRequest[] } = {};
  private sinceLastUpdate: number = 0;
  private animationSetState: number[];

  constructor(private rate: number, private animationSets: AnimationSet[]) {
    this.animationSetState = [];
    for (const a of animationSets) {
      this.animationSetState.push(a.frames[0]);
    }
  }

  bootService(scene: Phaser.Scene) {
    this.scene = scene;
  }

  destroyService() {
    this.maps = {};
    this.animationRequests = {};
  }

  // Initilize support for animated tiles on given map
  addMap(id: string, map: Phaser.Tilemaps.Tilemap) {
    this.maps[id] = map;
    this.animationRequests[id] = [];
  }
  removeMap(id: string) {
    delete this.maps[id];
    delete this.animationRequests[id];
  }

  addAnimationRequest(id: string, coordinate: WorldCoord, layer: string | number) {
    const animationRequest = { coordinate, layer };
    this.animationRequests[id].push({ coordinate, layer });
    const map = this.maps[id];
    if (!map) {
      console.error("map with id", id, "doesn't exist! coordinate and layer: ", coordinate, layer);
      return;
    }
    // immediately turn the tile in the right frame
    const tile = map.getTileAt(
      animationRequest.coordinate.x,
      animationRequest.coordinate.y,
      undefined,
      animationRequest.layer
    );
    // find the animation set
    const animationSetIndex = this.animationSets.findIndex((a) => a.frames.includes(tile.index));
    if (animationSetIndex >= 0) {
      tile.index = this.animationSetState[animationSetIndex];
    }
  }
  clearAnimationRequests(id: string, x: number, y: number, width: number, height: number) {
    if (!this.animationRequests[id]) {
      return;
    }
    this.animationRequests[id] = this.animationRequests[id].filter(
      (a) => !isTileInArea(a.coordinate, { tileX: x, tileY: y, width, height })
    );
  }

  postUpdate(delta: number) {
    const elapsedTime = delta * this.scene.time.timeScale;
    this.sinceLastUpdate += elapsedTime;
    if (this.sinceLastUpdate < this.rate) {
      return;
    }
    for (const [i, s] of this.animationSetState.entries()) {
      let nextFrameIndex = this.animationSets[i].frames.findIndex((f) => f === s) + 1;
      if (nextFrameIndex === this.animationSets[i].frames.length) {
        nextFrameIndex = 0;
      }
      this.animationSetState[i] = this.animationSets[i].frames[nextFrameIndex];
    }
    this.sinceLastUpdate = 0;
    for (const [id, map] of Object.entries(this.maps)) {
      for (const animationRequest of this.animationRequests[id]) {
        const tile = map.getTileAt(
          animationRequest.coordinate.x,
          animationRequest.coordinate.y,
          undefined,
          animationRequest.layer
        );
        // find the animation set
        const animationSetIndex = this.animationSets.findIndex((a) => a.frames.includes(tile.index));
        if (animationSetIndex >= 0) {
          tile.index = this.animationSetState[animationSetIndex];
        }
      }
    }
  }
}
