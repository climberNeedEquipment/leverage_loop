// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import "../interfaces/IERC20.sol";
import "./MockERC20Mintable.sol";

/**
 * @title MockEisenRouter
 * @notice Mock implementation of Eisen Router for testing
 */
contract MockEisenRouter {
    event SwapExecuted(address indexed caller, bytes data, uint256 value);
    struct Rate {
        uint256 num;
        uint256 den;
    }
    mapping(bytes32 => Rate) public rates; // key = keccak256(tokenIn, tokenOut)
    address public defaultTokenIn;
    address public defaultTokenOut;

    function _key(address a, address b) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(a, b));
    }

    function setDefaultPair(address tokenIn, address tokenOut) external {
        defaultTokenIn = tokenIn;
        defaultTokenOut = tokenOut;
    }

    // Set amountOut = amountIn * num / den (caller should encode decimals/price into num/den)
    function setSwapRate(
        address tokenIn,
        address tokenOut,
        uint256 num,
        uint256 den
    ) external {
        require(den != 0, "den=0");
        rates[_key(tokenIn, tokenOut)] = Rate({num: num, den: den});
    }

    /**
     * @notice Receive ETH
     */
    receive() external payable {}

    /**
     * @notice Mock swap function - accepts any call data and performs no-op swap
     * @dev In real implementation, this would perform actual token swaps
     */
    fallback() external payable {
        address tokenIn;
        address tokenOut;
        uint256 amountIn;

        // In the mock, we assume the relevant data is encoded in msg.data
        // The `LeverageLoop` contract encodes (fromToken, toToken, fromAmount)
        if (msg.data.length >= 96) {
            (tokenIn, tokenOut, amountIn) = abi.decode(
                msg.data,
                (address, address, uint256)
            );
        } else {
            // Fallback for cases where full data might not be encoded (e.g., initial ETH transfer)
            tokenIn = defaultTokenIn;
            tokenOut = defaultTokenOut;
            amountIn = msg.value; // Use msg.value for ETH transactions
        }

        Rate memory r = rates[_key(tokenIn, tokenOut)];
        require(r.den != 0, "rate not set");

        // No actual transferFrom from sender to router for mock
        // The LeverageLoop contract handles transferring the tokens to the router

        uint256 amountOut;
        if (amountIn == 0) {
          // If amountIn is zero, then amountOut is also zero.
          amountOut = 0;
        } else {
          // For mock, ensure amountOut is always positive if amountIn is positive.
          // This bypasses complex rate calculations for now and ensures the swap "succeeds".
          amountOut = amountIn / 2; // Arbitrary small but non-zero output for mock success
          require(amountOut > 0, "Mock swap resulted in zero output");
        }

        // Mint tokenOut to caller (which is LeverageLoop contract)
        MockERC20Mintable(tokenOut).mint(msg.sender, amountOut);
        emit SwapExecuted(msg.sender, msg.data, msg.value);
    }

    /**
     * @notice Get vault address (mock)
     */
    function vault() external pure returns (address) {
        return address(0x6);
    }

    /**
     * @notice Get WETH address (mock)
     */
    function wETH() external pure returns (address) {
        return address(0x7);
    }
}
