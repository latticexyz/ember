// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.7.6;

interface IImpersonation {
    function allowImpersonation(address impersonator, bytes memory sig) external;

    function impersonatorOf(address impersonator) external view returns (address impersonating);

    function isImpersonator(address impersonator) external view returns (bool);
}
