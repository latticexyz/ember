import chalk from "chalk";

export function isValidHttpUrl(s: string) {
  let url;

  try {
    url = new URL(s);
  } catch (_) {
    return false;
  }

  return url.protocol === "http:" || url.protocol === "https:";
}
export type RetryErrorHandler = (i: number, e: Error) => void;
export const callWithRetry = async <T>(
  fn: (...args: any[]) => Promise<T>,
  args: any[] = [],
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
            onError(i, e as any);
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
export const sleep = (ms: number) => new Promise((res, _) => setTimeout(res, ms));

export const renderHeader = () => {
  console.log();
  console.log(chalk.bgWhite.black.bold(" == Lattice Deployer == "));
  console.log();
};
