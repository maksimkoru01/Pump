pragma solidity ^0.5.0;

import "./GSNRecipient.sol";
import "../../cryptography/ECDSA.sol";

contract SigningRecipient is GSNRecipient {
    using ECDSA for bytes32;

    address private _trustedSigner;

    enum SigningRecipientErrorCodes {
        INVALID_SIGNER
    }

    constructor(address trustedSigner) public {
        _trustedSigner = trustedSigner;
    }

    function acceptRelayedCall(
        address relay,
        address from,
        bytes calldata encodedFunction,
        uint256 transactionFee,
        uint256 gasPrice,
        uint256 gasLimit,
        uint256 nonce,
        bytes calldata approvalData,
        uint256
    )
        external
        view
        returns (uint256, bytes memory)
    {
        bytes memory blob = abi.encodePacked(relay, from, encodedFunction, transactionFee, gasPrice, gasLimit, nonce);
        if (keccak256(blob).toEthSignedMessageHash().recover(approvalData) == _trustedSigner) {
            return (_acceptRelayedCall(), "");
        } else {
            return (_declineRelayedCall(uint256(SigningRecipientErrorCodes.INVALID_SIGNER)), "");
        }
    }

    function preRelayedCall(bytes calldata) external returns (bytes32) { }

    function postRelayedCall(bytes calldata, bool, uint256, bytes32) external { }
}
