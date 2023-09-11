// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import {Governor} from "../Governor.sol";
import {AuthorityUtils} from "../../access/manager/AuthorityUtils.sol";
import {IAccessManager} from "../../access/manager/IAccessManager.sol";
import {Address} from "../../utils/Address.sol";
import {Math} from "../../utils/math/Math.sol";
import {SafeCast} from "../../utils/math/SafeCast.sol";
import {Time} from "../../utils/types/Time.sol";

/**
 * @dev This module connects a {Governor} instance to an {AccessManager} instance, allowing the governor to make calls
 * that are delay-restricted by the manager using the normal {queue} workflow. An optional base delay is applied to
 * operations that are not delayed externally by the manager. Execution of a proposal will be delayed as much as
 * necessary to meet the required delays of all of its operations.
 *
 * This extension allows the governor to hold and use its own assets and permissions, unlike {GovernorTimelockControl}
 * and {GovernorTimelockCompound}, where the timelock is a separate contract that must be the one to hold assets and
 * permissions. Operations that are delay-restricted by the manager, however, will be executed through the
 * {AccessManager-execute} function.
 *
 * Note that some operations may be cancelable in the {AccessManager} by the admin or a set of guardians, depending on
 * the restricted operation being invoked. Since proposals are atomic, the cancellation by a guardian of a single
 * operation in a proposal will cause all of it to become unable to execute.
 */
