import { EventEmitter } from "events";
import { providers } from "ethers";
import anylogger, { Logger, BaseLevels } from "anylogger";
import { deferred, timeoutAfter, createStrictEventEmitterClass } from "../Utils/Utils";
import { ThrottledConcurrentQueue } from "../Utils/ThrottledConcurrentQueue";
import { TxExecutorEvent, TxType } from "../../_types/GlobalTypes";
import { Mutex, MutexInterface } from "async-mutex";
import Network from "../ETH/Network";
import { GameContracts } from "../ETH/NetworkConfig";

export interface QueuedTxRequest {
  onSubmissionError: (e: Error) => void;
  onReceiptError: (e: Error) => void;
  onTransactionResponse: (e: providers.TransactionResponse) => void;
  onTransactionReceipt: (e: providers.TransactionReceipt) => void;
  txId: string;
  overrides: providers.TransactionRequest;
  genTransaction: (nonce: number, overrides: providers.TransactionRequest) => Promise<providers.TransactionResponse>;
  actionId: string;
  onBalanceTooLow?: () => Promise<void>;
  onSubmitting?: () => void;
  onSubmitted?: () => void;
  onConfirmed?: () => void;
}

export interface MakeRequest {
  txId: string;
  actionId: string;
  genTransaction: (nonce: number, overrides: providers.TransactionRequest) => Promise<providers.TransactionResponse>;
  overrides?: providers.TransactionRequest;
  onBalanceTooLow?: () => Promise<void>;
  onScheduled?: () => void;
  onSubmitting?: () => void;
  onSubmitted?: () => void;
  onConfirmed?: () => void;
}

export interface PendingTransaction {
  submitted: Promise<providers.TransactionResponse>;
  confirmed: Promise<providers.TransactionReceipt>;
}

interface TxExecutorEvents {
  [TxExecutorEvent.TxScheduled]: (txId: string, actionId: string) => void;
  [TxExecutorEvent.TxSubmitting]: (txId: string, actionId: string) => void;
  [TxExecutorEvent.TxSubmitted]: (txId: string, actionId: string) => void;
  [TxExecutorEvent.TxConfirmed]: (txId: string, actionId: string) => void;
}

export class TxExecutor extends createStrictEventEmitterClass<TxExecutorEvents>() {
  private log: Logger<BaseLevels>;
  /**
   * tx is considered to have errored if haven't successfully
   * submitted to mempool within 30s
   */
  private static readonly TX_SUBMIT_TIMEOUT = 30000;

  /**
   * don't allow users to submit txs if balance falls below
   */
  public static readonly MIN_BALANCE_ETH = 0.0002;
  private txQueue: ThrottledConcurrentQueue;
  public nonce: number;
  private net: Network<GameContracts, TxType>;
  private submitLock: MutexInterface;

  constructor(net: Network<GameContracts, TxType>, nonce: number) {
    super();
    this.log = anylogger("tx-exec");
    this.txQueue = new ThrottledConcurrentQueue(10, 1000, 2);
    this.nonce = nonce;
    this.net = net;
    this.submitLock = new Mutex();
  }

  /**
   * Schedules this transaction to execute once all of the transactions
   * ahead of it have completed.
   */
  public makeRequest({
    txId,
    actionId,
    genTransaction,
    overrides = {
      gasPrice: undefined,
      gasLimit: undefined,
    },
    onBalanceTooLow,
    onScheduled,
    onSubmitting,
    onSubmitted,
    onConfirmed,
  }: MakeRequest): PendingTransaction {
    const [txResponse, rejectTxResponse, submittedPromise] = deferred<providers.TransactionResponse>();
    const [txReceipt, rejectTxReceipt, receiptPromise] = deferred<providers.TransactionReceipt>();

    this.txQueue.add(() =>
      this.execute({
        txId,
        genTransaction,
        overrides,
        onSubmissionError: rejectTxResponse,
        onReceiptError: rejectTxReceipt,
        onTransactionResponse: txResponse,
        onTransactionReceipt: txReceipt,
        actionId,
        onSubmitting,
        onSubmitted,
        onConfirmed,
        onBalanceTooLow,
      })
    );

    onScheduled && onScheduled();
    this.emit(TxExecutorEvent.TxScheduled, txId, actionId);

    return {
      submitted: submittedPromise,
      confirmed: receiptPromise,
    };
  }

  private async updateNonce() {
    this.nonce = await this.net.getNonce();
    this.log.debug("Updated nonce to " + this.nonce);
  }

  private async checkBalance(onBalanceTooLow?: () => Promise<void>) {
    if (this.net.ethersOverrides.gasPrice === 0) {
      // we don't need to pay for TX
      return;
    }
    const balance = await this.net.getBalance(this.net.getImpersonatorAddress());

    if (balance < TxExecutor.MIN_BALANCE_ETH) {
      this.log.warn("balance too low!");
      if (onBalanceTooLow) {
        this.log.debug("calling on balance too low...");
        await onBalanceTooLow();
        return;
      } else {
        throw new Error("balance too low");
      }
    }
  }

  private async execute(txRequest: QueuedTxRequest) {
    const { onSubmitting, onSubmitted, onConfirmed, onBalanceTooLow } = txRequest;
    let wasSubmitted = false;

    try {
      let submitted: providers.TransactionResponse;
      await timeoutAfter(this.checkBalance(onBalanceTooLow), 10000, "checkBalanceFailed");
      const release = await this.submitLock.acquire();
      try {
        onSubmitting && onSubmitting();
        this.emit(TxExecutorEvent.TxSubmitting, txRequest.txId, txRequest.actionId);
        this.log.debug("Preparing a transaction with nonce " + this.nonce);
        const currentNonce = this.nonce;
        this.nonce += 1;
        submitted = await timeoutAfter<providers.TransactionResponse>(
          txRequest.genTransaction(currentNonce, txRequest.overrides),
          TxExecutor.TX_SUBMIT_TIMEOUT,
          `tx request ${txRequest.txId} failed to submit: timed out`
        );
        txRequest.onTransactionResponse(submitted);
        onSubmitted && onSubmitted();
        wasSubmitted = true;
        this.emit(TxExecutorEvent.TxSubmitted, txRequest.txId, txRequest.actionId);
      } catch (e) {
        this.log.error("Error while submitting tx " + e);
        this.nonce -= 1;
        throw e;
      } finally {
        release();
      }
      this.log.debug("transaction sent with hash: ", submitted.hash);
      this.net.addTransactionPromise(submitted.hash);
      const confirmed = await this.net.waitForTransaction(submitted.hash);
      this.log.info(
        `tx with hash ${submitted.hash} confirmed in block ${confirmed.blockNumber}. gas used: ${confirmed.gasUsed}`
      );
      txRequest.onTransactionReceipt(confirmed);

      onConfirmed && onConfirmed();
      this.emit(TxExecutorEvent.TxConfirmed, txRequest.txId, txRequest.actionId);

      if (confirmed.status !== 1) {
        this.log.error(JSON.stringify(confirmed));
      }
    } catch (e) {
      this.log.error(e);
      if (e.toString().includes("nonce")) {
        const release = await this.submitLock.acquire();
        try {
          await timeoutAfter(this.updateNonce(), 10000, "updateNonce failed");
        } catch (e) {
          console.error(e);
        } finally {
          release();
        }
      }
      if (!wasSubmitted) {
        txRequest.onSubmissionError(e);
      } else {
        txRequest.onReceiptError(e);
      }
    }
  }
}
