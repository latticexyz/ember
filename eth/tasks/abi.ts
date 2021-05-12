import { writeFileSync } from "fs";
import { task } from "hardhat/config";
import { HardhatRuntimeEnvironment } from "hardhat/types";

task("abi:export", "export the abis").setAction(exportAbi).addParam("path", "path");

async function exportAbi({ path }: { path: string }, hre: HardhatRuntimeEnvironment) {
    await hre.deployments.all();
    const dungeon = await hre.deployments.getArtifact("DungeonFacet");
    const creatures = await hre.deployments.getArtifact("CreaturesFacet");
    const getter = await hre.deployments.getArtifact("GetterFacet");
    const config = await hre.deployments.getArtifact("ConfigFacet");
    const bank = await hre.deployments.getArtifact("BankFacet");
    writeFileSync(
        path,
        JSON.stringify(
            {
                DungeonFacet: {
                    abi: dungeon.abi,
                },
                CreaturesFacet: {
                    abi: creatures.abi,
                },
                GetterFacet: {
                    abi: getter.abi,
                },
                ConfigFacet: {
                    abi: config.abi,
                },
                BankFacet: {
                    abi: bank.abi,
                },
            },
            null,
            2
        )
    );
}
