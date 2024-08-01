// SPDX-License-Identifier: MIT
// Compatible with OpenZeppelin Contracts ^5.0.0
pragma solidity ^0.8.20;

import "@openzeppelin/contracts@5.0.2/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts@5.0.2/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts@5.0.2/token/ERC20/extensions/ERC20Permit.sol";
import "@openzeppelin/contracts@5.0.2/access/Ownable.sol";

contract CumShot is ERC20, ERC20Burnable, ERC20Permit, Ownable {
    constructor(address initialOwner)
        ERC20("Cum Shot", "Cum")
        ERC20Permit("Cum Shot")
        Ownable(initialOwner)
    {
        _mint(msg.sender, 21000000000 * 10 ** decimals());
    }
}
