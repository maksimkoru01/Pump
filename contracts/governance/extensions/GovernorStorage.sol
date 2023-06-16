// SPDX-License-Identifier: MIT

pragma solidity ^0.8.19;

import "../Governor.sol";

/**
 * @dev Extension of {Governor} that implements storage of proposal details. This modules also provides primitives for
 * the enumerability of proposals.
 *
 * Usecases for this module include:
 * - UIs that expore the proposal state without relying on event indexing.
 * - For some L2 chains where storage is compared to calldata, using a the proposalId version of queue and execute
 *   might me cheaper.
 *
 * _Available since v5.0._
 */
abstract contract GovernorStorage is Governor {
    struct ProposalDetails {
        address[] targets;
        uint256[] values;
        bytes[] calldatas;
        bytes32 descriptionHash;
    }

    uint256[] private _proposalIds;
    mapping(uint256 => ProposalDetails) private _proposalDetails;

    /**
     * @dev See {IGovernor-propose}.
     */
    function propose(
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        string memory description
    ) public virtual override returns (uint256) {
        uint256 proposalId = super.propose(targets, values, calldatas, description);
        // store
        _proposalIds.push(proposalId);
        _proposalDetails[proposalId] = ProposalDetails({
            targets: targets,
            values: values,
            calldatas: calldatas,
            descriptionHash: keccak256(bytes(description))
        });
        return proposalId;
    }

    /**
     * @dev ProposalId version of {IGovernorTimelock-queue}.
     */
    function queue(uint256 proposalId) public virtual {
        ProposalDetails storage proposalDetails = _proposalDetails[proposalId];
        queue(
            proposalDetails.targets,
            proposalDetails.values,
            proposalDetails.calldatas,
            proposalDetails.descriptionHash
        );
    }

    /**
     * @dev ProposalId version of {IGovernor-execute}.
     */
    function execute(uint256 proposalId) public payable virtual {
        ProposalDetails storage proposalDetails = _proposalDetails[proposalId];
        execute(
            proposalDetails.targets,
            proposalDetails.values,
            proposalDetails.calldatas,
            proposalDetails.descriptionHash
        );
    }

    /**
     * @dev ProposalId version of {IGovernor-cancel}.
     */
    function cancel(uint256 proposalId) public virtual {
        ProposalDetails storage proposalDetails = _proposalDetails[proposalId];
        cancel(
            proposalDetails.targets,
            proposalDetails.values,
            proposalDetails.calldatas,
            proposalDetails.descriptionHash
        );
    }

    /**
     * @dev Return the number of stored proposals.
     */
    function getProposalCount() public view virtual returns (uint256) {
        return _proposalIds.length;
    }

    /**
     * @dev Return the details of a proposalId.
     */
    function getProposalDetails(
        uint256 proposalId
    ) public view virtual returns (uint256, address[] memory, uint256[] memory, bytes[] memory) {
        ProposalDetails storage details = _proposalDetails[proposalId];
        return (proposalId, details.targets, details.values, details.calldatas);
    }

    /**
     * @dev Return the details (including the proposalId) of a proposal given its sequential index.
     */
    function getProposalDetailsAt(
        uint256 index
    ) public view virtual returns (uint256, address[] memory, uint256[] memory, bytes[] memory) {
        return getProposalDetails(_proposalIds[index]);
    }
}
