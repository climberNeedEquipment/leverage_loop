// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

/**
 * @title IVariableDebtToken
 * @notice Interface for Aave V3 Variable Debt Token
 */
interface IVariableDebtToken {
    /**
     * @notice Delegates borrowing power to a user on the specific debt token
     * @param delegatee The address receiving the delegated borrowing power
     * @param amount The maximum amount being delegated
     */
    function approveDelegation(address delegatee, uint256 amount) external;

    /**
     * @notice Returns the borrowing allowance of a user on the specific debt token
     * @param fromUser The user to giving allowance
     * @param toUser The user to give allowance to
     * @return The current allowance of toUser
     */
    function borrowAllowance(
        address fromUser,
        address toUser
    ) external view returns (uint256);

    /**
     * @notice Returns the debt balance of the user
     * @param user The address of the user
     * @return The debt balance of the user since the last burn/mint action
     */
    function balanceOf(address user) external view returns (uint256);
}