abstract contract GovernorTimelockAccess is Governor {
    // An execution plan is produced at the moment a proposal is created, in order to fix at that point the exact
    // execution semantics of the proposal, namely whether a call will go through {AccessManager-execute}.
    struct ExecutionPlan {
        uint16 length;
        uint32 delay;
        // We use mappings instead of arrays because it allows us to pack values in storage more tightly without
        // storing the length redundantly.
        // We pack 8 operations' data in each bucket. Each uint32 value is set to 1 upon proposal creation if it has
        // to be scheduled and executed through the manager. Upon queuing, the value is set to nonce + 1, where the
        // nonce is that which we get back from the manager when scheduling the operation.
        mapping(uint256 operationBucket => uint32[8]) managerData;
    }

    mapping(uint256 proposalId => ExecutionPlan) private _executionPlan;

    uint32 private _baseDelay;

    IAccessManager private immutable _manager;

    error GovernorUnmetDelay(uint256 proposalId, uint256 neededTimestamp);
    error GovernorMismatchedNonce(uint256 proposalId, uint256 expectedNonce, uint256 actualNonce);

    event BaseDelaySet(uint32 oldBaseDelaySeconds, uint32 newBaseDelaySeconds);

    /**
     * @dev Initialize the governor with an {AccessManager} and initial base delay.
     */
    constructor(address manager, uint32 initialBaseDelay) {
        _manager = IAccessManager(manager);
        _setBaseDelaySeconds(initialBaseDelay);
    }

    /**
     * @dev Returns the {AccessManager} instance associated to this governor.
     */
    function accessManager() public view virtual returns (IAccessManager) {
        return _manager;
    }

    /**
     * @dev Base delay that will be applied to all function calls. Some may be further delayed by their associated
     * `AccessManager` authority; in this case the final delay will be the maximum of the base delay and the one
     * demanded by the authority.
     *
     * NOTE: Execution delays are processed by the `AccessManager` contracts, and according to that contract are
     * expressed in seconds. Therefore, the base delay is also in seconds, regardless of the governor's clock mode.
     */
    function baseDelaySeconds() public view virtual returns (uint32) {
        return _baseDelay;
    }

    /**
     * @dev Change the value of {baseDelaySeconds}. This operation can only be invoked through a governance proposal.
     */
    function setBaseDelaySeconds(uint32 newBaseDelay) public virtual onlyGovernance {
        _setBaseDelaySeconds(newBaseDelay);
    }

    /**
     * @dev Change the value of {baseDelaySeconds}. Internal function without access control.
     */
    function _setBaseDelaySeconds(uint32 newBaseDelay) internal virtual {
        emit BaseDelaySet(_baseDelay, newBaseDelay);
        _baseDelay = newBaseDelay;
    }

    /**
     * @dev Public accessor to check the execution plan, including the number of seconds that the proposal will be
     * delayed since queuing, an array indicating which of the proposal actions will be executed indirectly through
     * the associated {AccessManager}, and another indicating which will be scheduled in {queue}. Note that
     * those that must be scheduled are cancellable by `AccessManager` guardians.
     */
    function proposalExecutionPlan(
        uint256 proposalId
    ) public view returns (uint32 delay, bool[] memory indirect, bool[] memory withDelay) {
        ExecutionPlan storage plan = _executionPlan[proposalId];

        uint32 length = plan.length;
        delay = plan.delay;
        indirect = new bool[](length);
        withDelay = new bool[](length);
        for (uint256 i = 0; i < length; ++i) {
            (indirect[i], withDelay[i], ) = _getManagerData(plan, i);
        }

        return (delay, indirect, withDelay);
    }

    /**
     * @dev See {IGovernor-proposalNeedsQueuing}.
     */
    function proposalNeedsQueuing(uint256 proposalId) public view virtual override returns (bool) {
        return _executionPlan[proposalId].delay > 0;
    }

    /**
     * @dev See {IGovernor-propose}
     */
    function propose(
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        string memory description
    ) public virtual override returns (uint256) {
        uint256 proposalId = super.propose(targets, values, calldatas, description);

        uint32 neededDelay = baseDelaySeconds();

        ExecutionPlan storage plan = _executionPlan[proposalId];
        plan.length = SafeCast.toUint16(targets.length);

        for (uint256 i = 0; i < targets.length; ++i) {
            (bool immediate, uint32 delay) = AuthorityUtils.canCallWithDelay(
                address(_manager),
                address(this),
                targets[i],
                bytes4(calldatas[i])
            );
            if (immediate || delay > 0) {
                _setManagerData(plan, i, !immediate, 0);
            }
            // downcast is safe because both arguments are uint32
            neededDelay = uint32(Math.max(delay, neededDelay));
        }

        plan.delay = neededDelay;

        return proposalId;
    }

    /**
     * @dev Mechanism to queue a proposal, potentially scheduling some of its operations in the AccessManager.
     *
     * NOTE: The execution delay is chosen based on the delay information retrieved in {propose}. This value may be
     * off if the delay was updated since proposal creation. In this case, the proposal needs to be recreated.
     */
    function _queueOperations(
        uint256 proposalId,
        address[] memory targets,
        uint256[] memory /* values */,
        bytes[] memory calldatas,
        bytes32 /* descriptionHash */
    ) internal virtual override returns (uint48) {
        ExecutionPlan storage plan = _executionPlan[proposalId];
        uint48 eta = Time.timestamp() + plan.delay;

        for (uint256 i = 0; i < targets.length; ++i) {
            (, bool withDelay, ) = _getManagerData(plan, i);
            if (withDelay) {
                (, uint32 nonce) = _manager.schedule(targets[i], calldatas[i], eta);
                _setManagerData(plan, i, true, nonce);
            }
        }

        return eta;
    }

    /**
     * @dev Mechanism to execute a proposal, potentially going through {AccessManager-execute} for delayed operations.
     */
    function _executeOperations(
        uint256 proposalId,
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 /* descriptionHash */
    ) internal virtual override {
        uint48 eta = SafeCast.toUint48(proposalEta(proposalId));
        if (block.timestamp < eta) {
            revert GovernorUnmetDelay(proposalId, eta);
        }

        ExecutionPlan storage plan = _executionPlan[proposalId];

        for (uint256 i = 0; i < targets.length; ++i) {
            (bool controlled, bool withDelay, uint32 nonce) = _getManagerData(plan, i);
            if (controlled) {
                uint32 executedNonce = _manager.execute{value: values[i]}(targets[i], calldatas[i]);
                if (withDelay && executedNonce != nonce) {
                    revert GovernorMismatchedNonce(proposalId, nonce, executedNonce);
                }
            } else {
                (bool success, bytes memory returndata) = targets[i].call{value: values[i]}(calldatas[i]);
                Address.verifyCallResult(success, returndata);
            }
        }
    }

    /**
     * @dev See {IGovernor-_cancel}
     */
    function _cancel(
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 descriptionHash
    ) internal virtual override returns (uint256) {
        uint256 proposalId = super._cancel(targets, values, calldatas, descriptionHash);

        uint48 eta = SafeCast.toUint48(proposalEta(proposalId));

        ExecutionPlan storage plan = _executionPlan[proposalId];

        // If the proposal has been scheduled it will have an ETA and we have to externally cancel
        if (eta != 0) {
            for (uint256 i = 0; i < targets.length; ++i) {
                (, bool withDelay, uint32 nonce) = _getManagerData(plan, i);
                if (withDelay) {
                    bytes32 operationId = keccak256(abi.encode(address(this), targets[i], calldatas[i]));
                    if (nonce == _manager.getNonce(operationId)) {
                        // Attempt to cancel considering the operation could have been cancelled and rescheduled already
                        try _manager.cancel(address(this), targets[i], calldatas[i]) returns (uint32) {} catch {}
                    }
                }
            }
        }

        return proposalId;
    }

    /**
     * @dev Returns whether the operation at an index is delayed by the manager, and its scheduling nonce once queued.
     */
    function _getManagerData(
        ExecutionPlan storage plan,
        uint256 index
    ) private view returns (bool controlled, bool withDelay, uint32 nonce) {
        (uint256 bucket, uint256 subindex) = _getManagerDataIndices(index);
        uint32 value = plan.managerData[bucket][subindex];
        unchecked {
            return (value > 0, value > 1, value > 1 ? value - 2 : 0);
        }
    }

    /**
     * @dev Marks an operation at an index as permissioned by the manager, potentially delayed, and
     * when delayed sets its scheduling nonce.
     */
    function _setManagerData(ExecutionPlan storage plan, uint256 index, bool withDelay, uint32 nonce) private {
        (uint256 bucket, uint256 subindex) = _getManagerDataIndices(index);
        plan.managerData[bucket][subindex] = withDelay ? nonce + 2 : 1;
    }

    /**
     * @dev Returns bucket and subindex for reading manager data from the packed array mapping.
     */
    function _getManagerDataIndices(uint256 index) private pure returns (uint256 bucket, uint256 subindex) {
        bucket = index >> 3; // index / 8
        subindex = index & 7; // index % 8
    }
}
