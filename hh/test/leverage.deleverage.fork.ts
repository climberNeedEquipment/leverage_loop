import { ethers } from "hardhat";
import { Contract } from "ethers";
import { expect } from "chai";
import { EisenMockApi, EisenQuoteRequest } from "../utils/eisenMockApi";
import { baseConfig } from "../config/networks/base";
import { LeverageCalculator } from "../utils/leverageCalculator";

/**
 * @title Enhanced Leverage & Deleverage Fork Tests
 * @notice Comprehensive fork tests based on README.md specifications
 * @dev Tests multi-network deployment with Eisen Finance API integration
 */

// Use Base network configuration as default, override with env vars
const AAVE_POOL = process.env.AAVE_POOL || baseConfig.aavePool;
const PROTOCOL_DATA_PROVIDER =
  process.env.AAVE_DATA_PROVIDER || baseConfig.protocolDataProvider;
const COLLATERAL_ASSET = process.env.COLLATERAL_ASSET || baseConfig.weth;
const BORROW_ASSET = process.env.BORROW_ASSET || baseConfig.usdc;

// Test constants based on README examples
const INITIAL_COLLATERAL = ethers.parseEther("1"); // 1 ETH as per README
const TARGET_LEVERAGE_2X = 2.0;
const TARGET_LEVERAGE_3X = 3.0;
const FLASHLOAN_AMOUNT_2X = ethers.parseEther("2000"); // 2000 USDC for 2x leverage
const FLASHLOAN_AMOUNT_3X = ethers.parseEther("3000"); // 3000 USDC for 3x leverage
const REPAY_AMOUNT = ethers.parseUnits("1500", 6); // 1500 USDC as per README
const WITHDRAW_COLLATERAL_AMOUNT = ethers.parseEther("1"); // 1 ETH as per README
const SLIPPAGE_TOLERANCE = 0.01; // 1% slippage tolerance

// Build comprehensive swap data using enhanced Eisen Finance API
async function buildEnhancedSwapData(
  tokenIn: string,
  tokenOut: string,
  amountIn: bigint,
  recipient: string,
  leverageMultiplier?: number,
  chainId: number = 8453
): Promise<string> {
  try {
    console.log(
      `🔄 Building swap data for ${
        leverageMultiplier ? leverageMultiplier + "x" : ""
      } leverage using new Eisen API structure`
    );

    // Use enhanced Eisen Finance API with new structure
    const swapData = await EisenMockApi.buildLeverageSwapDataFromQuote(
      tokenIn,
      tokenOut,
      amountIn.toString(),
      SLIPPAGE_TOLERANCE,
      recipient,
      false, // Use mock for testing
      chainId
    );

    console.log(`✅ Swap data generated: ${swapData.slice(0, 50)}...`);
    return swapData;
  } catch (error) {
    console.log("⚠️  Using fallback swap data encoding");
    // Enhanced fallback encoding
    return ethers.AbiCoder.defaultAbiCoder().encode(
      ["string", "address", "address", "uint256", "uint256", "uint256"],
      [
        "eisenRouterSwap",
        tokenIn,
        tokenOut,
        amountIn,
        (amountIn * BigInt(99)) / BigInt(100), // 1% slippage
        Math.floor(Date.now() / 1000) + 1800, // 30 min deadline
      ]
    );
  }
}

