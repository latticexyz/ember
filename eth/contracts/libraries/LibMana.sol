pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;
import "hardhat/console.sol";
import "./LibTypes.sol";
import "./LibAppStorage.sol";
import "./LibMath.sol";

// SPDX-License-Identifier: GPL-3.0

library LibMana {
    event PlayerUpdated(address player, LibTypes.Player data);

    function getAppStorage() internal pure returns (AppStorage storage ret) {
        ret = LibAppStorage.diamondStorage();
    }

    function __msgSender() internal view returns (address) {
        AppStorage storage s = getAppStorage();
        address impersonating = s.impersonators[msg.sender];
        if (impersonating != address(0)) {
            return impersonating;
        } else {
            return msg.sender;
        }
    }

    function chargeManaForAction(LibTypes.ActionType actionType) public {
        AppStorage storage s = getAppStorage();
        LibTypes.Player storage player = s.players[__msgSender()];

        // get new mana
        uint256 updatedMana = player.mana +
            LibMath.toUInt(
                LibMath.divu(
                    (block.timestamp - player.lastManaUpdateTimestamp),
                    s.gameConstants.NUMBER_OF_SECONDS_FOR_ONE_MANA_REGEN
                )
            );

        // cap mana
        if (updatedMana > s.gameConstants.MAX_MANA) {
            updatedMana = s.gameConstants.MAX_MANA;
        }

        // pay mana or fail if not enough
        uint256 manaCost = s.gameConstants.MANA_PER_ACTION_TYPE[uint256(actionType)];
        require(updatedMana >= manaCost, "Not enough mana");

        player.mana = updatedMana - manaCost;
        player.lastManaUpdateTimestamp = block.timestamp;
        emit PlayerUpdated(player.player, player);
    }
}
