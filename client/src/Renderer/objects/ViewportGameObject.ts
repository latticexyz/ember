import { WorldCoord, WithId } from "../../_types/GlobalTypes";
import { UnitType } from "../manager/UnitMoveManager";
import Imp from "./main/imp";
import { Creature } from "./main/creature";
import TileLoading from "./main/tileLoading";
import { CreaturePath } from "./main/creaturePath";

export enum StaticViewportGameObjectType {
  TileLoading = "TileLoading",
  CreaturePath = "CreaturePath",
}

export type ViewportGameObjectUnionType =
  | {
      type: UnitType.Imp;
      object: Imp;
    }
  | {
      type: UnitType.Creature;
      object: Creature;
    }
  | {
      type: StaticViewportGameObjectType.TileLoading;
      object: TileLoading;
    }
  | {
      type: StaticViewportGameObjectType.CreaturePath;
      object: CreaturePath;
    };

export function isMovable(viewportGameObject: ViewportGameObject): viewportGameObject is ViewportGameObject & {
  typedGameObject: typeof viewportGameObject.typedGameObject & { type: UnitType.Imp | UnitType.Creature };
} {
  return (
    viewportGameObject.typedGameObject?.type === UnitType.Imp ||
    viewportGameObject.typedGameObject?.type === UnitType.Creature
  );
}

export class ViewportGameObject implements WithId {
  private _isSpawned: boolean;
  public typedGameObject?: ViewportGameObjectUnionType;

  public get isSpawned() {
    return this._isSpawned;
  }

  constructor(
    public id: string,
    private methods: {
      spawn: (coord?: WorldCoord, isNewObject?: boolean) => ViewportGameObjectUnionType;
      despawn: (isRemoved?: boolean) => void;
      update: () => void;
    }
  ) {
    this._isSpawned = false;
  }

  public spawn(location?: WorldCoord, isNewObject?: boolean) {
    this.typedGameObject = this.methods.spawn(location, isNewObject);
    this._isSpawned = true;
  }

  public despawn(isRemoved?: boolean) {
    this.methods.despawn(isRemoved);
    this.typedGameObject = undefined;
    this._isSpawned = false;
  }

  public update() {
    this.methods.update();
  }
}