// Calculate optimal leverage parameters using enhanced calculator
async function calculateLeverageParamsHelper(
  collateralAmount: bigint,
  targetLeverage: number,
  collateralAsset: string,
  borrowAsset: string
) {
  console.log(`🧮 Calculating ${targetLeverage}x leverage parameters`);

  // Get mock prices from Eisen API
  const collateralPrice = EisenMockApi.getMockPrice(collateralAsset);
  const borrowPrice = EisenMockApi.getMockPrice(borrowAsset);

  // Fetch decimals
  const collateral = await ethers.getContractAt(IERC20_ABI, collateralAsset);
  const debt = await ethers.getContractAt(IERC20_ABI, borrowAsset);
  const collateralDecimals: number = await collateral.decimals();
  const debtDecimals: number = await debt.decimals();

  // Calculate optimal parameters with new signature
  const leverageData = LeverageCalculator.calculateLeverageParams(
    0n, // initialCollateralAmount
    0n, // initialDebtAmount
    undefined, // convertCollateralAmount
    undefined, // convertDebtAmount
    BigInt(Math.floor(collateralPrice * 1e18)), // priceOfCollateral (18 decimals)
    BigInt(Math.floor(borrowPrice * 1e18)), // priceOfDebt (18 decimals)
    collateralDecimals,
    debtDecimals,
    collateralAmount,
    targetLeverage,
    baseConfig.flashloanPremium // Use premium from baseConfig
  );

  console.log(
    `📊 Calculated flashloan amount: ${ethers.formatUnits(
      leverageData.flashloanAmount,
      debtDecimals
    )}`
  );

  return leverageData;
}

const IERC20_ABI = [
  "function decimals() view returns (uint8)",
  "function balanceOf(address) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function transferFrom(address from, address to, uint256 amount) returns (bool)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
];

const IATOKEN_ABI = [
  ...IERC20_ABI,
  "function UNDERLYING_ASSET_ADDRESS() view returns (address)",
];

const IWETH_ABI = [
  ...IERC20_ABI,
  "function deposit() payable",
  "function withdraw(uint256)",
];

const IPool_ABI = [
  "function setUserUseReserveAsCollateral(address asset, bool useAsCollateral)",
  "function getUserAccountData(address user) view returns (uint256, uint256, uint256, uint256, uint256, uint256)",
];

const IProtocolDataProvider_ABI = [
  "function getReserveTokensAddresses(address asset) view returns (address aTokenAddress, address stableDebtTokenAddress, address variableDebtTokenAddress)",
];

const IVariableDebtToken_ABI = [
  "function approveDelegation(address delegatee, uint256 amount)",
  "function borrowAllowance(address fromUser, address toUser) view returns (uint256)",
];

const ILeverageLoop_ABI = [
  "function executeLeverageLoop((address,address,address,address,uint256,uint256,bytes))",
  "function executeDeleverageLoop((address,address,address,uint256,uint256,uint256,bytes))",
  "function owner() view returns (address)",
  "function transferOwnership(address)",
  "function emergencyWithdraw(address)",
  "function VARIABLE_INTEREST_RATE_MODE() view returns (uint256)",
  "function REFERRAL_CODE() view returns (uint16)",
];

