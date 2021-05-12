// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.7.6;

import "./libraries/LibAppStorage.sol";
import "./libraries/LibDiamond.sol";
import "./libraries/LibImpersonation.sol";
import "./interfaces/IImpersonation.sol";

contract ImpersonationFacet is IImpersonation {
    AppStorage internal s;

    function allowImpersonation(address impersonator, bytes memory sig) external override {
        LibImpersonation._addImpersonator(impersonator, sig);
    }

    function impersonatorOf(address impersonator) external view override returns (address impersonating) {
        return s.impersonators[impersonator];
    }

    function isImpersonator(address impersonator) external view override returns (bool) {
        return s.impersonators[impersonator] != address(0);
    }
}
