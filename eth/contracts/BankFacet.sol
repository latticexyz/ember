// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.7.6;
import "hardhat/console.sol";

import "./libraries/LibAppStorage.sol";
import "./libraries/LibDiamond.sol";
import "./libraries/LibTypes.sol";

import "@opengsn/contracts/src/interfaces/IRelayRecipient.sol";

contract BankFacet is IRelayRecipient {
    AppStorage internal s;

    event DripSent(address player, uint256 amount);

    function versionRecipient() public pure override returns (string memory) {
        return "0.0.1";
    }

    function isTrustedForwarder(address forwarder) public view override returns (bool) {
        LibDiamond.DiamondStorage storage ds;
        bytes32 position = LibDiamond.DIAMOND_STORAGE_POSITION;
        assembly {
            ds.slot := position
        }
        return forwarder == ds.trustedForwarder;
    }

    /**
     * return the sender of this call.
     * if the call came through our trusted forwarder, return the original sender.
     * otherwise, return `msg.sender`.
     * should be used in the contract anywhere instead of msg.sender
     */
    function _msgSender() internal view virtual override returns (address payable ret) {
        if (msg.data.length >= 20 && isTrustedForwarder(msg.sender)) {
            // At this point we know that the sender is a trusted forwarder,
            // so we trust that the last bytes of msg.data are the verified sender address.
            // extract sender address from the end of msg.data
            assembly {
                ret := shr(96, calldataload(sub(calldatasize(), 20)))
            }
        } else {
            return msg.sender;
        }
    }

    /**
     * return the msg.data of this call.
     * if the call came through our trusted forwarder, then the real sender was appended as the last 20 bytes
     * of the msg.data - so this method will strip those 20 bytes off.
     * otherwise, return `msg.data`
     * should be used in the contract instead of msg.data, where the difference matters (e.g. when explicitly
     * signing or hashing the
     */
    function _msgData() internal view virtual override returns (bytes memory ret) {
        if (msg.data.length >= 20 && isTrustedForwarder(msg.sender)) {
            return msg.data[0:msg.data.length - 20];
        } else {
            return msg.data;
        }
    }

    function getTimeBetweenDrips() external view returns (uint256 time) {
        time = s.gameConstants.TIME_BETWEEN_DRIPS;
    }

    function getLastDrip(address player) external view returns (uint256 lastDrip) {
        lastDrip = s.lastDrip[player];
    }

    function getTotalDrip(address player) external view returns (uint256 totalDrip) {
        totalDrip = s.totalDrip[player];
    }

    function getDripAmount() external view returns (uint256 amount) {
        amount = s.gameConstants.DRIP_AMOUNT;
    }

    function dripToPlayer() external {
        // tricky cause this might come from GSN
        address caller = _msgSender();
        address impersonating = s.impersonators[caller];
        address player = impersonating != address(0) ? impersonating : caller;

        require(
            s.lastDrip[player] < block.timestamp - s.gameConstants.TIME_BETWEEN_DRIPS,
            "drip received too recently. check timeBetweenDrips."
        );
        require(address(this).balance >= s.gameConstants.DRIP_AMOUNT, "bank is empty");
        s.lastDrip[player] = block.timestamp;
        s.totalDrip[player] = s.totalDrip[player] + s.gameConstants.DRIP_AMOUNT;
        bool sent = payable(caller).send(s.gameConstants.DRIP_AMOUNT);
        require(sent, "drip not sent");
    }
}