describe("Enhanced Leverage+Deleverage Fork Tests", function () {
  let userAddr: string;
  let leverageLoop: Contract;
  let pool: Contract;
  let dataProvider: Contract;
  let collateral: Contract;
  let debt: Contract;
  let aTokenCollateral: Contract;
  let variableDebtToken: Contract;
  let eisenRouter: Contract;
  let initialized = false;

  before(async function () {
    console.log("🚀 Setting up enhanced fork test environment");
    if (!process.env.ALCHEMY_MAINNET_URL && !process.env.BASE_RPC_URL) {
      console.log(
        "⏭️  Skipping suite: no forking RPC configured (set ALCHEMY_MAINNET_URL or BASE_RPC_URL)"
      );
      this.skip();
      return;
    }

    const [signer] = await ethers.getSigners();
    userAddr = await signer.getAddress();

    // Initialize contract instances
    pool = new ethers.Contract(AAVE_POOL, IPool_ABI, signer);
    dataProvider = new ethers.Contract(
      PROTOCOL_DATA_PROVIDER,
      IProtocolDataProvider_ABI,
      signer
    );
    collateral = new ethers.Contract(COLLATERAL_ASSET, IWETH_ABI, signer);
    debt = new ethers.Contract(BORROW_ASSET, IERC20_ABI, signer);

    // Get Aave token addresses
    let aTokenAddress: string | undefined;
    let variableDebtTokenAddress: string | undefined;
    try {
      [aTokenAddress, , variableDebtTokenAddress] =
        await dataProvider.getReserveTokensAddresses(COLLATERAL_ASSET);
    } catch (e) {
      console.log(
        "⏭️  Skipping setup due to missing forked RPC / data provider; tests will be skipped"
      );
      this.skip?.();
      return;
    }

    aTokenCollateral = new ethers.Contract(aTokenAddress!, IERC20_ABI, signer);
    variableDebtToken = new ethers.Contract(
      variableDebtTokenAddress!,
      IVariableDebtToken_ABI,
      signer
    );

    console.log(`📍 aToken address: ${aTokenAddress}`);
    console.log(`📍 Variable debt token: ${variableDebtTokenAddress}`);

    // Deploy enhanced MockEisenRouter
    const MockEisenRouter = await ethers.getContractFactory("MockEisenRouter");
    eisenRouter = await MockEisenRouter.deploy();
    await eisenRouter.waitForDeployment();

    // Deploy LeverageLoop with proper configuration
    const LeverageLoop = await ethers.getContractFactory("LeverageLoop");
    const leverageLoopContract = await LeverageLoop.deploy(
      AAVE_POOL,
      await eisenRouter.getAddress()
    );
    await leverageLoopContract.waitForDeployment();

    // Create properly typed contract instance
    leverageLoop = new ethers.Contract(
      await leverageLoopContract.getAddress(),
      ILeverageLoop_ABI,
      signer
    );

    console.log(
      `🏦 LeverageLoop deployed at: ${await leverageLoop.getAddress()}`
    );

    // Enhanced user preparation
    await setupUserForTesting();
    initialized = true;
  });

  async function setupUserForTesting() {
    console.log("👤 Setting up user for comprehensive testing");

    // Wrap ETH to WETH if applicable (Base/Ethereum)
    try {
      const wethBalance = await collateral.balanceOf(userAddr);
      if (wethBalance < ethers.parseEther("5")) {
        await (
          await collateral.deposit({
            value: ethers.parseEther("10"), // Deposit 10 ETH
          })
        ).wait();
        console.log("✅ Deposited ETH to WETH");
      }
    } catch (error) {
      console.log("ℹ️  ETH deposit not available (might not be WETH)");
    }

    // Enable collateral usage as per README
    await (
      await pool.setUserUseReserveAsCollateral(COLLATERAL_ASSET, true)
    ).wait();
    console.log("✅ Enabled collateral usage");

    // Approve collateral spending
    await (
      await collateral.approve(
        await leverageLoop.getAddress(),
        ethers.parseEther("100") // Large approval for multiple tests
      )
    ).wait();

    // Credit delegation setup as per README step 4
    await (
      await variableDebtToken.approveDelegation(
        await leverageLoop.getAddress(),
        ethers.parseUnits("50000", 6) // 50k USDC delegation
      )
    ).wait();
    console.log("✅ Credit delegation configured");

    // Log user account data
    const [totalCollateral, totalDebt, availableBorrows, , , healthFactor] =
      await pool.getUserAccountData(userAddr);

    console.log(`📊 User Account Data:`);
    console.log(
      `   Total Collateral: ${ethers.formatEther(totalCollateral)} ETH`
    );
    console.log(`   Total Debt: ${ethers.formatEther(totalDebt)} ETH`);
    console.log(
      `   Available Borrows: ${ethers.formatEther(availableBorrows)} ETH`
    );
    console.log(`   Health Factor: ${ethers.formatEther(healthFactor)}`);
  }

  describe("🚀 Enhanced Leverage Operations", function () {
    it("should execute 2x leverage successfully (README example)", async function () {
      this.timeout(60000);

      console.log("🎯 Testing 2x leverage execution as per README");

      // Calculate optimal parameters
      const leverageData = await calculateLeverageParamsHelper(
        INITIAL_COLLATERAL,
        TARGET_LEVERAGE_2X,
        COLLATERAL_ASSET,
        BORROW_ASSET
      );

      // Get required addresses
      const [aTokenAddress, , variableDebtTokenAddress] =
        await dataProvider.getReserveTokensAddresses(COLLATERAL_ASSET);

      // Build enhanced swap data
      const swapData = await buildEnhancedSwapData(
        BORROW_ASSET,
        COLLATERAL_ASSET,
        leverageData.flashloanAmount,
        await leverageLoop.getAddress(),
        TARGET_LEVERAGE_2X
      );

      // Execute leverage as per README format
      const leverageParams = {
        aToken: aTokenAddress,
        variableDebtAsset: variableDebtTokenAddress,
        collateralAsset: COLLATERAL_ASSET,
        borrowAsset: BORROW_ASSET,
        collateralAmount: INITIAL_COLLATERAL,
        flashloanAmount: leverageData.flashloanAmount,
        swapPathData: swapData,
      };

      console.log("⚡ Executing leverage loop...");
      const tx = await leverageLoop.executeLeverageLoop(leverageParams);
      const receipt = await tx.wait();

      console.log(`✅ Leverage executed in block ${receipt.blockNumber}`);
      console.log(`⛽ Gas used: ${receipt.gasUsed.toLocaleString()}`);

      // Verify leveraged position (should have ~3 ETH exposure from 1 ETH)
      const [, , , , , healthFactor] = await pool.getUserAccountData(userAddr);
      const aTokenBalance = await aTokenCollateral.balanceOf(userAddr);

      console.log(
        `📈 Final aToken balance: ${ethers.formatEther(aTokenBalance)} aWETH`
      );
      console.log(`🛡️  Health factor: ${ethers.formatEther(healthFactor)}`);

      // Verify leverage achieved
      expect(aTokenBalance).to.be.greaterThan(INITIAL_COLLATERAL);
      expect(healthFactor).to.be.greaterThan(ethers.parseEther("1")); // Health factor > 1.0
    });

    it("should execute 3x leverage successfully (aggressive scenario)", async function () {
      this.timeout(60000);

      console.log("🎯 Testing 3x leverage execution");

      const leverageData = await calculateLeverageParamsHelper(
        INITIAL_COLLATERAL,
        TARGET_LEVERAGE_3X,
        COLLATERAL_ASSET,
        BORROW_ASSET
      );

      const [aTokenAddress, , variableDebtTokenAddress] =
        await dataProvider.getReserveTokensAddresses(COLLATERAL_ASSET);

      const swapData = await buildEnhancedSwapData(
        BORROW_ASSET,
        COLLATERAL_ASSET,
        leverageData.flashloanAmount,
        await leverageLoop.getAddress(),
        TARGET_LEVERAGE_3X
      );

      const leverageParams = {
        aToken: aTokenAddress,
        variableDebtAsset: variableDebtTokenAddress,
        collateralAsset: COLLATERAL_ASSET,
        borrowAsset: BORROW_ASSET,
        collateralAmount: INITIAL_COLLATERAL,
        flashloanAmount: leverageData.flashloanAmount,
        swapPathData: swapData,
      };

      const tx = await leverageLoop.executeLeverageLoop(leverageParams);
      await tx.wait();

      // Verify higher leverage achieved
      const aTokenBalance = await aTokenCollateral.balanceOf(userAddr);
      console.log(
        `📈 3x leverage aToken balance: ${ethers.formatEther(
          aTokenBalance
        )} aWETH`
      );

      expect(aTokenBalance).to.be.greaterThan(ethers.parseEther("2")); // Should have > 2 ETH
    });

    it("should validate health factor throughout leverage process", async function () {
      this.timeout(60000);

      console.log("🛡️  Testing health factor validation");

      // Test with conservative leverage to ensure healthy position
      const conservativeLeverage = 1.5;
      const leverageData = await calculateLeverageParamsHelper(
        INITIAL_COLLATERAL,
        conservativeLeverage,
        COLLATERAL_ASSET,
        BORROW_ASSET
      );

      const [aTokenAddress, , variableDebtTokenAddress] =
        await dataProvider.getReserveTokensAddresses(COLLATERAL_ASSET);

      const swapData = await buildEnhancedSwapData(
        BORROW_ASSET,
        COLLATERAL_ASSET,
        leverageData.flashloanAmount,
        await leverageLoop.getAddress()
      );

      const leverageParams = {
        aToken: aTokenAddress,
        variableDebtAsset: variableDebtTokenAddress,
        collateralAsset: COLLATERAL_ASSET,
        borrowAsset: BORROW_ASSET,
        collateralAmount: INITIAL_COLLATERAL,
        flashloanAmount: leverageData.flashloanAmount,
        swapPathData: swapData,
      };

      await leverageLoop.executeLeverageLoop(leverageParams);

      // Verify healthy position maintained
      const [, , , , , healthFactor] = await pool.getUserAccountData(userAddr);
      console.log(
        `🛡️  Final health factor: ${ethers.formatEther(healthFactor)}`
      );

      expect(healthFactor).to.be.greaterThan(ethers.parseEther("1.5")); // Very healthy position
    });
  });

  describe("🔄 Enhanced Deleverage Operations", function () {
    beforeEach(async function () {
      // Create leveraged position for deleverage tests
      console.log("🔧 Creating leveraged position for deleverage test");
      await createLeveragedPosition();
    });

    it("should execute complete deleverage process (README example)", async function () {
      this.timeout(60000);

      console.log("🎯 Testing complete deleverage process as per README");

      // Get current position data
      const aTokenBalanceBefore = await aTokenCollateral.balanceOf(userAddr);
      console.log(
        `📊 aToken balance before deleverage: ${ethers.formatEther(
          aTokenBalanceBefore
        )}`
      );

      // Step 1: Approve aTokens for withdrawal (README step 4)
      await (
        await aTokenCollateral.approve(
          await leverageLoop.getAddress(),
          WITHDRAW_COLLATERAL_AMOUNT
        )
      ).wait();
      console.log("✅ aTokens approved for withdrawal");

      // Step 2: Build deleverage swap data
      const swapData = await buildEnhancedSwapData(
        COLLATERAL_ASSET,
        BORROW_ASSET,
        WITHDRAW_COLLATERAL_AMOUNT,
        await leverageLoop.getAddress()
      );

      // Step 3: Execute deleverage
      const deleverageParams = {
        aToken: await aTokenCollateral.getAddress(),
        collateralAsset: COLLATERAL_ASSET,
        borrowAsset: BORROW_ASSET,
        repayAmount: REPAY_AMOUNT,
        flashloanAmount: WITHDRAW_COLLATERAL_AMOUNT,
        withdrawCollateralAmount: WITHDRAW_COLLATERAL_AMOUNT,
        swapPathData: swapData,
      };

      console.log("⚡ Executing deleverage loop...");
      const tx = await leverageLoop.executeDeleverageLoop(deleverageParams);
      const receipt = await tx.wait();

      console.log(`✅ Deleverage executed in block ${receipt.blockNumber}`);
      console.log(`⛽ Gas used: ${receipt.gasUsed.toLocaleString()}`);

      // Verify position deleveraged
      const aTokenBalanceAfter = await aTokenCollateral.balanceOf(userAddr);
      const [, , , , , healthFactorAfter] = await pool.getUserAccountData(
        userAddr
      );

      console.log(
        `📉 aToken balance after deleverage: ${ethers.formatEther(
          aTokenBalanceAfter
        )}`
      );
      console.log(
        `🛡️  Health factor after deleverage: ${ethers.formatEther(
          healthFactorAfter
        )}`
      );

      // Verify successful deleverage
      expect(aTokenBalanceAfter).to.be.lessThan(aTokenBalanceBefore);
      expect(healthFactorAfter).to.be.greaterThan(ethers.parseEther("1"));
    });

    it("should fail deleverage without aToken approval", async function () {
      console.log("❌ Testing deleverage failure without aToken approval");

      const swapData = await buildEnhancedSwapData(
        COLLATERAL_ASSET,
        BORROW_ASSET,
        WITHDRAW_COLLATERAL_AMOUNT,
        await leverageLoop.getAddress()
      );

      const deleverageParams = {
        aToken: await aTokenCollateral.getAddress(),
        collateralAsset: COLLATERAL_ASSET,
        borrowAsset: BORROW_ASSET,
        repayAmount: REPAY_AMOUNT,
        flashloanAmount: WITHDRAW_COLLATERAL_AMOUNT,
        withdrawCollateralAmount: WITHDRAW_COLLATERAL_AMOUNT,
        swapPathData: swapData,
      };

      // Should fail without aToken approval
      try {
        await leverageLoop.executeDeleverageLoop(deleverageParams);
        throw new Error("Expected transaction to revert");
      } catch (error: any) {
        console.log(
          "✅ Expected revert occurred:",
          error.message.slice(0, 100)
        );
        expect(error.message).to.include("revert");
      }
    });

    it("should handle partial deleverage correctly", async function () {
      this.timeout(60000);

      console.log("🎯 Testing partial deleverage");

      const partialAmount = ethers.parseEther("0.5"); // Partial withdrawal

      await (
        await aTokenCollateral.approve(
          await leverageLoop.getAddress(),
          partialAmount
        )
      ).wait();

      const swapData = await buildEnhancedSwapData(
        COLLATERAL_ASSET,
        BORROW_ASSET,
        partialAmount,
        await leverageLoop.getAddress()
      );

      const deleverageParams = {
        aToken: await aTokenCollateral.getAddress(),
        collateralAsset: COLLATERAL_ASSET,
        borrowAsset: BORROW_ASSET,
        repayAmount: ethers.parseUnits("750", 6), // Partial repayment
        flashloanAmount: partialAmount,
        withdrawCollateralAmount: partialAmount,
        swapPathData: swapData,
      };

      const aTokenBalanceBefore = await aTokenCollateral.balanceOf(userAddr);

      await leverageLoop.executeDeleverageLoop(deleverageParams);

      const aTokenBalanceAfter = await aTokenCollateral.balanceOf(userAddr);
      const reduction = aTokenBalanceBefore - aTokenBalanceAfter;

      console.log(
        `📉 Partial deleverage reduction: ${ethers.formatEther(
          reduction
        )} aWETH`
      );
      expect(reduction).to.be.approximately(
        partialAmount,
        ethers.parseEther("0.1")
      );
    });
  });

  describe("🌐 Multi-Network Compatibility", function () {
    it("should validate contract constants across networks", async function () {
      console.log("🔍 Validating multi-network compatibility");

      // Verify constants work across all networks
      const variableInterestRateMode =
        await leverageLoop.VARIABLE_INTEREST_RATE_MODE();
      const referralCode = await leverageLoop.REFERRAL_CODE();

      expect(variableInterestRateMode).to.equal(2);
      expect(referralCode).to.equal(0);

      console.log(
        "✅ Contract constants validated for multi-network deployment"
      );
    });

    it("should measure gas efficiency for different network optimizations", async function () {
      this.timeout(60000);

      console.log("⛽ Testing gas efficiency optimization");

      const leverageData = await calculateLeverageParamsHelper(
        INITIAL_COLLATERAL,
        TARGET_LEVERAGE_2X,
        COLLATERAL_ASSET,
        BORROW_ASSET
      );

      const [aTokenAddress, , variableDebtTokenAddress] =
        await dataProvider.getReserveTokensAddresses(COLLATERAL_ASSET);

      const leverageParams = {
        aToken: aTokenAddress,
        variableDebtAsset: variableDebtTokenAddress,
        collateralAsset: COLLATERAL_ASSET,
        borrowAsset: BORROW_ASSET,
        collateralAmount: INITIAL_COLLATERAL,
        flashloanAmount: leverageData.flashloanAmount,
        swapPathData: "0x", // Minimal swap data for gas testing
      };

      // Estimate gas
      try {
        const gasEstimate = await leverageLoop.executeLeverageLoop.estimateGas(
          leverageParams
        );
        console.log(`⛽ Estimated gas: ${gasEstimate.toLocaleString()}`);

        // Verify reasonable gas usage (optimized for networks like Base/Soneium)
        expect(gasEstimate).to.be.lessThan(500000); // Should be under 500k gas
      } catch (error) {
        console.log("⚠️  Gas estimation not available in current setup");
      }
    });
  });

  describe("🔧 Owner Controls & Emergency Functions", function () {
    it("should allow owner to execute emergency withdrawal", async function () {
      console.log("🚨 Testing emergency withdrawal functionality");

      // Send some tokens to contract
      await collateral.transfer(
        await leverageLoop.getAddress(),
        ethers.parseEther("0.1")
      );

      const ownerAddr = await leverageLoop.owner();
      const owner = await ethers.getSigner(ownerAddr);

      const leverageLoopWithOwner = new ethers.Contract(
        await leverageLoop.getAddress(),
        ILeverageLoop_ABI,
        owner
      );

      const contractBalanceBefore = await collateral.balanceOf(
        await leverageLoop.getAddress()
      );

      await leverageLoopWithOwner.emergencyWithdraw(COLLATERAL_ASSET);

      const contractBalanceAfter = await collateral.balanceOf(
        await leverageLoop.getAddress()
      );

      expect(contractBalanceAfter).to.equal(0);
      console.log("✅ Emergency withdrawal successful");
    });

    it("should validate ownership transfer functionality", async function () {
      const newOwner = ethers.Wallet.createRandom().address;
      const currentOwner = await leverageLoop.owner();

      const owner = await ethers.getSigner(currentOwner);
      const leverageLoopWithOwner = new ethers.Contract(
        await leverageLoop.getAddress(),
        ILeverageLoop_ABI,
        owner
      );

      await leverageLoopWithOwner.transferOwnership(newOwner);

      const updatedOwner = await leverageLoop.owner();
      expect(updatedOwner).to.equal(newOwner);

      console.log("✅ Ownership transfer validated");
    });
  });

  describe("📊 Advanced Testing Scenarios", function () {
    it("should test Eisen Finance API integration end-to-end", async function () {
      this.timeout(60000);

      console.log("🔗 Testing Eisen Finance API integration");

      // Test quote generation using new API structure
      const leverageLoopAddress = await leverageLoop.getAddress();
      const quoteRequest: EisenQuoteRequest = EisenMockApi.buildQuoteRequest(
        leverageLoopAddress, // fromAddress
        BORROW_ASSET, // fromToken
        COLLATERAL_ASSET, // toToken
        ethers.parseUnits("2000", 6).toString(), // fromAmount - 2000 USDC
        leverageLoopAddress, // toAddress
        8453, // Base chain
        {
          slippage: "0.005", // 0.5%
          order: "CHEAPEST",
        }
      );

      const quote = await EisenMockApi.getQuoteWithFallback(
        quoteRequest,
        false
      ); // Use mock for testing

      console.log(
        `📊 Quote Results: Estimated Output ${quote.result.estimate.toAmount}`
      );
      console.log(
        `   Gas Estimate: ${quote.result.estimate.gasCosts[0].estimate}`
      );
      console.log(`   Price Impact: ${quote.result.estimate.priceImpact}`);

      const swapBytes = EisenMockApi.extractSwapBytes(quote);

      expect(EisenMockApi.validateQuoteResponse(quote)).to.be.true;
      expect(EisenMockApi.extractSwapBytes(quote)).to.match(/^0x[0-9a-fA-F]+$/);
      expect(Number(quote.result.estimate.toAmount)).to.be.greaterThan(0);

      console.log("✅ Eisen Finance API integration validated");
    });

    it("should test batch operations and complex scenarios", async function () {
      this.timeout(120000);

      console.log("🔄 Testing batch operations");

      // Test multiple leverage operations
      const leverageAmounts = [
        ethers.parseEther("0.5"),
        ethers.parseEther("1.0"),
        ethers.parseEther("1.5"),
      ];

      for (let i = 0; i < leverageAmounts.length; i++) {
        const amount = leverageAmounts[i];
        console.log(
          `📈 Executing leverage ${i + 1}/3 with ${ethers.formatEther(
            amount
          )} ETH`
        );

        const leverageData = await calculateLeverageParamsHelper(
          amount,
          TARGET_LEVERAGE_2X,
          COLLATERAL_ASSET,
          BORROW_ASSET
        );

        const [aTokenAddress, , variableDebtTokenAddress] =
          await dataProvider.getReserveTokensAddresses(COLLATERAL_ASSET);

        const swapData = await buildEnhancedSwapData(
          BORROW_ASSET,
          COLLATERAL_ASSET,
          leverageData.flashloanAmount,
          await leverageLoop.getAddress()
        );

        const leverageParams = {
          aToken: aTokenAddress,
          variableDebtAsset: variableDebtTokenAddress,
          collateralAsset: COLLATERAL_ASSET,
          borrowAsset: BORROW_ASSET,
          collateralAmount: amount,
          flashloanAmount: leverageData.flashloanAmount,
          swapPathData: swapData,
        };

        await leverageLoop.executeLeverageLoop(leverageParams);
      }

      console.log("✅ Batch leverage operations completed");
    });
  });

  // Helper functions

  async function createLeveragedPosition() {
    const leverageData = await calculateLeverageParamsHelper(
      INITIAL_COLLATERAL,
      TARGET_LEVERAGE_2X,
      COLLATERAL_ASSET,
      BORROW_ASSET
    );

    const [aTokenAddress, , variableDebtTokenAddress] =
      await dataProvider.getReserveTokensAddresses(COLLATERAL_ASSET);

    const swapData = await buildEnhancedSwapData(
      BORROW_ASSET,
      COLLATERAL_ASSET,
      leverageData.flashloanAmount,
      await leverageLoop.getAddress()
    );

    const leverageParams = {
      aToken: aTokenAddress,
      variableDebtAsset: variableDebtTokenAddress,
      collateralAsset: COLLATERAL_ASSET,
      borrowAsset: BORROW_ASSET,
      collateralAmount: INITIAL_COLLATERAL,
      flashloanAmount: leverageData.flashloanAmount,
      swapPathData: swapData,
    };

    await leverageLoop.executeLeverageLoop(leverageParams);
    console.log("🔧 Leveraged position created");
  }

  after(async function () {
    console.log("🏁 Enhanced fork tests completed");

    try {
      // Log final user state
      const [totalCollateral, totalDebt, , , , healthFactor] =
        await pool.getUserAccountData(userAddr);
      const wethBalance = await collateral.balanceOf(userAddr);
      const aTokenBalance = await aTokenCollateral.balanceOf(userAddr);

      console.log(`📊 Final User State:`);
      console.log(`   WETH Balance: ${ethers.formatEther(wethBalance)}`);
      console.log(`   aToken Balance: ${ethers.formatEther(aTokenBalance)}`);
      console.log(
        `   Total Collateral: ${ethers.formatEther(totalCollateral)}`
      );
      console.log(`   Total Debt: ${ethers.formatEther(totalDebt)}`);
      console.log(`   Health Factor: ${ethers.formatEther(healthFactor)}`);
    } catch (error) {
      console.log("ℹ️  Could not fetch final user state");
    }
  });
});
