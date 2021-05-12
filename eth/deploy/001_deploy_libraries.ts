import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const { deployments, getNamedAccounts } = hre;
    const { deploy } = deployments;

    const { deployer } = await getNamedAccounts();

    await deploy("LibUpgrade", {
        from: deployer,
        log: true,
        autoMine: true,
    });
    await deploy("LibImpersonation", {
        from: deployer,
        log: true,
        autoMine: true,
    });
    const libUpgrade = await hre.deployments.get("LibUpgrade");
    await deploy("LibDungeon", {
        from: deployer,
        log: true,
        libraries: {
            LibUpgrade: libUpgrade.address,
        },
        autoMine: true,
    });
    const libDungeon = await hre.deployments.get("LibDungeon");
    await deploy("LibCreatures", {
        from: deployer,
        log: true,
        libraries: {
            LibDungeon: libDungeon.address,
        },
        autoMine: true,
    });
    await deploy("LibPerlin", {
        from: deployer,
        log: true,
        autoMine: true,
    });
    await deploy("LibMana", {
        from: deployer,
        log: true,
        autoMine: true,
    });
};
export default func;
func.tags = ["LibMana", "LibDungeon", "LibUpgrade", "LibCreatures", "LibPerlin"];
