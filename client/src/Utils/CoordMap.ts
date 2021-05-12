import { WorldCoord } from "../_types/GlobalTypes";
import { makeAutoObservable } from "mobx";

export class CoordMap<T> {
  map: Map<string, T>;
  defaultValue?: T;

  constructor(props?: { defaultValue?: T }) {
    this.map = new Map<string, T>();
    this.defaultValue = props?.defaultValue;
    makeAutoObservable(this);
  }

  static constructKey(coord: WorldCoord) {
    return `${coord.x}/${coord.y}`;
  }

  static coordFromKey(key: string): WorldCoord {
    const fragments = key.split("/");
    return { x: Number(fragments[0]), y: Number(fragments[1]) };
  }

  static from<T>(coordMapLike: { map: Map<string, T>; defaultValue?: T }): CoordMap<T> {
    const coordMap = new CoordMap<T>();
    coordMap.map = coordMapLike.map;
    coordMap.defaultValue = coordMapLike.defaultValue;
    return coordMap;
  }

  set(coord: WorldCoord, value: T) {
    return this.map.set(CoordMap.constructKey(coord), value);
  }

  get(coord: WorldCoord) {
    return this.map.get(CoordMap.constructKey(coord)) ?? this.defaultValue;
  }

  // TODO: implement new iterator that immediately applies coordFromKey
  keys() {
    return this.map.keys();
  }

  coords() {
    return Array.from(this.map.keys()).map(CoordMap.coordFromKey);
  }

  entries() {
    return this.map.entries();
  }

  toArray(): [WorldCoord, T][] {
    const entries = Array.from(this.map.entries());
    return entries.map(([key, value]) => [CoordMap.coordFromKey(key), value]);
  }

  values() {
    return this.map.values();
  }

  delete(coord: WorldCoord) {
    return this.map.delete(CoordMap.constructKey(coord));
  }

  has(coord: WorldCoord): boolean {
    return this.map.has(CoordMap.constructKey(coord));
  }

  get size(): number {
    return this.map.size;
  }
}
