import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { LatticeRegistry } from "@latticexyz/registry/dist/typechain/LatticeRegistry";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const { deployments, getNamedAccounts } = hre;
    const { diamond } = deployments;

    const { deployer } = await getNamedAccounts();
    const LibImpersonation = await hre.deployments.get("LibImpersonation");
    const libDungeon = await hre.deployments.get("LibDungeon");
    const libUpgrade = await hre.deployments.get("LibUpgrade");
    const libCreatures = await hre.deployments.get("LibCreatures");
    const libPerlin = await hre.deployments.get("LibPerlin");
    const libMana = await hre.deployments.get("LibMana");
    const libChecks = await hre.deployments.get("LibChecks");

    const diamondContract = await diamond.deploy("Diamond", {
        from: deployer,
        owner: deployer,
        facets: [
            "DungeonFacet",
            "SettlementFacet",
            "CreaturesFacet",
            "ConfigFacet",
            "GetterFacet",
            "BankFacet",
            "ImpersonationFacet",
        ],
        log: true,
        execute: {
            methodName: "initialize",
            args: [hre.initializers],
        },
        libraries: {
            LibImpersonation: LibImpersonation.address,
            LibDungeon: libDungeon.address,
            LibUpgrade: libUpgrade.address,
            LibCreatures: libCreatures.address,
            LibPerlin: libPerlin.address,
            LibMana: libMana.address,
            LibChecks: libChecks.address,
        },
        autoMine: true,
    });
    if (!hre.network.live && hre.network.config.chainId) {
        console.log("registering the deployment on the dev registry...");
        const registryContract = (await hre.ethers.getContract(
            "LatticeRegistry",
            deployer
        )) as unknown as LatticeRegistry;
        const numberOfDeployments = await (await registryContract.getNumberOfDeployments()).toNumber();
        const deployments = await registryContract.bulkGetActiveDeployments(0, numberOfDeployments);
        for (const d of deployments) {
            if (d.clientUrl === "http://localhost:8081" && d.diamondAddress === diamondContract.address) {
                console.log("skipping. the deployment is already in the registry");
                return;
            }
        }
        const tx = await registryContract.createDeployment({
            artifactCid: "",
            name: "Local deployment",
            chainId: hre.network.config.chainId,
            clientUrl: "http://localhost:8081",
            diamondAddress: diamondContract.address,
        });
        console.log("tx: ", tx.hash);
        const r = await tx.wait();
        console.log("block: ", r.blockHash);
    }
    // we read from sterr when we deploy in the cli
    if (hre.network.live) {
        console.error(diamondContract.address);
    }
};
export default func;
func.tags = ["Diamond"];
