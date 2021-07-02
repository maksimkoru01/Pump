// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../governance/compatibility/GovernorCompatibilityBravo.sol";
import "../governance/extensions/GovernorWithERC20VotesComp.sol";
import "../governance/extensions/GovernorTimelockCompound.sol";

contract GovernorCompatibilityBravoMock is
    GovernorCompatibilityBravo,
    GovernorTimelockCompound,
    GovernorWithERC20VotesComp
{
    constructor(
        string memory name_,
        address token_,
        address timelock_
    ) Governor(name_) GovernorWithERC20VotesComp(token_) GovernorTimelockCompound(timelock_) {}

    function supportsInterface(bytes4 interfaceId)
        public
        view
        virtual
        override(IERC165, Governor, GovernorTimelockCompound)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    function votingPeriod() public pure override(IGovernor, Governor) returns (uint64) {
        return 16; // blocks
    }

    function quorum(uint256) public pure override(IGovernor, Governor) returns (uint256) {
        return 0;
    }

    function state(uint256 proposalId)
        public
        view
        virtual
        override(IGovernor, Governor, GovernorTimelockCompound)
        returns (ProposalState)
    {
        return super.state(proposalId);
    }

    function proposalEta(uint256 proposalId)
        public
        view
        virtual
        override(GovernorCompatibilityBravo, GovernorTimelockCompound)
        returns (uint256)
    {
        return super.proposalEta(proposalId);
    }

    function propose(
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        string memory description
    ) public virtual override(IGovernor, Governor, GovernorCompatibilityBravo) returns (uint256) {
        return super.propose(targets, values, calldatas, description);
    }

    function queue(
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 salt
    ) public virtual override(GovernorCompatibilityBravo, GovernorTimelockCompound) returns (uint256) {
        return super.queue(targets, values, calldatas, salt);
    }

    function execute(
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 salt
    ) public payable virtual override(IGovernor, Governor, GovernorTimelockCompound) returns (uint256) {
        return super.execute(targets, values, calldatas, salt);
    }

    function cancel(
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 salt
    ) public returns (uint256 proposalId) {
        return _cancel(targets, values, calldatas, salt);
    }

    function _cancel(
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 salt
    ) internal virtual override(Governor, GovernorTimelockCompound) returns (uint256 proposalId) {
        return super._cancel(targets, values, calldatas, salt);
    }

    function getVotes(address account, uint256 blockNumber)
        public
        view
        virtual
        override(IGovernor, GovernorWithERC20VotesComp)
        returns (uint256)
    {
        return super.getVotes(account, blockNumber);
    }

    function _executor() internal view virtual override(Governor, GovernorTimelockCompound) returns (address) {
        return super._executor();
    }
}
