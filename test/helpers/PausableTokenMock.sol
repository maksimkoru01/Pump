pragma solidity ^0.4.8;

import '../../contracts/token/PausableToken.sol';

// mock class using PausableToken
contract PausableTokenMock is PausableToken {

  function PausableTokenMock(address initialAccount, uint256 initialBalance) {
    balances[initialAccount] = initialBalance;
  }

}
