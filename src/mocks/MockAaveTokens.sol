// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "./MockERC20Mintable.sol";
import "../interfaces/IVariableDebtToken.sol";

contract MockAToken is MockERC20Mintable {
    constructor(string memory name, string memory symbol, uint8 decimals) MockERC20Mintable(name, symbol, decimals) {}
}

contract MockVariableDebtToken is MockERC20Mintable, IVariableDebtToken {
    mapping(address => mapping(address => uint256)) public delegationApprovals;

    constructor(string memory name, string memory symbol, uint8 decimals) MockERC20Mintable(name, symbol, decimals) {}

    function approveDelegation(address delegatee, uint256 amount) external {
        delegationApprovals[msg.sender][delegatee] = amount;
    }

    function borrowAllowance(address from, address to) external view returns (uint256) {
        return delegationApprovals[from][to];
    }

    function balanceOf(address user) public view override(MockERC20Mintable, IVariableDebtToken) returns (uint256) {
        return super.balanceOf(user);
    }
}
