export type RetryErrorHandler = (i: number, e: Error) => void;
export const callWithRetry = async <T>(
  fn: (...args: unknown[]) => Promise<T>,
  args: unknown[] = [],
  onError?: RetryErrorHandler,
  maxRetries = 10,
  retryInterval = 1000
): Promise<T> => {
  return new Promise<T>(async (resolve, reject) => {
    let res: T;
    for (let i = 0; i < maxRetries; i++) {
      try {
        res = await fn(...args);
        resolve(res);
        break;
      } catch (e) {
        console.error(e);
        if (onError) {
          try {
            onError(i, e);
          } catch (e) {
            // console.log(`failed executing callWithRetry error handler`, e);
          }
        }

        if (i < maxRetries - 1) {
          await sleep(Math.min(retryInterval * 2 ** i + Math.random() * 100, 15000));
        } else {
          reject(e);
        }
      }
    }
  });
};

export function sleep<T>(timeout: number, returns?: T): Promise<T> {
  return new Promise<T>((resolve) => setTimeout(() => resolve(returns as T), timeout));
}
