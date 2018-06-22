pragma solidity ^0.4.24;

import "../ownership/Ownable.sol";
import "../token/ERC20/ERC20.sol";


/**
 * @title TokenDestructible:
 * @author Remco Bloemen <remco@2π.com>
 * @dev Base contract that can be destroyed by owner. All funds in contract including
 * listed tokens will be sent to the owner.
 */
contract TokenDestructible is Ownable {

  constructor() public payable { }

  /**
   * @notice Terminate contract and refund to owner
   * @param _tokens List of addresses of ERC20 token contracts to
   refund.
   * @notice The called token contracts could try to re-enter this contract. Only
   supply token contracts you trust.
   */
  function destroy(address[] memory _tokens) public onlyOwner {

    // Transfer tokens to owner
    for (uint256 i = 0; i < _tokens.length; i++) {
      ERC20 token = ERC20(_tokens[i]);
      uint256 balance = token.balanceOf(this);
      token.transfer(owner, balance);
    }

    // Transfer Eth to owner and terminate contract
    selfdestruct(owner);
  }
}
