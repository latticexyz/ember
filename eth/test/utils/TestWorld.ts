import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signers";
import { ethers, deployments, getNamedAccounts } from "hardhat";
import { ConfigFacet, CreaturesFacet, GetterFacet, ImpersonationFacet } from "../../typechain";
import { BankFacet } from "../../typechain/BankFacet";
import { DungeonFacet } from "../../typechain/DungeonFacet";

export interface World {
    contracts: {
        impersonationFacet: ImpersonationFacet;
        dungeonFacet: DungeonFacet;
        creatureFacet: CreaturesFacet;
        getterFacet: GetterFacet;
        configFacet: ConfigFacet;
    };
    user1: SignerWithAddress;
    user2: SignerWithAddress;
    deployer: SignerWithAddress;
    deployerConfigFacet: ConfigFacet;
    user1ImpersonationFacet: ImpersonationFacet;
    user2ImpersonationFacet: ImpersonationFacet;
    user1DungeonFacet: DungeonFacet;
    user2DungeonFacet: DungeonFacet;
    user1CreaturesFacet: CreaturesFacet;
    user2CreaturesFacet: CreaturesFacet;
    user1BankFacet: BankFacet;
    user2BankFacet: BankFacet;
    user1GetterFacet: GetterFacet;
    user2GetterFacet: GetterFacet;
}

export interface InitializeWorldArgs {}

export async function initializeWorld(): Promise<World> {
    await ethers.provider.send("evm_setAutomine", [true]);
    await deployments.fixture();
    const { user1, user2, deployer } = await getNamedAccounts();

    const impersonationFacet = (await ethers.getContract("Diamond")) as ImpersonationFacet;
    const dungeonFacet = (await ethers.getContract("Diamond")) as DungeonFacet;
    const creatureFacet = (await ethers.getContract("Diamond")) as CreaturesFacet;
    const getterFacet = (await ethers.getContract("Diamond")) as GetterFacet;
    const configFacet = (await ethers.getContract("Diamond")) as ConfigFacet;

    const user1WithSigner = await ethers.getSigner(user1);
    const user2WithSigner = await ethers.getSigner(user2);
    const deployerWithSigner = await ethers.getSigner(deployer);
    const deployerConfigFacet = (await ethers.getContract("Diamond", deployer)) as ConfigFacet;
    const user1ImpersonationFacet = (await ethers.getContract("Diamond", user1)) as ImpersonationFacet;
    const user2ImpersonationFacet = (await ethers.getContract("Diamond", user1)) as ImpersonationFacet;
    const user1DungeonFacet = (await ethers.getContract("Diamond", user1)) as DungeonFacet;
    const user2DungeonFacet = (await ethers.getContract("Diamond", user2)) as DungeonFacet;
    const user1CreaturesFacet = (await ethers.getContract("Diamond", user1)) as CreaturesFacet;
    const user2CreaturesFacet = (await ethers.getContract("Diamond", user2)) as CreaturesFacet;
    const user1BankFacet = (await ethers.getContract("Diamond", user1)) as BankFacet;
    const user2BankFacet = (await ethers.getContract("Diamond", user2)) as BankFacet;
    const user1GetterFacet = (await ethers.getContract("Diamond", user1)) as GetterFacet;
    const user2GetterFacet = (await ethers.getContract("Diamond", user2)) as GetterFacet;

    const contracts = {
        impersonationFacet,
        dungeonFacet,
        creatureFacet,
        getterFacet,
        configFacet,
    };

    return {
        contracts,
        user1: user1WithSigner,
        user2: user2WithSigner,
        deployer: deployerWithSigner,
        deployerConfigFacet,
        user1ImpersonationFacet,
        user2ImpersonationFacet,
        user1DungeonFacet,
        user2DungeonFacet,
        user1CreaturesFacet,
        user2CreaturesFacet,
        user1BankFacet,
        user2BankFacet,
        user1GetterFacet,
        user2GetterFacet,
    };
}
