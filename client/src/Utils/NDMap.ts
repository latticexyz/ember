export class NDMap<Value, Key = number> {
  map: Map<string, Value>;
  constructKey: (keys: Key[]) => string;

  constructor(constructKey?: (keys: Key[]) => string) {
    this.map = new Map<string, Value>();
    this.constructKey = constructKey || ((keys: any[]) => keys.join("/")); // any should be number but ts complains
  }

  set(keys: Key[], value: Value) {
    return this.map.set(this.constructKey(keys), value);
  }

  get(keys: Key[]): Value | undefined {
    return this.map.get(this.constructKey(keys));
  }
}
