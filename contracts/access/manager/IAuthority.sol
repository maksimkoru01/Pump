// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

interface IAuthority {
    function canCall(address caller, address target, bytes4 selector) external view returns (bool allowed, uint32 delay);
}