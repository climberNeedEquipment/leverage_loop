// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

interface IPancakeV3FlashCallback {
    function pancakeV3FlashCallback(
        uint256 fee0,
        uint256 fee1,
        bytes calldata data
    ) external;
}
