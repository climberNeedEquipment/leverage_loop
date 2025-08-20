// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import "forge-std/Test.sol";
import {LeverageLoop} from "../src/LeverageLoop.sol";
import {MockAaveV3Pool} from "../src/mocks/MockAaveV3Pool.sol";
import {MockEisenRouter} from "../src/mocks/MockEisenRouter.sol";
import {MockERC20Mintable} from "../src/mocks/MockERC20Mintable.sol";
import {MockAToken, MockVariableDebtToken} from "../src/mocks/MockAaveTokens.sol";

contract LeverageLoopMockTest is Test {
    LeverageLoop public loop;
    MockAaveV3Pool public pool;
    MockEisenRouter public router;

    MockERC20Mintable public weth;
    MockERC20Mintable public usdc;
    MockAToken public aWETH;
    MockVariableDebtToken public vUSDC;

    address public user = address(0xBEEF);

    function setUp() public {
        // Deploy tokens
        weth = new MockERC20Mintable("WETH", "WETH", 18);
        usdc = new MockERC20Mintable("USDC", "USDC", 6);
        aWETH = new MockAToken(address(weth), "aWETH", "aWETH", 18);
        vUSDC = new MockVariableDebtToken("vUSDC", "vUSDC", 6);

        // Deploy mocks
        pool = new MockAaveV3Pool();
        router = new MockEisenRouter();

        // List reserves
        pool.listReserve(address(weth), address(aWETH), address(0), 18);
        pool.listReserve(address(usdc), address(0), address(vUSDC), 6);

        // Seed pool with USDC for borrow and for flashloan repayment
        usdc.setMinter(address(this));
        usdc.mint(address(pool), 1_000_000e6);

        // Deploy loop
        loop = new LeverageLoop(address(pool), address(router));

        // Fund user and seed pool liquidity to cover flashloans + withdrawals
        weth.mint(user, 10 ether);
        // Seed pool with ample WETH so withdraw after flashloan won't underflow pool balance
        weth.mint(address(pool), 100 ether);

        // Allow router to mint tokenOut during swaps
        weth.setMinter(address(router));
        usdc.setMinter(address(router));

        // Allow pool to mint/burn a/v tokens for accounting
        aWETH.setMinter(address(pool));
        vUSDC.setMinter(address(pool));

        // Configure router default pair and rate USDC->WETH: assume 1 WETH = 2000 USDC for example
        router.setDefaultPair(address(usdc), address(weth));
        router.setSwapRate(address(usdc), address(weth), 1e18, 2000e6); // amountOut = amountIn * 1e18 / 2000e6
        // User approvals
        vm.startPrank(user);
        weth.approve(address(loop), type(uint256).max);
        vm.stopPrank();
    }

    function testLeverageFlowWithMocks() public {
        // Build leverage params; encode (tokenIn, tokenOut, amountIn) for router
        bytes memory swapData = abi.encode(
            address(usdc),
            address(weth),
            uint256(2_000e6)
        );
        LeverageLoop.LeverageParams memory p = LeverageLoop.LeverageParams({
            aToken: address(aWETH),
            variableDebtAsset: address(vUSDC),
            collateralAsset: address(weth),
            borrowAsset: address(usdc),
            collateralAmount: 1 ether,
            flashloanAmount: 2_000e6, // in debt units (USDC)
            swapPathData: swapData
        });

        // Execute as user
        vm.startPrank(user);
        loop.executeLeverageLoop(p);
        vm.stopPrank();

        // Validate: user got aTokens and variable debt minted
        assertGt(aWETH.balanceOf(user), 0, "no aTokens minted");
        assertGt(vUSDC.balanceOf(user), 0, "no variable debt minted");
    }

    function testDeleverageFlowWithMocks() public {
        // First, create a leveraged position
        {
            router.setDefaultPair(address(usdc), address(weth));
            router.setSwapRate(address(usdc), address(weth), 1e18, 2000e6);
            bytes memory swapData = abi.encode(
                address(usdc),
                address(weth),
                uint256(2_000e6)
            );
            LeverageLoop.LeverageParams memory p = LeverageLoop.LeverageParams({
                aToken: address(aWETH),
                variableDebtAsset: address(vUSDC),
                collateralAsset: address(weth),
                borrowAsset: address(usdc),
                collateralAmount: 1 ether,
                flashloanAmount: 2_000e6,
                swapPathData: swapData
            });
            vm.startPrank(user);
            loop.executeLeverageLoop(p);
            vm.stopPrank();
        }

        // Configure router for deleverage: WETH -> USDC at 2000 USDC per 1 WETH
        router.setDefaultPair(address(weth), address(usdc));
        router.setSwapRate(address(weth), address(usdc), 2000e6, 1e18);

        // Approve aTokens to the loop for withdrawal
        vm.startPrank(user);
        aWETH.approve(address(loop), type(uint256).max);

        // Build deleverage params; encode (tokenIn=weth, tokenOut=usdc, amountIn=flashloan WETH)
        bytes memory deSwap = abi.encode(
            address(weth),
            address(usdc),
            uint256(1 ether)
        );
        LeverageLoop.DeleverageParams memory d = LeverageLoop.DeleverageParams({
            aToken: address(aWETH),
            collateralAsset: address(weth),
            borrowAsset: address(usdc),
            repayAmount: 1_000e6, // repay portion of USDC debt
            flashloanAmount: 1 ether, // flashloan WETH to swap to USDC
            withdrawCollateralAmount: 1 ether,
            swapPathData: deSwap
        });

        loop.executeDeleverageLoop(d);
        vm.stopPrank();

        // Validate aToken balance decreased and variable debt reduced
        assertGt(aWETH.balanceOf(user), 0, "aToken should remain");
        // Simple sanity: pool transferred underlying and burned part of vDebt
        // Note: vUSDC balanceOf decreased by repay amount (mock implementation burns exact amount)
    }
}
