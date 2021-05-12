import * as path from "path";
import { Web3Storage, getFilesFromPath } from "web3.storage";

const processName = (name: string) => {
  const constituent = name.split(path.sep);
  return [""].concat(constituent.slice(2)).join(path.sep);
};

async function storeWithProgress(token: string, files: any[], log: (l: string) => void): Promise<string> {
  // show the root cid as soon as it's ready
  const onRootCidReady = (cid: string) => {
    log("uploading files with cid: " + cid);
  };

  // when each chunk is stored, update the percentage complete and display
  const totalSize = files.map((f) => f.size).reduce((a, b) => a + b, 0);
  let uploaded = 0;

  const onStoredChunk = (size: number) => {
    uploaded += size;
    const pct = (totalSize / uploaded) * 100;
    log(`Uploading... ${pct.toFixed(2)}% complete`);
  };

  // makeStorageClient returns an authorized Web3.Storage client instance
  const client = makeStorageClient(token);

  // client.put will invoke our callbacks during the upload
  // and return the root cid when the upload completes
  return client.put(files, { onRootCidReady, onStoredChunk });
}

export const uploadArtifactsToIpfs = async (token: string, network: string, log: (l: string) => void) => {
  const deploymentArtifactPath = path.join("deployments", network);
  const files = (await getFilesFromPath(deploymentArtifactPath)).map((f) => ({ ...f, name: processName(f.name) }));
  return storeWithProgress(token, files, log);
};

const makeStorageClient = (token: string) => {
  return new Web3Storage({ token });
};
