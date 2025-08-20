import { ethers } from "hardhat";
import { Contract } from "ethers";
import { NetworkConfig } from "../config/networks";
import { LeverageCalculator } from "./leverageCalculator";
import { EisenMockApi } from "./eisenMockApi";

export interface ForkTestContext {
  network: NetworkConfig;
  leverageLoop: Contract;
  pool: Contract;
  dataProvider: Contract;
  collateral: Contract;
  debt: Contract;
  aTokenCollateral: Contract;
  variableDebtToken: Contract;
  eisenRouter: Contract;
  user: string;
}

export interface TestScenario {
  name: string;
  collateralAmount: bigint;
  targetLeverage: number;
  slippageTolerance: number;
  expectedSuccess: boolean;
}

/**
 * Fork test utilities for multi-network testing
 */
export class ForkTestUtils {
  /**
   * Setup fork test environment for a specific network
   */
  static async setupForkTest(
    networkConfig: NetworkConfig
  ): Promise<ForkTestContext> {
    const [signer] = await ethers.getSigners();
    if (!signer) {
      throw new Error(
        "No signer available. Ensure Hardhat network is correctly configured with accounts."
      );
    }
    const userAddr = await signer.getAddress();

    // Create contract instances
    const pool = new ethers.Contract(
      networkConfig.aavePool,
      this.getAavePoolABI(),
      signer
    );
    const dataProvider = new ethers.Contract(
      networkConfig.protocolDataProvider,
      this.getProtocolDataProviderABI(),
      signer
    );
    const collateral = new ethers.Contract(
      networkConfig.weth,
      this.getWETHABI(),
      signer
    );
    const debt = new ethers.Contract(
      networkConfig.usdc,
      this.getERC20ABI(),
      signer
    );

    // Get token addresses from Aave
    const [aTokenAddress, , variableDebtTokenAddress] =
      await dataProvider.getReserveTokensAddresses(networkConfig.weth);

    const aTokenCollateral = new ethers.Contract(
      aTokenAddress,
      this.getERC20ABI(),
      signer
    );
    const variableDebtToken = new ethers.Contract(
      variableDebtTokenAddress,
      this.getVariableDebtTokenABI(),
      signer
    );

    // Deploy mock Eisen router
    const MockEisenRouter = await ethers.getContractFactory("MockEisenRouter");
    const eisenRouter = await MockEisenRouter.deploy();
    await eisenRouter.waitForDeployment();

    // Deploy LeverageLoop
    const LeverageLoop = await ethers.getContractFactory("LeverageLoop");
    const leverageLoopContract = await LeverageLoop.deploy(
      networkConfig.aavePool,
      await eisenRouter.getAddress()
    );
    await leverageLoopContract.waitForDeployment();

    const leverageLoop = new ethers.Contract(
      await leverageLoopContract.getAddress(),
      this.getLeverageLoopABI(),
      signer
    );

    return {
      network: networkConfig,
      leverageLoop,
      pool,
      dataProvider,
      collateral,
      debt,
      aTokenCollateral,
      variableDebtToken,
      eisenRouter,
      user: userAddr,
    };
  }

  /**
   * Prepare user for testing (fund with tokens, approvals, etc.)
   */
  static async prepareUser(context: ForkTestContext): Promise<void> {
    const { collateral, variableDebtToken, leverageLoop, pool, user } = context;

    // If it's WETH, deposit ETH to get WETH
    try {
      await (
        await collateral.deposit({
          value: ethers.parseEther("10"), // Deposit 10 ETH
        })
      ).wait();
    } catch (e) {
      console.log("Note: Could not deposit ETH (might not be WETH)");
    }

    // Enable collateral
    await (
      await pool.setUserUseReserveAsCollateral(context.network.weth, true)
    ).wait();

    // Approve LeverageLoop to spend user's tokens
    await (
      await collateral.approve(
        await leverageLoop.getAddress(),
        ethers.parseEther("1000")
      )
    ).wait();

    // Approve credit delegation
    await (
      await variableDebtToken.approveDelegation(
        await leverageLoop.getAddress(),
        ethers.parseEther("1000")
      )
    ).wait();

    console.log(`✅ User prepared for ${context.network.name} network`);
  }

