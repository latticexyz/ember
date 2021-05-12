import { expect } from "chai";
import hre, { ethers } from "hardhat";
import { initializeWorld, World } from "./utils/TestWorld";

describe("Bank", function () {
    let world: World;
    before(async function () {
        this.timeout(0);
        world = await initializeWorld();
        await world.deployer.sendTransaction({
            to: world.contracts.configFacet.address,
            value: ethers.utils.parseEther("10.0"),
        });
    });
    it("should be able to receive a drip from the bank", async function () {
        const pre = await world.user1.getBalance();
        await world.user1BankFacet.dripToPlayer();
        const post = await world.user1.getBalance();
        const diff = post.sub(pre);
        expect(diff).to.be.gt(0);
    });
    it("should not be able to get the drip twice", async function () {
        expect(world.user1BankFacet.dripToPlayer()).to.be.revertedWith(
            "drip received too recently. check timeBetweenDrip."
        );
    });
});
