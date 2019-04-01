pragma solidity ^0.5.2;

import "./RefundableCrowdsale.sol";
import "./PostDeliveryCrowdsale.sol";


/**
 * @title RefundablePostDeliveryCrowdsale
 * @dev Extension of RefundableCrowdsale contract that only delivers the tokens
 * once the crowdsale has closed and the goal met, preventing refunds to be issued
 * to token holders.
 */
contract RefundablePostDeliveryCrowdsale is RefundableCrowdsale, PostDeliveryCrowdsale {
    function withdrawTokens(address beneficiary) public {
        // solhint-disable-next-line max-line-length
        require(finalized(), "from OpenZeppelin's:RefundablePostDeliveryCrowdsale.sol:withdrawTokens(). Call to finalized() returned false.");
        // solhint-disable-next-line max-line-length
        require(goalReached(), "from OpenZeppelin's:RefundablePostDeliveryCrowdsale.sol:withdrawTokens(). Call to goalReached() returned false.");

        super.withdrawTokens(beneficiary);
    }
}
