import { EventEmitter } from "events";
import { BigNumber as EthersBN, ContractFunction, ethers, BigNumber } from "ethers";

import { callWithRetry, createStrictEventEmitterClass } from "../Utils/Utils";
import { ThrottledConcurrentQueue } from "../Utils/ThrottledConcurrentQueue";
import { BankEvent, EthAddress, TxExecutorEvent, TxType } from "../../_types/GlobalTypes";
import { TxExecutor } from "./TxExecutor";
import { makeObservable, observable, action } from "mobx";
import Network from "../ETH/Network";
import { GameContracts } from "../ETH/NetworkConfig";

interface BankEvents {
  [BankEvent.DripRequested]: () => void;
  [BankEvent.DripReceived]: () => void;
}

class Bank extends createStrictEventEmitterClass<BankEvents>() {
  public net: Network<GameContracts, TxType>;
  private readonly callQueue = new ThrottledConcurrentQueue(20, 1000);
  public txExecutor: TxExecutor;
  public totalDrip: number | null;
  public dripAmount: number | null;
  public lastDrip: number | null;
  public timeBetweenDrip: number | null;
  public balance: number | null;
  private player: EthAddress;
  public dripRequesting: boolean;

  private constructor(net: Network<GameContracts, TxType>, txExecutor: TxExecutor, playerAddress: EthAddress) {
    super();
    this.net = net;
    this.txExecutor = txExecutor;
    this.lastDrip = null;
    this.totalDrip = null;
    this.dripAmount = null;
    this.timeBetweenDrip = null;
    this.balance = null;
    this.player = playerAddress;
    this.dripRequesting = false;

    makeObservable(this, {
      lastDrip: observable,
      totalDrip: observable,
      dripAmount: observable,
      timeBetweenDrip: observable,
      dripRequesting: observable,
      setBankInfo: action,
      getDrip: action,
    });

    this.txExecutor.on(TxExecutorEvent.TxConfirmed, () => this.net.refreshBalance());
  }

  public setBankInfo({
    lastDrip,
    totalDrip,
    dripAmount,
    timeBetweenDrip,
  }: {
    lastDrip: number;
    totalDrip: number;
    dripAmount: number;
    timeBetweenDrip: number;
  }) {
    this.lastDrip = lastDrip;
    this.totalDrip = totalDrip;
    this.dripAmount = dripAmount;
    this.timeBetweenDrip = timeBetweenDrip;
  }

  public static async create(
    net: Network<GameContracts, TxType>,
    txExecutor: TxExecutor,
    playerAddress: EthAddress
  ): Promise<Bank> {
    const b = new Bank(net, txExecutor, playerAddress);
    await b.load();
    return b;
  }

  private makeCall<T>(contractViewFunction: ContractFunction<T>, args: unknown[] = []): Promise<T> {
    return this.callQueue.add(() => callWithRetry<T>(contractViewFunction, args));
  }

  public async load(): Promise<void> {
    const totalDrip = await this.getTotalDrip();
    const lastDrip = await this.getLastDrip();
    const timeBetweenDrip = await this.getTimeBetweenDrip();
    const dripAmount = await this.getDripAmount();

    this.setBankInfo({ totalDrip, lastDrip, timeBetweenDrip, dripAmount });
    this.net.refreshBalance();
  }

  public async getDrip(): Promise<void> {
    if (this.lastDrip == null || !this.timeBetweenDrip || Date.now() - this.lastDrip < this.timeBetweenDrip) {
      throw new Error("you can't get a drip yet");
    }
    this.emit(BankEvent.DripRequested);
    this.dripRequesting = true;
    // TODO: this does not use the global tx executor! we even haev one in the class but we do not use it. change!
    const submit = await this.net.contracts.bankFacet.dripToPlayer({
      gasLimit: 300000,
      ...this.net.ethersOverrides,
    });
    const receipt = await this.net.waitForTransaction(submit.hash);
    if (receipt.status === 0) {
      throw new Error("drip reverted. tx: " + submit.hash);
    }
    this.emit(BankEvent.DripReceived);
    this.dripRequesting = false;
    this.net.refreshBalance();
    const totalDrip = await this.getTotalDrip();
    const lastDrip = await this.getLastDrip();
    this.setBankInfo({
      lastDrip,
      totalDrip,
      dripAmount: this.dripAmount ? this.dripAmount : 0,
      timeBetweenDrip: this.timeBetweenDrip ? this.timeBetweenDrip : 0,
    });
    // console.log("[bank] got drip with tx hash", receipt.transactionHash);
  }

  private async getTotalDrip(): Promise<number> {
    return parseFloat(
      ethers.utils.formatEther(
        await this.makeCall<EthersBN>(this.net.bulkContracts.bankFacet.getTotalDrip, [this.net.getAddress()])
      )
    );
  }

  private async getDripAmount(): Promise<number> {
    return parseFloat(
      ethers.utils.formatEther(await this.makeCall<EthersBN>(this.net.bulkContracts.bankFacet.getDripAmount))
    );
  }

  private async getLastDrip(): Promise<number> {
    return (
      (
        await this.makeCall<EthersBN>(this.net.bulkContracts.bankFacet.getLastDrip, [this.net.getAddress()])
      ).toNumber() * 1000
    ); // we need to multiply by 1000 cause the EVM timescale is in seconds not ms
  }

  private async getTimeBetweenDrip(): Promise<number> {
    return (await this.makeCall<EthersBN>(this.net.bulkContracts.bankFacet.getTimeBetweenDrips)).toNumber() * 1000; // we need to multiply by 1000 cause the EVM timescale is in seconds not ms
  }
}

export default Bank;
