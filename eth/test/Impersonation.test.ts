import { expect } from "chai";
import hre, { ethers } from "hardhat";
import { initializeWorld, World } from "./utils/TestWorld";

describe("Impersonation", function () {
    let world: World;
    before(async function () {
        this.timeout(0);
        world = await initializeWorld();
    });
    it("should be able to add an impersonator", async function () {
        const sig = await world.user2.signMessage(
            ethers.utils.arrayify(
                ethers.utils.solidityKeccak256(["address", "address"], [world.user1.address, world.user2.address])
            )
        );
        await expect(world.user1ImpersonationFacet.allowImpersonation(world.user2.address, sig)).to.not.be.reverted;
        expect(await world.user1ImpersonationFacet.isImpersonator(world.user2.address)).to.be.true;
        expect(await world.user1ImpersonationFacet.isImpersonator(world.user1.address)).to.be.false;
    });
});