  /**
   * Run leverage test scenario
   */
  static async runLeverageScenario(
    context: ForkTestContext,
    scenario: TestScenario
  ): Promise<boolean> {
    const {
      leverageLoop,
      aTokenCollateral,
      variableDebtToken,
      network,
      collateral,
      debt,
      user,
    } = context;

    try {
      console.log(`🚀 Running scenario: ${scenario.name} on ${network.name}`);

      // Calculate leverage parameters
      const collateralPrice = EisenMockApi.getMockPrice(network.weth);
      const borrowPrice = EisenMockApi.getMockPrice(network.usdc);

      // Fetch token decimals
      const collateralDecimals: number = await collateral.decimals();
      const debtDecimals: number = await debt.decimals();

      // Fetch initial supplied (aToken) and borrowed (variable debt) balances for user
      const initialCollateralAmount: bigint = await aTokenCollateral.balanceOf(
        user
      );
      const initialDebtAmount: bigint = await variableDebtToken.balanceOf(user);

      // New LeverageCalculator signature expects initial amounts and decimals
      const leverageData = LeverageCalculator.calculateLeverageParams(
        initialCollateralAmount,
        initialDebtAmount,
        undefined, // convertCollateralAmount
        undefined, // convertDebtAmount
        BigInt(Math.floor(collateralPrice * 1e18)), // priceOfCollateral (1e18)
        BigInt(Math.floor(borrowPrice * 1e18)), // priceOfDebt (1e18)
        collateralDecimals,
        debtDecimals,
        scenario.collateralAmount, // collateralAmount to add
        scenario.targetLeverage,
        network.flashloanPremium // Use premium from network config
      );

      // Validate parameters
      if (
        !LeverageCalculator.validateLeverageParams(
          leverageData,
          scenario.collateralAmount,
          scenario.targetLeverage
        )
      ) {
        throw new Error("Invalid leverage parameters");
      }

      // Build swap data using new API
      const leverageLoopAddress = await leverageLoop.getAddress();
      const swapData = await EisenMockApi.buildLeverageSwapDataFromQuote(
        network.usdc, // fromToken
        network.weth, // toToken
        leverageData.flashloanAmount.toString(), // fromAmount
        scenario.slippageTolerance, // slippage
        leverageLoopAddress, // recipient
        false, // useMock: false for fork tests
        network.chainId // chainId
      );

      // Get aToken and debt token addresses
      const [aTokenAddress, , variableDebtTokenAddress] =
        await context.dataProvider.getReserveTokensAddresses(network.weth);

      // Execute leverage
      const leverageParams = {
        aToken: aTokenAddress,
        variableDebtAsset: variableDebtTokenAddress,
        collateralAsset: network.weth,
        borrowAsset: network.usdc,
        collateralAmount: scenario.collateralAmount,
        flashloanAmount: leverageData.flashloanAmount,
        swapPathData: swapData,
      };

      const tx = await leverageLoop.executeLeverageLoop(leverageParams);
      await tx.wait();

      console.log(`✅ Leverage scenario completed successfully`);
      console.log(
        `   Flashloan amount: ${ethers.formatUnits(
          leverageData.flashloanAmount,
          debtDecimals
        )} (debt token)`
      );
      console.log(
        `   Post-leverage collateral: ${ethers.formatUnits(
          leverageData.collateralAmount,
          collateralDecimals
        )} (collateral token)`
      );
      console.log(
        `   Post-leverage debt: ${ethers.formatUnits(
          leverageData.debtAmount,
          debtDecimals
        )} (debt token)`
      );
      console.log(`   Target leverage: ${scenario.targetLeverage}x`);

      return true;
    } catch (error: any) {
      if (scenario.expectedSuccess) {
        console.error(
          `❌ Unexpected failure in ${scenario.name}:`,
          error.message
        );
        return false;
      } else {
        console.log(`✅ Expected failure in ${scenario.name}:`, error.message);
        return true;
      }
    }
  }

  /**
   * Run deleverage test scenario
   */
  static async runDeleverageScenario(
    context: ForkTestContext,
    withdrawAmount: bigint,
    repayAmount: bigint
  ): Promise<boolean> {
    const { leverageLoop, aTokenCollateral, network, collateral, debt, user } =
      context;

    try {
      console.log(`📉 Running deleverage on ${network.name}`);

      // Approve aTokens for withdrawal
      await (
        await aTokenCollateral.approve(
          await leverageLoop.getAddress(),
          withdrawAmount
        )
      ).wait();

      // Prices and decimals
      const collateralPrice = EisenMockApi.getMockPrice(network.weth);
      const borrowPrice = EisenMockApi.getMockPrice(network.usdc);
      const collateralDecimals: number = await collateral.decimals();
      const debtDecimals: number = await debt.decimals();

      // Fetch initial supplied (aToken) and borrowed (variable debt) balances for user
      const initialCollateralAmount: bigint = await aTokenCollateral.balanceOf(
        user
      );
      const initialDebtAmount: bigint = await (
        await ethers.getContractAt(
          this.getVariableDebtTokenABI(),
          await (
            await context.dataProvider.getReserveTokensAddresses(network.weth)
          ).then(([, , vAddr]) => vAddr)
        )
      ).balanceOf(user);

      // Build swap data for deleverage (collateral -> borrow asset) using new API
      const leverageLoopAddress = await leverageLoop.getAddress();
      const swapData = await EisenMockApi.buildLeverageSwapDataFromQuote(
        network.weth, // fromToken (collateral)
        network.usdc, // toToken (borrow asset)
        withdrawAmount.toString(), // fromAmount
        0.01, // slippage (1%)
        leverageLoopAddress, // recipient
        false, // useMock: false for fork tests
        network.chainId // chainId
      );

      // New calculator signature for deleverage
      const delevData = LeverageCalculator.calculateDeleverageParams(
        initialCollateralAmount,
        initialDebtAmount,
        undefined, // convertCollateralAmount
        undefined, // convertDebtAmount
        BigInt(Math.floor(collateralPrice * 1e18)), // priceOfCollateral
        BigInt(Math.floor(borrowPrice * 1e18)), // priceOfDebt
        collateralDecimals,
        debtDecimals,
        0.0, // targetDeLeverage (not used in this scenario)
        network.flashloanPremium // Use premium from network config
      );

      const deleverageParams = {
        aToken: await aTokenCollateral.getAddress(),
        collateralAsset: network.weth,
        borrowAsset: network.usdc,
        repayAmount: repayAmount,
        flashloanAmount: withdrawAmount,
        withdrawCollateralAmount: withdrawAmount,
        swapPathData: swapData,
      };

      const tx = await leverageLoop.executeDeleverageLoop(deleverageParams);
      await tx.wait();

      console.log(`✅ Deleverage completed successfully`);
      console.log(
        `   Post-deleverage collateral: ${ethers.formatUnits(
          delevData.collateralAmount,
          collateralDecimals
        )}`
      );
      console.log(
        `   Post-deleverage debt: ${ethers.formatUnits(
          delevData.debtAmount,
          debtDecimals
        )}`
      );
      return true;
    } catch (error: any) {
      console.error(`❌ Deleverage failed:`, error.message);
      return false;
    }
  }

