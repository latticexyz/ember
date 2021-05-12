import { deferred } from "../Utils/Utils";

export class Semaphore {
  public capacity: number;
  private current: number;
  private lock: Promise<void>;
  private releaseLock: (p?: any) => void;

  constructor(capacity: number) {
    this.capacity = capacity;
    this.current = 0;
    this.lock = Promise.resolve();
    this.releaseLock = () => {};
  }

  public async acquire(cost: number) {
    let hadToWait = false;
    // If at max capacity, wait until there is capacity
    while (this.current >= this.capacity) {
      await this.lock;
      hadToWait = true;
    }

    // Starting execution, increase current
    this.current += cost;

    // The last one to enter takes the lock
    if (this.current >= this.capacity) {
      const [resolve, _, promise] = deferred<void>();
      this.lock = promise;
      this.releaseLock = resolve;
    }

    return hadToWait;
  }

  public async release(cost: number) {
    this.current = Math.max(0, this.current - cost);
    this.releaseLock();
  }

  public capacityAvailable() {
    return this.current < this.capacity;
  }
}
