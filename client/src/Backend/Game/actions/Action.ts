import { v4 } from "uuid";
import { ActionType, ActionState, ResourceType } from "../../../_types/GlobalTypes";
import { makeObservable, observable, action } from "mobx";

interface ActionData<T> {
  id?: string;
  type: ActionType;
  name: string;
  ignoreConcurrency?: boolean;
  children?: string[];
  parent?: string;
  costByResource?: {[type in ResourceType]?: number};
  skip?: () => boolean;
  process: (data?: T) => Promise<void>;
  requirement?: () => T | Promise<T>;
  onStateChange?: (state: ActionState) => any;
}

export class Action<T> {
  done: Promise<boolean>;
  state: ActionState;
  id: string;
  type: ActionData<T>["type"];
  createdAt: number;
  name: string;
  ignoreConcurrency: boolean;
  children: string[];
  parent?: string;
  progress: number;
  costByResource?: {[type in ResourceType]?: number};

  requirement: ActionData<T>["requirement"];
  onStateChange?: (state: ActionState) => any;
  skip?: () => boolean;
  private setDone: (done: boolean) => void;
  private process: ActionData<T>["process"];

  constructor({
    type,
    name,
    id = v4(),
    ignoreConcurrency = false,
    children,
    parent,
    costByResource,
    process,
    requirement,
    onStateChange,
    skip,
  }: ActionData<T>) {
    this.id = id;
    this.name = name;
    this.type = type;
    this.createdAt = Date.now();
    this.state = ActionState.Created;
    this.ignoreConcurrency = ignoreConcurrency;
    this.children = children || [];
    this.parent = parent;
    this.progress = 0;
    this.costByResource = costByResource;
    this.done = new Promise<boolean>((resolve) => {
      this.setDone = resolve;
    });
    this.process = process;
    this.requirement = requirement;
    this.onStateChange = onStateChange;
    this.skip = skip;

    makeObservable(this, {
      state: observable,
      children: observable,
      progress: observable,
      setState: action,
      addChildren: action,
      setProgress: action,
    });
  }

  // Note: ActionState.Queued can be set multiple times if the action goes back from processing to being queued.
  public setState(state: ActionState) {
    this.state = state;
    if (state === ActionState.Done) {
      this.setProgress(1);
      this.setDone(true);
    }
    if (state === ActionState.Cancelled || state === ActionState.Failed) {
      this.setDone(false);
    }
    this.onStateChange && this.onStateChange(state);
  }

  public setProgress(progress: number) {
    this.progress = progress;
  }

  public addChildren(children: string[]) {
    this.children.push(...children);
  }

  public async execute(data?: T) {
    await this.process(data);
  }

  public cancel() {}
}
