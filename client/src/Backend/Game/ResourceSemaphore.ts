import { deferred } from "../Utils/Utils";
import { computed, IComputedValue, observe } from "mobx";

export class ResourceSemaphore {
  private capacity: IComputedValue<number>;
  private current: number;

  private waiting: (() => boolean)[];

  constructor(getCapacity: () => number) {
    this.waiting = [];
    this.capacity = computed(getCapacity);
    this.current = 0;

    observe(this.capacity, () => {
      this.processWaiting();
    });
  }

  /**
   * Called by an action with a given cost trying to acquire the semaphore.
   * Waits until capacity is available, then increases the internal current value,
   * then resolves with true if we had to wait and false if not.
   * @param cost: cost of the action trying to acquire the semaphore
   */
  public async acquire(cost: number): Promise<boolean> {
    // Wait until there is capacity available
    let hadToWait = false;
    while (!this.capacityAvailable(cost)) {
      hadToWait = await this.waitForCapacityAvailable(cost);
    }
    this.current += cost;
    return hadToWait;
  }

  /**
   * Reduces the current value by the given cost and triggers waiting waiting actions
   * to check if capacity is available again
   * @param cost
   */
  public async release(cost: number) {
    this.current -= cost;
    this.processWaiting();
  }

  /**
   * Check if there is enough capacity available to fit the given cost
   * @param cost: cost of the action trying to acquire the semaphore
   */
  public capacityAvailable(cost: number): boolean {
    return this.current + cost <= this.capacity.get();
  }

  /**
   * Resolves once enough capacity to fit the given cost is available.
   * Returns a false if the method returned immediately and true if it had to wait.
   * @param cost: cost of the action trying to acquire the semaphore
   */
  private async waitForCapacityAvailable(cost: number): Promise<boolean> {
    const [resolve, _, promise] = deferred<true>();

    const resolveIfCapacityAvailable = (): boolean => {
      if (this.capacityAvailable(cost)) {
        // True indicates we had to wait for capacity
        resolve(true);
        return true;
      } else {
        return false;
      }
    };

    if (resolveIfCapacityAvailable()) {
      // False indicates we did not have to wait
      return false;
    }

    this.waiting.push(resolveIfCapacityAvailable);
    return promise;
  }

  /**
   * Triggers each of the waiting actions to recheck if capacity is available.
   * If capacity is now available, waitForCapacityAvailable resolves.
   */
  private async processWaiting() {
    this.waiting = this.waiting.filter((capacityAvailable) => !capacityAvailable());
  }
}
