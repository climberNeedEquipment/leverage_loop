// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import "./interfaces/IFlashLoanReceiver.sol";
import "./interfaces/IAaveV3Pool.sol";
import "./interfaces/IERC20.sol";
import "./libs/SafeTransferLib.sol";
import {ERC20 as SoladyERC20} from "solady/src/tokens/ERC20.sol";
import "./errors/GenericErrors.sol";
import "./libs/UniERC20.sol";

/**
 * @title LeverageLoop
 * @notice Contract for executing leverage loops using Eisen Labs flashloan router and Aave V3
 * @dev This contract implements a leverage loop strategy:
 *      1. Flashloan assets via Eisen router
 *      2. Supply to Aave as collateral
 *      3. Borrow more of the same or different asset
 *      4. Swap borrowed asset to collateral asset (if different)
 *      5. Repeat process to increase leverage
 *      6. Repay flashloan
 */
contract LeverageLoop is IFlashLoanReceiver {
    using UniERC20 for address;
    // Constants
    uint256 public constant VARIABLE_INTEREST_RATE_MODE = 2;
    uint16 public constant REFERRAL_CODE = 0;

    // Core protocol addresses
    address public immutable eisenRouter;
    IAaveV3Pool public aavePool;

    // Owner
    address public owner;

    // Events
    event LeverageLoopExecuted(
        address indexed user,
        address indexed collateralAsset,
        address indexed borrowAsset,
        uint256 collateralAmount,
        uint256 borrowAmount
    );

    event DeleverageLoopExecuted(
        address indexed user,
        address indexed collateralAsset,
        address indexed borrowAsset,
        uint256 collateralAmount,
        uint256 borrowAmount
    );

    // Internal action tags for flashloan callbacks
    uint8 private constant ACTION_LEVERAGE = 1;
    uint8 private constant ACTION_DELEVERAGE = 2;

    // Modifiers
    modifier onlyOwner() {
        if (msg.sender != owner) {
            revert GenericErrors.NotAuthorized();
        }
        _;
    }

    // Structs
    struct LeverageParams {
        address aToken; // aToken to supply to Aave
        address variableDebtAsset; // Variable debt asset to borrow
        address collateralAsset; // Asset to use as collateral (aka supply asset)
        address borrowAsset; // Asset to borrow
        uint256 collateralAmount; // Amount of collateral to transferFrom user to this contract
        uint256 flashloanAmount; // Offchain-calculated flashloan amount for supply asset
        bytes swapPathData; // Encoded EisenRouter for borrow->collateral swap
    }

    struct DeleverageParams {
        address aToken; // aToken to withdraw from
        address collateralAsset; // Asset currently used as collateral
        address borrowAsset; // Current borrowed asset to be repaid
        uint256 repayAmount; // Amount of debt to repay
        uint256 flashloanAmount; // Offchain-calculated flashloan amount equal to repay amount
        uint256 withdrawCollateralAmount; // Amount of collateral to withdraw after repay for flashloan
        bytes swapPathData; // Encoded EisenRouter for collateral->borrow swap
    }

    constructor(address _aavePool, address _eisenRouter) {
        aavePool = IAaveV3Pool(_aavePool);
        eisenRouter = _eisenRouter;
        owner = msg.sender;
    }

    function setAavePool(address _aavePool) external onlyOwner {
        aavePool = IAaveV3Pool(_aavePool);
    }

    /**
     * @notice Execute leverage loop strategy
     * @param params Leverage parameters
     */
    function executeLeverageLoop(LeverageParams calldata params) external {
        if (params.collateralAmount == 0) {
            revert GenericErrors.InvalidAmount();
        }
        if (params.flashloanAmount == 0) {
            revert GenericErrors.InvalidFlashloanAmount();
        }

        // Pull initial collateral from user to this router
        SoladyERC20(params.collateralAsset).transferFrom(
            msg.sender,
            address(this),
            params.collateralAmount
        );

        // Use offchain-provided flashloan amount

        // Encode parameters for flashloan callback
        bytes memory flashloanParams = abi.encode(
            ACTION_LEVERAGE,
            msg.sender,
            abi.encode(params)
        );

        uint256 supplyAmount = SoladyERC20(params.aToken).balanceOf(msg.sender);
        uint256 borrowAmount = SoladyERC20(params.variableDebtAsset).balanceOf(
            msg.sender
        );

        // Execute flashloan via Eisen router (this contract is the initiator/receiver)
        address[] memory assets1 = new address[](1);
        assets1[0] = params.borrowAsset;
        uint256[] memory amounts1 = new uint256[](1);
        amounts1[0] = params.flashloanAmount;
        uint256[] memory modes1 = new uint256[](1);
        modes1[0] = 0;
        aavePool.flashLoan(
            address(this),
            assets1,
            amounts1,
            modes1,
            address(0),
            flashloanParams,
            REFERRAL_CODE
        );

        supplyAmount =
            SoladyERC20(params.aToken).balanceOf(address(this)) -
            supplyAmount;

        borrowAmount =
            borrowAmount -
            SoladyERC20(params.variableDebtAsset).balanceOf(address(this));

        emit LeverageLoopExecuted(
            msg.sender,
            params.collateralAsset,
            params.borrowAsset,
            supplyAmount,
            borrowAmount
        );
    }

    /**
     * @notice Start deleverage using a flashloan of the debt asset
     */
    function executeDeleverageLoop(DeleverageParams calldata params) external {
        if (params.withdrawCollateralAmount == 0) {
            revert GenericErrors.InvalidAmount();
        }
        if (params.flashloanAmount == 0) {
            revert GenericErrors.InvalidFlashloanAmount();
        }

        bytes memory flashloanParams = abi.encode(
            ACTION_DELEVERAGE,
            msg.sender,
            abi.encode(params)
        );

        address[] memory assets2 = new address[](1);
        assets2[0] = params.collateralAsset;
        uint256[] memory amounts2 = new uint256[](1);
        amounts2[0] = params.flashloanAmount;
        uint256[] memory modes2 = new uint256[](1);
        modes2[0] = 0;
        aavePool.flashLoan(
            address(this),
            assets2,
            amounts2,
            modes2,
            address(0),
            flashloanParams,
            REFERRAL_CODE
        );

        emit DeleverageLoopExecuted(
            msg.sender,
            params.collateralAsset,
            params.borrowAsset,
            params.withdrawCollateralAmount,
            params.repayAmount
        );
    }

    /**
     * @notice Callback function called by flashloan provider
     * @param assets The assets being flashloaned
     * @param amounts The amounts being flashloaned
     * @param premiums The premiums/fees for the flashloan
     * @param initiator The initiator of the flashloan
     * @param params Additional parameters
     */
    function executeOperation(
        address[] calldata assets,
        uint256[] calldata amounts,
        uint256[] calldata premiums,
        address initiator,
        bytes calldata params
    ) external override returns (bool) {
        if (msg.sender != address(aavePool)) {
            revert GenericErrors.NotAuthorized();
        }
        if (initiator != address(this)) {
            revert GenericErrors.InvalidInitiator();
        }

        // Decode action and dispatch
        (uint8 action, address user, bytes memory actionParams) = abi.decode(
            params,
            (uint8, address, bytes)
        );

        if (action == ACTION_LEVERAGE) {
            LeverageParams memory leverageParams = abi.decode(
                actionParams,
                (LeverageParams)
            );

            _executeLeverageLogic(
                assets[0],
                amounts[0],
                premiums[0],
                leverageParams,
                user
            );

            // Approve flashloan repayment
            IERC20(assets[0]).approve(
                address(aavePool),
                amounts[0] + premiums[0]
            );

            // Send any excess supply asset (beyond repayment) back to the user immediately
            uint256 balAfter = IERC20(assets[0]).balanceOf(address(this));
            if (balAfter > amounts[0] + premiums[0]) {
                IERC20(assets[0]).transfer(
                    user,
                    balAfter - amounts[0] - premiums[0]
                );
            }

            // Also forward any stray borrow asset balance to the user
            if (leverageParams.borrowAsset != assets[0]) {
                uint256 borrowBal = IERC20(leverageParams.borrowAsset)
                    .balanceOf(address(this));
                if (borrowBal > 0) {
                    IERC20(leverageParams.borrowAsset).transfer(
                        user,
                        borrowBal
                    );
                }
            }
        } else if (action == ACTION_DELEVERAGE) {
            DeleverageParams memory dlvParams = abi.decode(
                actionParams,
                (DeleverageParams)
            );
            if (assets[0] != dlvParams.collateralAsset) {
                revert GenericErrors.InvalidFlashloanAsset();
            }
            if (amounts[0] != dlvParams.flashloanAmount) {
                revert GenericErrors.InvalidFlashloanAmount();
            }

            _executeDeleverageLogic(
                assets[0],
                amounts[0],
                premiums[0],
                dlvParams,
                user
            );

            // Return any leftovers to user
            uint256 debtBal = IERC20(assets[0]).balanceOf(address(this));
            if (debtBal > amounts[0] + premiums[0]) {
                IERC20(assets[0]).transfer(
                    user,
                    debtBal - amounts[0] - premiums[0]
                );
            }
            uint256 collateralBal = IERC20(dlvParams.collateralAsset).balanceOf(
                address(this)
            );
            if (collateralBal > 0) {
                IERC20(dlvParams.collateralAsset).transfer(user, collateralBal);
            }
        } else {
            revert GenericErrors.InvalidAction();
        }

        return true;
    }

    /**
     * @notice Execute the core leverage loop logic
     * @param flashloanAsset The flashloaned asset
     * @param flashloanAmount The flashloaned amount
     * @param premium The flashloan premium
     * @param params Leverage parameters
     */
    function _executeLeverageLogic(
        address flashloanAsset,
        uint256 flashloanAmount,
        uint256 premium,
        LeverageParams memory params,
        address user
    ) internal {
        if (flashloanAsset != params.borrowAsset) {
            revert GenericErrors.InvalidFlashloanAsset();
        }
        uint256 supplyAmount;
        // 1. Swap flashloaned amount to collateral asset
        if (params.borrowAsset != params.collateralAsset) {
            // 2. Approve flashloan amount to swap for eisen router
            if (!params.borrowAsset.isETH()) {
                IERC20(params.borrowAsset).approve(
                    address(eisenRouter),
                    flashloanAmount
                );
            }
            (bool success, ) = eisenRouter.call{
                value: params.borrowAsset.isETH() ? flashloanAmount : 0
            }(params.swapPathData);
            if (!success) {
                revert GenericErrors.SwapFailed();
            }
            supplyAmount = SoladyERC20(params.collateralAsset).balanceOf(
                address(this)
            );
        }

        // Approve Aave pool to spend collateral
        IERC20(params.collateralAsset).approve(address(aavePool), supplyAmount);

        // Supply to Aave pool on behalf of the user
        aavePool.supply(
            params.collateralAsset,
            supplyAmount,
            user,
            REFERRAL_CODE
        );

        // Collateral enablement: must be set by the EOA user prior to calling leverage

        // 3. Calculate borrowing amount (accounting for flashloan repayment)
        uint256 borrowAmount = flashloanAmount + premium;

        // 4. Borrow assets from Aave on behalf of the user (requires credit delegation from the user to this contract)
        aavePool.borrow(
            params.borrowAsset,
            borrowAmount,
            VARIABLE_INTEREST_RATE_MODE,
            REFERRAL_CODE,
            user
        );
    }

    /**
     * @notice Execute the core deleverage logic
     * @dev Repay debt first with flashloaned debt asset, then withdraw collateral and swap to repay flashloan
     */
    function _executeDeleverageLogic(
        address flashloanAsset, // equals debt asset
        uint256 flashloanAmount,
        uint256 premium,
        DeleverageParams memory params,
        address user
    ) internal {
        if (flashloanAsset != params.collateralAsset) {
            revert GenericErrors.InvalidFlashloanAsset();
        }
        // 1. Swap flashloaned amount to collateral asset
        if (params.borrowAsset != params.collateralAsset) {
            // 2. Approve flashloan amount to swap for eisen router
            if (!params.collateralAsset.isETH()) {
                IERC20(params.collateralAsset).approve(
                    address(eisenRouter),
                    flashloanAmount
                );
            }
            (bool success, ) = eisenRouter.call{
                value: params.collateralAsset.isETH() ? flashloanAmount : 0
            }(params.swapPathData);
            if (!success) {
                revert GenericErrors.SwapFailed();
            }
        }

        // 1. Repay user's debt using flashloaned debt swapped asset on behalf of the user
        aavePool.repay(
            params.borrowAsset,
            params.repayAmount,
            VARIABLE_INTEREST_RATE_MODE,
            user
        );

        // Transfer aTokens from the EOA to this contract
        IERC20(params.aToken).transferFrom(
            user,
            address(this),
            flashloanAmount + premium
        );

        // 2. Withdraw collateral to this contract
        aavePool.withdraw(
            params.collateralAsset,
            flashloanAmount + premium,
            address(this)
        );

        IERC20(flashloanAsset).approve(
            address(aavePool),
            flashloanAmount + premium
        );
    }

    /**
     * @notice Emergency withdrawal function (owner only)
     * @param token Token to withdraw
     */
    function emergencyWithdraw(address token) external onlyOwner {
        uint256 balance = IERC20(token).balanceOf(address(this));
        if (balance > 0) {
            IERC20(token).transfer(owner, balance);
        }
    }

    /**
     * @notice Transfer ownership
     * @param newOwner New owner address
     */
    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) {
            revert GenericErrors.InvalidAddress();
        }
        owner = newOwner;
    }
}
