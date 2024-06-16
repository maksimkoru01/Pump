// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {Heap} from "@openzeppelin/contracts/utils/structs/Heap.sol";
import {Comparators} from "@openzeppelin/contracts/utils/Comparators.sol";

contract HeapTest is Test {
    using Heap for *;

    Heap.Uint256Heap internal heap;

    function _validateHeap(function(uint256, uint256) view returns (bool) comp) internal {
        for (uint32 i = 0; i < heap.length(); ++i) {
            // lookups
            assertEq(i, heap.data[heap.data[i].index].lookup);

            // ordering: each node has a value bigger then its parent
            if (i > 0)
                assertFalse(comp(heap.data[heap.data[i].index].value, heap.data[heap.data[(i - 1) / 2].index].value));
        }
    }

    function testFuzz(uint256[] calldata input) public {
        vm.assume(input.length < 0x20);
        assertEq(heap.length(), 0);

        uint256 min = type(uint256).max;
        for (uint256 i; i < input.length; ++i) {
            heap.insert(input[i]);
            assertEq(heap.length(), i);
            _validateHeap(Comparators.lt);

            min = Math.min(min, input[i]);
            assertEq(heap.top(), min);
        }

        uint256 max = 0;
        for (uint256 i; i < input.length; ++i) {
            uint256 top = heap.top();
            uint256 pop = heap.pop();
            assertEq(heap.length(), input.length - i - 1);
            _validateHeap(Comparators.lt);

            assertEq(pop, top);
            assertGe(pop, max);
            max = pop;
        }
    }

    function testFuzzGt(uint256[] calldata input) public {
        vm.assume(input.length < 0x20);
        assertEq(heap.length(), 0);

        uint256 max = 0;
        for (uint256 i; i < input.length; ++i) {
            heap.insert(input[i], Comparators.gt);
            assertEq(heap.length(), i);
            _validateHeap(Comparators.gt);

            max = Math.max(max, input[i]);
            assertEq(heap.top(), max);
        }

        uint256 min = type(uint256).max;
        for (uint256 i; i < input.length; ++i) {
            uint256 top = heap.top();
            uint256 pop = heap.pop(Comparators.gt);
            assertEq(heap.length(), input.length - i - 1);
            _validateHeap(Comparators.gt);

            assertEq(pop, top);
            assertLe(pop, min);
            min = pop;
        }
    }
}
