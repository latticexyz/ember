import { deferred } from "../../../Backend/Utils/Utils";

type Job = { execute: () => Promise<any>; priority?: boolean };

/**
 * This queue makes sure volume/pan changing actions do not overlay each other to prevent crackling sound
 */
export class ExecutionQueue {
  private queue = new Map<string, Job[]>();
  private isProcessing = new Map<string, Promise<true>>();

  /**
   * Adding a new job removes all non-priority jobs that haven't been processed yet
   * (E.g. instead of changing the volume from A to B to C, it fades directly from A to C)
   */
  private add(key: string, element: Job) {
    const current = this.queue.get(key) || [];
    const priorityElements = current.filter((e) => e.priority);
    const nextQueue = [...priorityElements, element];
    this.queue.set(key, nextQueue);
  }

  /**
   * Returns the next job to be processed and removes it from the queue
   */
  private getNext(key: string): Job | undefined {
    const current = this.queue.get(key) || [];
    const next = current.shift();
    this.queue.set(key, current);
    return next;
  }

  /**
   * Clears all non-priority items from the queue
   */
  public async clearQueue(key: string) {
    const currentQueue = this.queue.get(key) || [];
    const priorityQueue = currentQueue.filter((e) => e.priority);
    this.queue.set(key, priorityQueue);
  }

  /**
   * Resolves once the queue is not processing anymore
   */
  public async awaitProcessing(key: string) {
    while (await this.isProcessing.get(key)) {
      // sleep(50);
    }
  }

  /**
   * Processes the queue until there are no more jobs for this key
   */
  private async processQueue(key: string) {
    if (await this.isProcessing.get(key)) {
      const queue = this.queue.get(key);
      if (!queue || queue.length === 0) {
        return;
      }
    }

    const [resolve, _, promise] = deferred<true>();
    this.isProcessing.set(key, promise);

    let next = this.getNext(key);
    while (next) {
      try {
        await next.execute();
      } catch (e) {
        console.warn(e);
      }
      next = this.getNext(key);
    }

    resolve(true);
    this.isProcessing.delete(key);
  }

  /**
   * Adds a new job to the queue and starts processing the queue
   */
  public async schedule(key: string, element: Job) {
    this.add(key, element);
    await this.processQueue(key);
  }

  /*
  Destroys the state of the queue
  */
  public destroy() {
    this.queue.clear();
    this.isProcessing.clear();
  }
}
