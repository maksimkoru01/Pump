pragma solidity ^0.5.2;

import "../Crowdsale.sol";
import "../../token/ERC20/ERC20Mintable.sol";

/**
 * @title MintedCrowdsale
 * @dev Extension of Crowdsale contract whose tokens are minted in each purchase.
 * Token ownership should be transferred to MintedCrowdsale for minting.
 */
contract MintedCrowdsale is Crowdsale {
    /**
     * @dev Overrides delivery by minting tokens upon purchase.
     * @param beneficiary Token purchaser
     * @param tokenAmount Number of tokens to be minted
     */
    function _deliverTokens(address beneficiary, uint256 tokenAmount) internal {
        // Potentially dangerous assumption about the type of the token.
        // solhint-disable-next-line max-line-length
        require(ERC20Mintable(address(token())).mint(beneficiary, tokenAmount), "from OpenZeppelin's:MintedCrowdsale.sol:_deliverTokens().");
    }
}
