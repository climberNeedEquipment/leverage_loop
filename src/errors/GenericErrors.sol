// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

/**
 * @title GenericErrors
 * @notice Generic errors for the contract
 */
library GenericErrors {
    error NotAuthorized();
    error InvalidAmount();
    error InvalidFlashloanAmount();
    error InvalidInitiator();
    error SwapFailed();
    error InvalidAction();
    error InvalidAddress();
    error InvalidSignature();
    error InvalidState();
    error InvalidOperation();
    error InvalidInput();
    error InvalidOutput();
    error InvalidFlashloanAsset();
}
