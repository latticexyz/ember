// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.7.6;

import "./libraries/LibAppStorage.sol";
import "./libraries/LibDiamond.sol";
import "./libraries/LibImpersonation.sol";
import "./interfaces/IImpersonation.sol";

/// @title Impersonation Facet
/// @notice EIP-2535 Facet for Impersonation in Ember.
contract ImpersonationFacet is IImpersonation {
    AppStorage internal s;

    /// @notice Add impersonator as an impersonator of the signer of sig.
    /// @param impersonator Address of the burner wallet that will impersonate the signer of the sig.
    /// @param sig Signature that will be used to verify that the signer does indeed desire to be impersonated. TODO: confirm this
    function allowImpersonation(address impersonator, bytes memory sig) external override {
        LibImpersonation._addImpersonator(impersonator, sig);
    }

    /// @notice Returns the address that impersonator is impersonating.
    /// @param impersonator Address of the impersonator to check.
    /// @return impersonating The impersonated address.
    function impersonatorOf(address impersonator) external view override returns (address impersonating) {
        return s.impersonators[impersonator];
    }

    /// @notice Returns true or false depending on whether impersonator is an impersonator of a different address.
    /// @param impersonator Address of the impersonator to check.
    /// @return True if impersonator is an impersonator of a different address, false otherwise.
    function isImpersonator(address impersonator) external view override returns (bool) {
        return s.impersonators[impersonator] != address(0);
    }
}
