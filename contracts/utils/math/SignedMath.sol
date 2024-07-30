// SPDX-License-Identifier: MIT
// OpenZeppelin Contracts (last updated v5.0.0) (utils/math/SignedMath.sol)

pragma solidity ^0.8.20;

import {SafeCast} from "./SafeCast.sol";

/**
 * @dev Standard signed math utilities missing in the Solidity language.
 */
library SignedMath {
    /**
     * @dev Branchless ternary evaluation for `a ? b : c`. Gas costs are constant.
     *
     * IMPORTANT: This function may reduce bytecode size and consume less gas when used standalone.
     * However, the compiler may optimize Solidity ternary operations (i.e. `a ? b : c`) to only compute
     * one branch when needed, making this function more expensive.
     */
    function ternary(bool condition, int256 a, int256 b) internal pure returns (int256) {
        unchecked {
            // branchless ternary works because:
            // b ^ (a ^ b) == a
            // b ^ 0 == b
            return b ^ ((a ^ b) * int256(SafeCast.toUint(condition)));
        }
    }

    /**
     * @dev Returns the largest of two signed numbers.
     */
    function max(int256 a, int256 b) internal pure returns (int256) {
        return ternary(a > b, a, b);
    }

    /**
     * @dev Returns the smallest of two signed numbers.
     */
    function min(int256 a, int256 b) internal pure returns (int256) {
        return ternary(a < b, a, b);
    }

    /**
     * @dev Returns the average of two signed numbers without overflow.
     * The result is rounded towards zero.
     */
    function average(int256 a, int256 b) internal pure returns (int256) {
        // Formula from the book "Hacker's Delight"
        int256 x = (a & b) + ((a ^ b) >> 1);
        return x + (int256(uint256(x) >> 255) & (a ^ b));
    }

    /**
     * @dev Returns the absolute unsigned value of a signed value.
     */
    function abs(int256 n) internal pure returns (uint256) {
        unchecked {
            // Formula from the "Bit Twiddling Hacks" by Sean Eron Anderson.
            // Since `n` is a signed integer, the generated bytecode will use the SAR opcode to perform the right shift,
            // taking advantage of the most significant (or "sign" bit) in two's complement representation.
            // This opcode adds new most significant bits set to the value of the previous most significant bit. As a result,
            // the mask will either be `bytes(0)` (if n is positive) or `~bytes32(0)` (if n is negative).
            int256 mask = n >> 255;

            // A `bytes(0)` mask leaves the input unchanged, while a `~bytes32(0)` mask complements it.
            return uint256((n + mask) ^ mask);
        }
    }

    /**
     * @dev Signed saturating addition, computes `a + b` saturating at the numeric bounds instead of overflowing.
     */
    function saturatingAdd(int256 a, int256 b) internal pure returns (int256) {
        unchecked {
            int256 c = a + b;
            // Rationale:
            // - overflow is only possible when both `a` and `b` are positive
            // - underflow is only possible when both `a` and `b` are negative
            //
            // Lemma:
            // (i)  - if `a > (a + b)` is true, then `b` MUST be negative, otherwise overflow happened.
            // (ii) - if `a > (a + b)` is false, then `b` MUST be non-negative, otherwise underflow happened.
            //
            // So the following statement will be true only if an overflow or underflow happened:
            // statement: a > (a + b) == (b >= 0)
            //
            // We can use the sign of `b` to distinguish between overflow and underflow, as demonstrated below:
            // | a > (a + b) | b >= 0  |
            // | true        | true    | Lemma (i) thus Overflow
            // | false       | false   | Lemma (ii) thus Underflow
            // | true        | false   | Ok
            // | false       | true    | Ok
            bool sign = b >= 0;
            bool overflow = a > c == sign;

            // Efficient branchless method to retrieve the boundary limit:
            // (1 << 255)     == type(int256).min
            // (1 << 255) - 1 == type(int256).max
            uint256 limit = (SafeCast.toUint(overflow) << 255) - SafeCast.toUint(sign);

            return ternary(overflow, int256(limit), c);
        }
    }

    /**
     * @dev Signed saturating subtraction, computes `a - b` saturating at the numeric bounds instead of overflowing.
     */
    function saturatingSub(int256 a, int256 b) internal pure returns (int256) {
        unchecked {
            int256 c = a - b;
            // Rationale:
            // - overflow is only possible when `a` is zero or positive and `b` is negative
            // - underflow is only possible when `a` is negative and `b` is positive
            //
            // Lemma:
            // (i)  - if `a >= (a - b)` is true, then `b` MUST be non-negative, otherwise overflow happened.
            // (ii) - if `a >= (a - b)` is false, then `b` MUST be negative, otherwise underflow happened.
            //
            // So the following statement will be true only if an overflow or underflow happened:
            // statement: a >= (a - b) == (b < 0)
            //
            // We can use the sign of `b` to distinguish between overflow and underflow, as demonstrated below:
            // | a >= (a - b) | b < 0  |
            // | true         | true   | Lemma (i) thus Overflow
            // | false        | false  | Lemma (ii) thus Underflow
            // | true         | false  | Ok
            // | false        | true   | Ok
            bool sign = b < 0;
            bool overflow = a >= c == sign;

            // Efficient branchless method to retrieve the boundary limit:
            // (1 << 255)     == type(int256).min
            // (1 << 255) - 1 == type(int256).max
            uint256 limit = (SafeCast.toUint(overflow) << 255) - SafeCast.toUint(sign);

            return ternary(overflow, int256(limit), c);
        }
    }
}
