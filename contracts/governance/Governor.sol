// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../utils/cryptography/ECDSA.sol";
import "../utils/cryptography/draft-EIP712.sol";
import "../utils/Address.sol";
import "../utils/Context.sol";
import "../utils/Time.sol";
import "./IGovernor.sol";

abstract contract Governor is IGovernor, EIP712, Context {
    using Time for Time.Timer;

    bytes32 private constant _BALLOT_TYPEHASH = keccak256("Ballot(uint256 proposalId,uint8 support)");

    struct Proposal {
        Time.Timer timer;
        uint256 snapshot;
        bool canceled;
    }

    mapping (uint256 => Proposal) private _proposals;
    mapping (uint256 => mapping (address => bool)) private _votes;

    /*************************************************************************
     *                           Public interface                            *
     *************************************************************************/
    function propose(
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 salt,
        string memory description
    )
        public virtual override returns (uint256 proposalId)
    {
        uint256 snapshot;
        uint256 deadline;
        (proposalId, snapshot, deadline) = _propose(targets, values, calldatas, salt);
        emit ProposalCreated(proposalId, _msgSender(), targets, values, calldatas, salt, snapshot, deadline, description);
    }

    function execute(
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 salt
    )
        public payable virtual override returns (uint256 proposalId)
    {
        proposalId = _execute(targets, values, calldatas, salt);
        emit ProposalExecuted(proposalId);
    }

    function castVote(uint256 proposalId, uint8 support) public virtual override returns (uint256) {
        address voter = _msgSender();
        return _castVote(proposalId, voter, support);
    }

    function castVoteBySig(
        uint256 proposalId,
        uint8 support,
        uint8 v,
        bytes32 r,
        bytes32 s
    )
        public virtual override returns (uint256)
    {
        address voter = ECDSA.recover(
            _hashTypedDataV4(keccak256(abi.encode(_BALLOT_TYPEHASH, proposalId, support))),
            v, r, s
        );
        return _castVote(proposalId, voter, support);
    }

    /*************************************************************************
     *                            View functions                             *
     *************************************************************************/
    function state(uint256 proposalId) public view virtual override returns (ProposalState) {
        Proposal memory proposal = _proposals[proposalId];

        if (proposal.timer.isUnset()) {
            // There is no ProposalState for unset proposals
            revert("Governor::state: invalid proposal id");
        } else if (block.number <= proposal.snapshot) {
            return ProposalState.Pending;
        } else if (proposal.timer.isPending()) {
            return ProposalState.Active;
        } else if (proposal.timer.isExpired()) {
            return (proposalWeight(proposalId) >= quorum(proposal.snapshot) && _voteSuccess(proposalId))
                ? ProposalState.Succeeded
                : ProposalState.Defeated;
        } else if (proposal.canceled) {
            return ProposalState.Canceled;
        } else {
            return ProposalState.Executed;
        }
    }

    function proposalDeadline(uint256 proposalId) public view virtual override returns (uint256) {
        return _proposals[proposalId].timer.getDeadline();
    }

    function proposalSnapshot(uint256 proposalId) public view virtual override returns (uint256) {
        return _proposals[proposalId].snapshot;
    }

    function hasVoted(uint256 proposalId, address account) public view virtual override returns (bool) {
        return _votes[proposalId][account];
    }

    function hashProposal(
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 salt
    )
        public view virtual override returns (uint256 proposalId)
    {
        return uint256(keccak256(abi.encode(targets, values, calldatas, salt)));
    }

    /*************************************************************************
     *                               Internal                                *
     *************************************************************************/
    function _propose(
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 salt
    )
        internal virtual returns (uint256 proposalId, uint256 snapshot, uint256 deadline)
    {
        proposalId = hashProposal(targets, values, calldatas, salt);

        require(targets.length == values.length,    "Governance: invalid proposal length");
        require(targets.length == calldatas.length, "Governance: invalid proposal length");
        require(targets.length > 0,                 "Governance: empty proposal");

        Proposal storage proposal = _proposals[proposalId];
        require(proposal.timer.isUnset(), "Governance: proposal already exists");

        snapshot = block.number + votingDelay();
        deadline = block.timestamp + votingDuration();

        proposal.snapshot = snapshot;
        proposal.timer.setDeadline(deadline);
    }

    function _cancel(
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 salt
    )
        internal virtual returns (uint256 proposalId)
    {
        proposalId = hashProposal(targets, values, calldatas, salt);
        _proposals[proposalId].timer.lock();
        _proposals[proposalId].canceled = true;
        emit ProposalCanceled(proposalId);
    }

    function _execute(
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 salt
    )
        internal virtual returns (uint256 proposalId)
    {
        proposalId = hashProposal(targets, values, calldatas, salt);

        Proposal storage proposal = _proposals[proposalId];
        require(proposal.timer.isExpired(), "Governance: proposal not ready");
        require(proposalWeight(proposalId) >= quorum(proposal.snapshot), "Governance: quorum not reached");
        require(_voteSuccess(proposalId), "Governance: required score not reached");
        proposal.timer.lock();

        _calls(proposalId, targets, values, calldatas, salt);
    }

    function _castVote(
        uint256 proposalId,
        address account,
        uint8 support
    )
        internal virtual returns (uint256 weight)
    {
        Proposal storage proposal = _proposals[proposalId];
        require(proposal.timer.isPending(), "Governance: vote not currently active");

        require(!_votes[proposalId][account], "Governance: vote already casted");
        _votes[proposalId][account] = true;

        weight = getVotes(account, proposal.snapshot);
        _pushVote(proposalId, support, weight);

        emit VoteCast(account, proposalId, support, weight);
    }

    function _calls(
        uint256 /*proposalId*/,
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 /*salt*/
    )
        internal virtual
    {
        for (uint256 i = 0; i < targets.length; ++i) {
            _call(targets[i], values[i], calldatas[i]);
        }
    }

    function _call(
        address target,
        uint256 value,
        bytes memory data
    )
        internal virtual
    {
        if (data.length == 0) {
            Address.sendValue(payable(target), value);
        } else {
            Address.functionCallWithValue(target, data, value);
        }
    }
}
