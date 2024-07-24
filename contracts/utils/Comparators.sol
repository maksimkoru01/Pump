// SPDX-License-Identifier: MIT
// OpenZeppelin Contracts (last updated v5.1.0-rc.0) (utils/Comparators.sol)

pragma solidity ^0.8.20;

library Comparators {
    function lt(uint256 a, uint256 b) internal pure returns (bool) {
        return a < b;
    }

    function gt(uint256 a, uint256 b) internal pure returns (bool) {
        return a > b;
    }
}
