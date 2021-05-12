import { EventEmitter } from "events";
import { Action } from "./actions/Action";
import { createStrictEventEmitterClass } from "../Utils/Utils";
import { ActionState, ActionType, ResourceType } from "../../_types/GlobalTypes";
import { Semaphore } from "./Semaphore";
import { ResourceSemaphore } from "./ResourceSemaphore";

interface ActionEvents {
  [ActionState.Created]: (actionId: string) => void;
  [ActionState.Queued]: (action: Action<any>) => void;
  [ActionState.Scheduled]: (actionId: string) => void;
  [ActionState.Processing]: (actionId: string) => void;
  [ActionState.Done]: (actionId: string) => void;
  [ActionState.Failed]: (actionId: string) => void;
  [ActionState.Cancelled]: (actionId: string) => void;
}

type PriorityByActionType = {
  [type in ActionType]: number;
};

// TODO: Let actions define their priority themselves
const PRIORITY_BY_TYPE: PriorityByActionType = {
  [ActionType.MineTile]: 0,
  [ActionType.InitPlayer]: 0,
  [ActionType.ClaimTile]: 0,
  [ActionType.UpgradeTile]: 1,
  [ActionType.HarvestTiles]: 2,
  [ActionType.InitiateWallTile]: 2,
  [ActionType.CompleteWallTile]: 3,
  [ActionType.InitiateUnwallTile]: 2,
  [ActionType.CompleteUnwallTile]: 3,
  [ActionType.InitiateForceMineTile]: 2,
  [ActionType.CompleteForceMineTile]: 3,
  [ActionType.ClaimResources]: 4,
  [ActionType.SpawnCreature]: 5,
  [ActionType.MoveCreatures]: 6,
  [ActionType.ClaimDungeonHeart]: 6,
  [ActionType.Meta]: 7,
};

// Not really a queue but yolo
export class ActionQueue extends createStrictEventEmitterClass<ActionEvents>() {
  actionQueue: { [key: string]: Action<any> } = {};
  processing: Promise<void>;
  semaphore: Semaphore;
  actionSemaphores: { [type in ActionType]?: Semaphore };
  resourceSemaphores: { [type in ResourceType]?: ResourceSemaphore };
  priorities: PriorityByActionType;

  public constructor(
    concurrency = 3,
    actionSemaphores: { [type in ActionType]?: Semaphore } = {},
    resourceSemaphores: { [type in ResourceType]?: ResourceSemaphore } = {},
    priorityByActionType: PriorityByActionType = PRIORITY_BY_TYPE
  ) {
    super();
    this.semaphore = new Semaphore(concurrency);
    this.actionSemaphores = actionSemaphores;
    this.resourceSemaphores = resourceSemaphores;
    this.priorities = priorityByActionType;
  }

  public add(action: Action<any>) {
    // If action has been scheduled before
    if (this.actionQueue[action.id]) {
      console.warn("this action has already been added to the queue: ", action.id);
      return false;
    }

    this.actionQueue[action.id] = action;
    this.setActionState(action, ActionState.Queued);
    this.process();
    return true;
  }

  public remove(actionId: string) {
    const action = this.actionQueue[actionId];
    if (!action) return false;
    delete this.actionQueue[actionId];
    this.setActionState(action, ActionState.Cancelled);
    return true;
  }

  private async execute(action: Action<any>, data?: any) {
    action.setState(ActionState.Scheduled);
    let dependencyData = data;
    const hadToWait = await this.acquireSemaphore(action);

    // Stop processing action if the action was cancelled while waiting
    if (action.state === ActionState.Cancelled) {
      this.releaseSemaphore(action);
      return;
    }

    this.setActionState(action, ActionState.Processing);
    // Check if dependency is still met if action had to wait
    if (hadToWait && action.requirement) {
      dependencyData = await action.requirement();
      if (!dependencyData) {
        // If the dependency is not met anymore, unschedule the action and let it be processed again
        this.setActionState(action, ActionState.Queued);
        await this.releaseSemaphore(action);
        return;
      }
    }

    try {
      await action.execute(data);
      this.setActionState(action, ActionState.Done);
    } catch (e) {
      console.error(e, e.stack);
      this.setActionState(action, ActionState.Failed);
    }

    this.releaseSemaphore(action);
    delete this.actionQueue[action.id];

    // After an action has been executed, check for more actions that can be executed
    this.process();
  }

  public async process(actionTypes?: ActionType[]) {
    const actions = this.getActionsSortedByPriority(actionTypes);

    outer: for (const action of actions) {
      if (action.state !== ActionState.Queued) {
        continue;
      }

      if (action.skip && action.skip()) {
        this.setActionState(action, ActionState.Done);
      }

      const lock = this.actionSemaphores[action.type];
      if (lock && !lock.capacityAvailable()) {
        continue;
      }

      if (action.costByResource) {
        for (const [resource, cost] of Object.entries(action.costByResource)) {
          if (!this.resourceSemaphores[resource]?.capacityAvailable(cost)) {
            continue outer;
          }
        }
      }

      if (!action.requirement) {
        this.execute(action);
        continue;
      }

      const requiredData = await action.requirement();

      // Check if the action is still queued because process might have been called while we awaited the requirement
      if (requiredData && action.state === ActionState.Queued) {
        this.execute(action, requiredData);
        continue;
      }
    }
  }

  private setActionState(action: Action<any>, state: ActionState) {
    if ([ActionState.Failed].includes(action.state)) {
      console.warn("tried to set state of completed action");
      console.log(action, state);
      return;
    }

    // Remove all child actions if action got cancelled or failed
    if (state === ActionState.Cancelled || state === ActionState.Failed) {
      for (const childId of action.children) {
        this.remove(childId);
      }
    }

    // Can't cancel a processing action, so don't emit event
    if (action.state === ActionState.Processing && state == ActionState.Cancelled) return;
    action.setState(state);

    if (state === ActionState.Queued) {
      this.emit(ActionState.Queued, action);
    } else {
      this.emit(state, action.id);
    }
  }

  private async acquireSemaphore(action: Action<any>): Promise<boolean> {
    let hadToWait = false;
    if (action.ignoreConcurrency) return hadToWait;
    hadToWait = await this.semaphore.acquire();
    hadToWait = (await this.actionSemaphores[action.type]?.acquire()) || hadToWait;

    if (action.costByResource) {
      for (const [resource, cost] of Object.entries(action.costByResource)) {
        hadToWait = (await this.resourceSemaphores[resource]?.acquire(cost)) || hadToWait;
      }
    }
    return hadToWait;
  }

  private async releaseSemaphore(action: Action<any>): Promise<void> {
    if (action.ignoreConcurrency) return;

    if (action.costByResource) {
      for (const [resource, cost] of Object.entries(action.costByResource)) {
        await this.resourceSemaphores[resource]?.release(cost);
      }
    }
    await this.actionSemaphores[action.type]?.release();
    await this.semaphore.release();
  }

  private getActionsSortedByPriority(actionTypes?: ActionType[]) {
    const unorderedActions = Object.values(this.actionQueue);
    const filteredActions = unorderedActions.filter((action) => !actionTypes || actionTypes.includes(action.type));
    const sortedByPriority = filteredActions.sort((a, b) => {
      return this.priorities[a.type] < this.priorities[b.type] ? -1 : 1;
    });
    return sortedByPriority;
  }
}
