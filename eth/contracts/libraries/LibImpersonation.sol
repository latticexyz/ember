// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.7.6;
import "./LibAppStorage.sol";

library LibImpersonation {
    function getAppStorage() internal pure returns (AppStorage storage ret) {
        ret = LibAppStorage.diamondStorage();
    }

    function _addImpersonator(address impersonator, bytes memory sig) public {
        AppStorage storage s = getAppStorage();

        // TODO: Make signatures only valid for specific games
        bytes32 message = prefixed(keccak256(abi.encodePacked(msg.sender, impersonator)));

        // Impersonator needs to sign to approve the impersonation (otherwise i can just add a bunch of address as my "impersonators" and prevent them from playing)
        require(_recoverSigner(message, sig) == impersonator, "INVALID_SIG_SIGNER");
        s.impersonators[impersonator] = msg.sender;
    }

    function _recoverSigner(bytes32 message, bytes memory sig) internal pure returns (address) {
        require(sig.length == 65, "INVALID_SIG_LEN");

        uint8 v;
        bytes32 r;
        bytes32 s;

        assembly {
            // first 32 bytes, after the length prefix
            r := mload(add(sig, 32))
            // second 32 bytes
            s := mload(add(sig, 64))
            // final byte (first byte of the next 32 bytes)
            v := byte(0, mload(add(sig, 96)))
        }

        // Prevent signature malleability
        require(uint256(s) <= 0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF5D576E7357A4501DDFE92F46681B20A0, "INVALID_SIG_S");
        require(v == 27 || v == 28, "INVALID_SIG_V");

        return ecrecover(message, v, r, s);
    }

    // Builds a prefixed hash to mimic the behavior of eth_sign.
    function prefixed(bytes32 hash) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", hash));
    }
}