  /**
   * Get standard test scenarios
   */
  static getTestScenarios(): TestScenario[] {
    return [
      {
        name: "Conservative 2x Leverage",
        collateralAmount: ethers.parseEther("1"),
        targetLeverage: 2.0,
        slippageTolerance: 0.01,
        expectedSuccess: true,
      },
      {
        name: "Moderate 3x Leverage",
        collateralAmount: ethers.parseEther("1"),
        targetLeverage: 3.0,
        slippageTolerance: 0.02,
        expectedSuccess: true,
      },
      {
        name: "Aggressive 4x Leverage",
        collateralAmount: ethers.parseEther("1"),
        targetLeverage: 4.0,
        slippageTolerance: 0.03,
        expectedSuccess: true,
      },
      {
        name: "Invalid Zero Collateral",
        collateralAmount: ethers.parseEther("0"),
        targetLeverage: 2.0,
        slippageTolerance: 0.01,
        expectedSuccess: false,
      },
      {
        name: "Extreme High Leverage",
        collateralAmount: ethers.parseEther("1"),
        targetLeverage: 10.0,
        slippageTolerance: 0.05,
        expectedSuccess: false,
      },
    ];
  }

  // ABI definitions
  private static getAavePoolABI(): string[] {
    return [
      "function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode)",
      "function withdraw(address asset, uint256 amount, address to) returns (uint256)",
      "function borrow(address asset, uint256 amount, uint256 interestRateMode, uint16 referralCode, address onBehalfOf)",
      "function repay(address asset, uint256 amount, uint256 interestRateMode, address onBehalfOf) returns (uint256)",
      "function setUserUseReserveAsCollateral(address asset, bool useAsCollateral)",
      "function flashLoan(address receiverAddress, address[] assets, uint256[] amounts, uint256[] modes, address onBehalfOf, bytes params, uint16 referralCode)",
      "function getUserAccountData(address user) view returns (uint256, uint256, uint256, uint256, uint256, uint256)",
    ];
  }

  private static getProtocolDataProviderABI(): string[] {
    return [
      "function getReserveTokensAddresses(address asset) view returns (address aTokenAddress, address stableDebtTokenAddress, address variableDebtTokenAddress)",
    ];
  }

  private static getERC20ABI(): string[] {
    return [
      "function decimals() view returns (uint8)",
      "function balanceOf(address) view returns (uint256)",
      "function transfer(address to, uint256 amount) returns (bool)",
      "function transferFrom(address from, address to, uint256 amount) returns (bool)",
      "function approve(address spender, uint256 amount) returns (bool)",
      "function allowance(address owner, address spender) view returns (uint256)",
    ];
  }

  private static getWETHABI(): string[] {
    return [
      ...this.getERC20ABI(),
      "function deposit() payable",
      "function withdraw(uint256)",
    ];
  }

  private static getVariableDebtTokenABI(): string[] {
    return [
      "function approveDelegation(address delegatee, uint256 amount)",
      "function borrowAllowance(address fromUser, address toUser) view returns (uint256)",
      "function balanceOf(address user) view returns (uint256)",
    ];
  }

  private static getLeverageLoopABI(): string[] {
    return [
      "function executeLeverageLoop((address,address,address,address,uint256,uint256,bytes))",
      "function executeDeleverageLoop((address,address,address,uint256,uint256,uint256,bytes))",
      "function owner() view returns (address)",
      "function transferOwnership(address)",
      "function emergencyWithdraw(address)",
    ];
  }
}
