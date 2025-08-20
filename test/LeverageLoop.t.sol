// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

interface IFlashLoanReceiver {
    function executeOperation(
        address[] calldata assets,
        uint256[] calldata amounts,
        uint256[] calldata premiums,
        address initiator,
        bytes calldata params
    ) external returns (bool);
}

// Enhanced Mock contracts based on README specifications

contract MockERC20 {
    string public name;
    string public symbol;
    uint8 public decimals;
    uint256 public totalSupply;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    constructor(string memory _name, string memory _symbol, uint8 _decimals) {
        name = _name;
        symbol = _symbol;
        decimals = _decimals;
    }

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
        totalSupply += amount;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }

    function transferFrom(
        address from,
        address to,
        uint256 amount
    ) external returns (bool) {
        allowance[from][msg.sender] -= amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        return true;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }
}

contract MockAavePool {
    mapping(address => uint256) public suppliedAmounts;
    mapping(address => uint256) public borrowedAmounts;

    function supply(
        address asset,
        uint256 amount,
        address onBehalfOf,
        uint16
    ) external {
        // Pull tokens from msg.sender
        MockERC20(asset).transferFrom(msg.sender, address(this), amount);
        suppliedAmounts[onBehalfOf] += amount;
    }

    function withdraw(
        address asset,
        uint256 amount,
        address to
    ) external returns (uint256) {
        MockERC20(asset).transfer(to, amount);
        return amount;
    }

    function borrow(
        address asset,
        uint256 amount,
        uint256,
        uint16,
        address onBehalfOf
    ) external {
        // Mint borrowed asset to the contract (flashloan flow)
        MockERC20(asset).mint(msg.sender, amount);
        borrowedAmounts[onBehalfOf] += amount;
    }

    function repay(
        address asset,
        uint256 amount,
        uint256,
        address onBehalfOf
    ) external returns (uint256) {
        MockERC20(asset).transferFrom(msg.sender, address(this), amount);
        if (borrowedAmounts[onBehalfOf] >= amount) {
            borrowedAmounts[onBehalfOf] -= amount;
        } else {
            borrowedAmounts[onBehalfOf] = 0;
        }
        return amount;
    }

    function setUserUseReserveAsCollateral(address, bool) external {
        // Mock implementation
    }

    function flashLoan(
        address receiverAddress,
        address[] calldata assets,
        uint256[] calldata amounts,
        uint256[] calldata,
        address,
        bytes calldata params,
        uint16
    ) external {
        // Mock flashloan - mint assets to receiver
        for (uint i = 0; i < assets.length; i++) {
            MockERC20(assets[i]).mint(receiverAddress, amounts[i]);
        }

        // Call receiver callback
        IFlashLoanReceiver(receiverAddress).executeOperation(
            assets,
            amounts,
            new uint256[](assets.length), // zero premiums for testing
            receiverAddress,
            params
        );

        // Expect repayment
        for (uint i = 0; i < assets.length; i++) {
            MockERC20(assets[i]).transferFrom(
                receiverAddress,
                address(this),
                amounts[i]
            );
        }
    }

    function getUserAccountData(
        address
    )
        external
        pure
        returns (uint256, uint256, uint256, uint256, uint256, uint256)
    {
        // Mock healthy position data
        return (
            2000e18, // totalCollateralBase (2000 USD)
            1000e18, // totalDebtBase (1000 USD)
            500e18, // availableBorrowsBase (500 USD)
            8500, // currentLiquidationThreshold (85%)
            7500, // ltv (75%)
            2e18 // healthFactor (2.0)
        );
    }
}

contract MockEisenRouter {
    // Enhanced mock router supporting README swap functionality

    receive() external payable {}

    fallback() external payable {
        // Mock swap execution - supports various swap types
        // In real implementation, this would decode swap data and execute trades
    }

    function vault() external pure returns (address) {
        return address(0x6);
    }

    function wETH() external pure returns (address) {
        return address(0x7);
    }

    // Mock quote function simulating Eisen Finance API
    function getQuote(
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) external pure returns (uint256 amountOut, uint256 gasEstimate) {
        // Mock 1:1 ratio with slight slippage
        amountOut = (amountIn * 99) / 100;
        gasEstimate = 150000;
    }
}

contract MockVariableDebtToken {
    mapping(address => mapping(address => uint256)) public borrowAllowance;
    mapping(address => uint256) public balanceOf;

    function approveDelegation(address delegatee, uint256 amount) external {
        borrowAllowance[msg.sender][delegatee] = amount;
    }
}

contract MockFlashLoanReceiver is IFlashLoanReceiver {
    bool public executionCalled = false;

    function executeOperation(
        address[] calldata,
        uint256[] calldata,
        uint256[] calldata,
        address,
        bytes calldata
    ) external override returns (bool) {
        executionCalled = true;
        return true;
    }
}
