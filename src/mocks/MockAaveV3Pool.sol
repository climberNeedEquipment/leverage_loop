// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import {IFlashLoanReceiver} from "../interfaces/IFlashLoanReceiver.sol";
import {IERC20} from "../interfaces/IERC20.sol";
import {MockAToken, MockVariableDebtToken} from "./MockAaveTokens.sol";
import {MockERC20Mintable} from "./MockERC20Mintable.sol"; // Direct import

/**
 * @title MockAaveV3Pool
 * @notice Minimal mock of Aave V3 Pool exposing only methods used by `LeverageLoop`
 * @dev This mock does not move real liquidity. It simulates callbacks and emits events
 *      so higher-level logic can be tested without a full Aave deployment.
 */
contract MockAaveV3Pool {
    // ============ Events ============
    event FlashLoanInvoked(
        address indexed receiver,
        address[] assets,
        uint256[] amounts,
        uint256[] premiums
    );
    event Supplied(
        address indexed asset,
        uint256 amount,
        address indexed onBehalfOf
    );
    event Borrowed(
        address indexed asset,
        uint256 amount,
        address indexed onBehalfOf
    );
    event Repaid(
        address indexed asset,
        uint256 amount,
        address indexed onBehalfOf
    );
    event Withdrawn(address indexed asset, uint256 amount, address indexed to);

    struct Listing {
        address aToken;
        address variableDebtToken;
        uint8 decimals;
    }

    mapping(address => Listing) public listings; // underlying => wrappers

    // 9 bps default premium like typical flashloan settings
    uint256 public premiumBps = 9; // 0.09%

    function setPremiumBps(uint256 newPremiumBps) external {
        premiumBps = newPremiumBps;
    }

    /**
     * @notice Simulate Aave flashLoan by calling `executeOperation` on the receiver
     * @dev Does not transfer real funds. Premiums are computed and passed to the callback.
     */
    function flashLoan(
        address receiverAddress,
        address[] memory assets,
        uint256[] memory amounts,
        uint256[] memory /*modes*/,
        address /*onBehalfOf*/,
        bytes memory params,
        uint16 /*referralCode*/
    ) external {
        uint256[] memory premiums = new uint256[](assets.length);
        for (uint256 i = 0; i < assets.length; i++) {
            premiums[i] = (amounts[i] * premiumBps) / 10000;
            // Simulate the flashloaned tokens appearing in the receiver's balance
            if (amounts[i] > 0) {
                MockERC20Mintable(assets[i]).mint(receiverAddress, amounts[i]);
            }
        }

        emit FlashLoanInvoked(receiverAddress, assets, amounts, premiums);

        // Invoke callback as Aave would
        bool ok = IFlashLoanReceiver(receiverAddress).executeOperation(
            assets,
            amounts,
            premiums,
            receiverAddress,
            params
        );
        require(ok, "executeOperation failed");

        // In real Aave, pool would pull repayment. Here we just assume success.
    }

    function supply(
        address asset,
        uint256 amount,
        address onBehalfOf,
        uint16 /*referralCode*/
    ) external {
        // Pull underlying from caller (pool must be approved)
        if (amount > 0) {
            IERC20(asset).transferFrom(msg.sender, address(this), amount);
        }
        // Mint aTokens to onBehalfOf if listed
        Listing memory l = listings[asset];
        if (l.aToken != address(0)) {
            MockAToken(l.aToken).mint(onBehalfOf, amount);
        }
        emit Supplied(asset, amount, onBehalfOf);
    }

    function borrow(
        address asset,
        uint256 amount,
        uint256 /*interestRateMode*/,
        uint16 /*referralCode*/,
        address onBehalfOf
    ) external {
        // Mint variable debt to onBehalfOf if listed and send underlying from pool to borrower
        Listing memory l = listings[asset];
        if (l.variableDebtToken != address(0)) {
            MockVariableDebtToken(l.variableDebtToken).mint(onBehalfOf, amount);
        }
        if (amount > 0) {
            IERC20(asset).transfer(onBehalfOf, amount);
        }
        emit Borrowed(asset, amount, onBehalfOf);
    }

    function repay(
        address asset,
        uint256 amount,
        uint256 /*interestRateMode*/,
        address onBehalfOf
    ) external returns (uint256) {
        // Pull underlying from payer and burn variable debt from onBehalfOf if listed
        if (amount > 0) {
            IERC20(asset).transferFrom(msg.sender, address(this), amount);
        }
        Listing memory l = listings[asset];
        if (l.variableDebtToken != address(0)) {
            MockVariableDebtToken(l.variableDebtToken).burn(onBehalfOf, amount);
        }
        emit Repaid(asset, amount, onBehalfOf);
        return amount;
    }

    /**
     * @notice Allows funding the MockAaveV3Pool with underlying tokens.
     * @dev Only callable by a token's minter (which is initially deployer).
     */
    function fund(address token, uint256 amount) external {
        IERC20(token).transferFrom(msg.sender, address(this), amount);
    }

    function withdraw(
        address asset,
        uint256 amount,
        address to
    ) external returns (uint256) {
        // Burn aTokens from msg.sender and transfer underlying to `to` if listed
        Listing memory l = listings[asset];
        if (l.aToken != address(0)) {
            MockAToken(l.aToken).burn(msg.sender, amount);
            IERC20(asset).transfer(to, amount);
        }
        emit Withdrawn(asset, amount, to);
        return amount;
    }

    function listReserve(
        address underlying,
        address aToken,
        address vDebtToken,
        uint8 decimals
    ) external {
        listings[underlying] = Listing({
            aToken: aToken,
            variableDebtToken: vDebtToken,
            decimals: decimals
        });
    }

    // Mock function to set a reserve as collateral
    function setUserUseReserveAsCollateral(
        address asset,
        bool useAsCollateral
    ) external {
        // In a real Aave pool, this would update user configuration
        // For mock, we simply acknowledge the call.
        // We can optionally add an event if needed for testing specific behavior.
        emit SetUserUseReserveAsCollateral(msg.sender, asset, useAsCollateral);
    }

    event SetUserUseReserveAsCollateral(
        address indexed user,
        address indexed asset,
        bool useAsCollateral
    );
}
