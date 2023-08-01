// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";

import {SignedMath} from "../../../contracts/utils/math/SignedMath.sol";

contract SignedMathTest is Test {
    // MIN
    function testMin(int256 a, int256 b) public {
        int256 result = SignedMath.min(a, b);

        if (a > b) {
            assertTrue(result == b);
        } else {
            assertTrue(result == a);
        }
    }

    // MAX
    function testMax(int256 a, int256 b) public {
        int256 result = SignedMath.max(a, b);

        if (a > b) {
            assertTrue(result == a);
        } else {
            assertTrue(result == b);
        }
    }

    // AVERAGE
    function testAverage(int256 a, int256 b) public {
        int256 result = SignedMath.average(a, b);

        if (a == b) {
            assertEq(result, a);
        } else {
            (int256 min, int256 max) = a < b ? (a, b) : (b, a);
            // average must be between `a` and `b`
            assertTrue(result >= min);
            assertTrue(result <= max);

            unchecked {
                // must be unchecked in order to support `a = type(int256).min, b = type(int256).max`
                uint256 deltaLower = uint256(result - min);
                uint256 deltaUpper = uint256(max - result);
                if (deltaLower > deltaUpper) {
                    assertTrue(deltaLower - deltaUpper <= 1);
                } else {
                    assertTrue(deltaUpper - deltaLower <= 1);
                }
            }
        }
    }

    // ABS
    function testAbs(int256 a) public {
        uint256 result = SignedMath.abs(a);

        if (a < 0) {
            unchecked {
                // must be unchecked in order to support `n = type(int256).min`
                assertEq(result, uint256(-a));
            }
        } else {
            assertEq(result, uint256(a));
        }
    }
}
