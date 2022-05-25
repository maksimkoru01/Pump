// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../utils/cryptography/MerkleProof.sol";

contract MerkleProofWrapper {
    function verify(
        bytes32[] memory proof,
        bytes32 root,
        bytes32 leaf
    ) public pure returns (bool) {
        return MerkleProof.verify(proof, root, leaf);
    }

    function verifyCall(
        bytes32[] calldata proof,
        bytes32 root,
        bytes32 leaf
    ) public pure returns (bool) {
        return MerkleProof.verifyCall(proof, root, leaf);
    }

    function processProof(bytes32[] memory proof, bytes32 leaf) public pure returns (bytes32) {
        return MerkleProof.processProof(proof, leaf);
    }

    function processProofCall(bytes32[] calldata proof, bytes32 leaf) public pure returns (bytes32) {
        return MerkleProof.processProofCall(proof, leaf);
    }

    function multiProofVerify(
        bytes32 root,
        bytes32[] memory leafs,
        bytes32[] memory proofs,
        bool[] memory proofFlag
    ) public pure returns (bool) {
        return MerkleProof.multiProofVerify(root, leafs, proofs, proofFlag);
    }

    function multiProofVerifyCall(
        bytes32 root,
        bytes32[] calldata leafs,
        bytes32[] calldata proofs,
        bool[] calldata proofFlag
    ) public pure returns (bool) {
        return MerkleProof.multiProofVerifyCall(root, leafs, proofs, proofFlag);
    }

    function processMultiProof(
        bytes32[] memory leafs,
        bytes32[] memory proofs,
        bool[] memory proofFlag
    ) public pure returns (bytes32) {
        return MerkleProof.processMultiProof(leafs, proofs, proofFlag);
    }

    function processMultiProofCall(
        bytes32[] calldata leafs,
        bytes32[] calldata proofs,
        bool[] calldata proofFlag
    ) public pure returns (bytes32) {
        return MerkleProof.processMultiProofCall(leafs, proofs, proofFlag);
    }
}
