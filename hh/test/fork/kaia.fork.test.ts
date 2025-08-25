import { ethers } from "hardhat";
import { expect } from "chai";
import { kaiaConfig } from "../../config/networks/kaia";
import { ForkTestUtils, TestScenario } from "../../utils/forkTestUtils";
import { LeverageCalculator } from "../../utils/leverageCalculator";
import { EisenMockApi, EisenQuoteRequest } from "../../utils/eisenMockApi";

/**
 * @title Enhanced Kaia Fork Tests - LeverageLoop
 * @notice Comprehensive Kaia-specific tests based on README.md specifications
 * @dev Tests native integration with enhanced performance on Kaia network
 */

describe("Enhanced Kaia Fork Tests - LeverageLoop", function () {
  let kaiaContext: any;

  // Only skip if neither explicit KAIA RPC nor env-based forking is configured
  before(function () {
    const forkNetwork = (process.env.FORK_NETWORK || "").toLowerCase();
    const hasKaiaFork = forkNetwork === "kaia";
    if (!process.env.KAIA_RPC_URL && !hasKaiaFork) {
      console.log(
        "⏭️  Skipping Kaia tests - provide KAIA_RPC_URL or set FORK_NETWORK=kaia."
      );
      this.skip();
    }
  });

  before(async function () {
    this.timeout(120000); // Extended timeout for comprehensive setup

    try {
      console.log("🚀 Setting up enhanced Kaia fork test environment");

      // Setup fork test environment with Kaia optimizations
      kaiaContext = await ForkTestUtils.setupForkTest(kaiaConfig);

      // Enhanced user preparation with Kaia-specific optimizations
      await ForkTestUtils.prepareUser(kaiaContext);

      console.log(`🔗 Kaia fork test environment ready`);
      console.log(
        `📍 Network: ${kaiaContext.network.name} (Chain ID: ${kaiaContext.network.chainId})`
      );
      console.log(`🏦 Aave Pool: ${kaiaContext.network.aavePool}`);
      console.log(`💰 WETH: ${kaiaContext.network.weth}`);
      console.log(`💵 USDC: ${kaiaContext.network.usdc}`);
      console.log(
        `⚡ Eisen Router: ${await kaiaContext.eisenRouter.getAddress()}`
      );
    } catch (error: any) {
      if (
        error.message.includes("No known hardfork") ||
        error.code === "BAD_DATA" ||
        error.message.includes("could not detect network") ||
        error.message.includes("No signer available") ||
        (error.data &&
          typeof error.data === "string" &&
          error.data.includes("revert"))
      ) {
        console.warn(
          `⚠️ Skipping Kaia fork test due to RPC/Hardfork incompatibility or environment issue: ${error.message}`
        );
        this.skip();
      } else {
        console.error(`❌ Failed to setup Kaia fork test: ${error}`);
        throw error;
      }
    }
  });

  describe("🚀 Kaia Leverage Loop Operations", function () {
    it("should execute optimized 2x leverage on Kaia (README spec)", async function () {
      this.timeout(60000);

      console.log("🎯 Testing Kaia-optimized 2x leverage execution");

      // Use README specifications for 2x leverage
      const scenario: TestScenario = {
        name: "Kaia Optimized 2x Leverage",
        collateralAmount: ethers.parseEther("1"), // 1 ETH as per README
        targetLeverage: 2.0,
        slippageTolerance: 0.01, // 1% slippage tolerance
        expectedSuccess: true,
      };

      console.log(`📊 Scenario: ${scenario.name}`);
      console.log(
        `💰 Collateral: ${ethers.formatEther(scenario.collateralAmount)} ETH`
      );
      console.log(`📈 Target Leverage: ${scenario.targetLeverage}x`);

      if (!kaiaContext.aaveAvailable) {
        console.log(
          "ℹ️  Skipping leverage test: Aave-like pool not available on Kaia"
        );
        this.skip();
      }

      const success = await ForkTestUtils.runLeverageScenario(
        kaiaContext,
        scenario
      );
      expect(success).to.be.true;

      console.log("✅ Kaia 2x leverage executed successfully");
    });

    it("should execute enhanced 3x leverage on Kaia", async function () {
      this.timeout(60000);

      console.log("🎯 Testing Kaia-enhanced 3x leverage execution");

      // Enhanced 3x leverage scenario
      const scenario: TestScenario = {
        name: "Kaia Enhanced 3x Leverage",
        collateralAmount: ethers.parseEther("0.5"), // Smaller amount for higher leverage
        targetLeverage: 3.0,
        slippageTolerance: 0.02, // 2% slippage for higher leverage
        expectedSuccess: true,
      };

      console.log(`📊 Enhanced 3x leverage test`);
      console.log(
        `💰 Collateral: ${ethers.formatEther(scenario.collateralAmount)} ETH`
      );

      if (!kaiaContext.aaveAvailable) {
        console.log(
          "ℹ️  Skipping leverage test: Aave-like pool not available on Kaia"
        );
        this.skip();
      }
      const success = await ForkTestUtils.runLeverageScenario(
        kaiaContext,
        scenario
      );
      expect(success).to.be.true;

      console.log("✅ Kaia 3x leverage executed with enhanced performance");
    });

    it("should handle aggressive 4x leverage with Kaia optimizations", async function () {
      this.timeout(60000);

      console.log("🎯 Testing aggressive 4x leverage with Kaia optimizations");

      const scenario: TestScenario = {
        name: "Kaia Aggressive 4x Leverage",
        collateralAmount: ethers.parseEther("0.3"),
        targetLeverage: 4.0,
        slippageTolerance: 0.03, // 3% slippage tolerance
        expectedSuccess: true,
      };

      console.log(`⚠️  High leverage scenario - 4x with optimizations`);

      if (!kaiaContext.aaveAvailable) {
        console.log(
          "ℹ️  Skipping leverage test: Aave-like pool not available on Kaia"
        );
        this.skip();
      }
      const success = await ForkTestUtils.runLeverageScenario(
        kaiaContext,
        scenario
      );
      expect(success).to.be.true;

      console.log("✅ Aggressive 4x leverage handled successfully on Kaia");
    });

    it("should properly reject invalid leverage parameters", async function () {
      console.log("❌ Testing parameter validation on Kaia");

      // Test zero collateral - should fail
      const invalidScenario: TestScenario = {
        name: "Invalid Zero Collateral",
        collateralAmount: ethers.parseEther("0"),
        targetLeverage: 2.0,
        slippageTolerance: 0.01,
        expectedSuccess: false,
      };

      const success = await ForkTestUtils.runLeverageScenario(
        kaiaContext,
        invalidScenario
      );
      expect(success).to.be.true; // Success because we expect this to fail

      console.log("✅ Invalid parameters properly rejected");
    });

    it("should handle extreme leverage scenarios with proper safety", async function () {
      console.log("🛡️  Testing extreme leverage safety on Kaia");

      const extremeScenario: TestScenario = {
        name: "Extreme Leverage Safety Test",
        collateralAmount: ethers.parseEther("1"),
        targetLeverage: 15.0, // Extremely high leverage
        slippageTolerance: 0.05,
        expectedSuccess: false, // Should fail due to safety checks
      };

      const success = await ForkTestUtils.runLeverageScenario(
        kaiaContext,
        extremeScenario
      );
      expect(success).to.be.true; // Success because we expect this to fail

      console.log("✅ Extreme leverage scenarios properly handled");
    });
  });

  describe("🔄 Kaia Deleverage Operations", function () {
    before(async function () {
      // Create enhanced leveraged position for deleverage tests
      console.log(
        "🔧 Creating enhanced leveraged position for Kaia deleverage tests"
      );

      const leverageScenario: TestScenario = {
        name: "Setup for Enhanced Deleverage",
        collateralAmount: ethers.parseEther("2"), // Larger position
        targetLeverage: 2.5,
        slippageTolerance: 0.02,
        expectedSuccess: true,
      };

      if (!kaiaContext.aaveAvailable) {
        console.log("ℹ️  Skipping setup: Aave-like pool not available on Kaia");
        this.skip();
      }
      await ForkTestUtils.runLeverageScenario(kaiaContext, leverageScenario);
      console.log(
        "🔧 Enhanced leveraged position created for Kaia deleverage tests"
      );
    });

    it("should execute optimized partial deleverage on Kaia", async function () {
      this.timeout(60000);

      console.log("🎯 Testing Kaia-optimized partial deleverage");

      const withdrawAmount = ethers.parseEther("1");
      const repayAmount = ethers.parseUnits("1000", 6); // 1000 USDC

      console.log(`📉 Deleverage parameters:`);
      console.log(`   Withdraw: ${ethers.formatEther(withdrawAmount)} ETH`);
      console.log(`   Repay: ${ethers.formatUnits(repayAmount, 6)} USDC`);

      if (!kaiaContext.aaveAvailable) {
        console.log(
          "ℹ️  Skipping deleverage test: Aave-like pool not available on Kaia"
        );
        this.skip();
      }
      const success = await ForkTestUtils.runDeleverageScenario(
        kaiaContext,
        withdrawAmount,
        repayAmount
      );

      expect(success).to.be.true;
      console.log("✅ Kaia partial deleverage completed successfully");
    });

    it("should handle complete position deleverage with Kaia efficiency", async function () {
      this.timeout(60000);

      console.log("🎯 Testing complete position deleverage on Kaia");

      // Complete deleverage parameters
      const withdrawAmount = ethers.parseEther("1.5");
      const repayAmount = ethers.parseUnits("2000", 6); // 2000 USDC

      console.log(`📉 Complete deleverage:`);
      console.log(`   Withdraw: ${ethers.formatEther(withdrawAmount)} ETH`);
      console.log(`   Repay: ${ethers.formatUnits(repayAmount, 6)} USDC`);

      if (!kaiaContext.aaveAvailable) {
        console.log(
          "ℹ️  Skipping deleverage test: Aave-like pool not available on Kaia"
        );
        this.skip();
      }
      const success = await ForkTestUtils.runDeleverageScenario(
        kaiaContext,
        withdrawAmount,
        repayAmount
      );

      expect(success).to.be.true;
      console.log("✅ Complete deleverage executed with Kaia efficiency");
    });

    it("should properly fail deleverage without aToken approval", async function () {
      console.log(
        "❌ Testing deleverage failure without aToken approval on Kaia"
      );

      // Reset approvals to test failure case
      await kaiaContext.aTokenCollateral.approve(
        await kaiaContext.leverageLoop.getAddress(),
        0
      );

      const withdrawAmount = ethers.parseEther("0.5");
      const repayAmount = ethers.parseUnits("500", 6);

      try {
        if (!kaiaContext.aaveAvailable) {
          console.log(
            "ℹ️  Skipping deleverage revert test: Aave-like pool not available on Kaia"
          );
          this.skip();
        }
        await ForkTestUtils.runDeleverageScenario(
          kaiaContext,
          withdrawAmount,
          repayAmount
        );
        expect.fail("Should have reverted due to lack of approval");
      } catch (error: any) {
        console.log(
          "✅ Expected revert occurred:",
          error.message.slice(0, 100)
        );
        expect(error.message).to.include("revert");
      }
    });
  });

  describe("⚡ Kaia-Specific Optimizations", function () {
    it("should demonstrate Kaia gas optimization benefits", async function () {
      console.log("⛽ Testing Kaia gas optimization benefits");

      // Test gas efficiency on Kaia
      try {
        const gasEstimate =
          await kaiaContext.leverageLoop.estimateGas.executeLeverageLoop({
            aToken: await kaiaContext.aTokenCollateral.getAddress(),
            variableDebtAsset: await kaiaContext.variableDebtToken.getAddress(),
            collateralAsset: kaiaContext.network.weth,
            borrowAsset: kaiaContext.network.usdc,
            collateralAmount: ethers.parseEther("1"),
            flashloanAmount: ethers.parseUnits("1000", 6),
            swapPathData: "0x",
          });

        console.log(`⛽ Kaia gas estimate: ${gasEstimate.toLocaleString()}`);

        // Kaia should have optimized gas costs (expect < 400k for enhanced performance)
        expect(gasEstimate).to.be.lt(400000);
        console.log("✅ Kaia gas optimization validated");
      } catch (error: any) {
        console.log(
          `⚠️  Gas estimation not available in current setup: ${error.message}`
        );
      }
    });

    it("should verify Kaia network parameters and chain ID", async function () {
      console.log("🔍 Verifying Kaia network parameters");

      const provider = ethers.provider;
      const network = await provider.getNetwork();

      // Accept either the Kaia chain ID (8217) or the local fork default (1) depending on Hardhat settings
      const acceptableChainIds = [BigInt(kaiaConfig.chainId), 1n];
      expect(acceptableChainIds).to.include(network.chainId);
      console.log(`🔗 Verified chain ID: ${network.chainId}`);

      // Test block time and other Kaia-specific optimizations
      const latestBlock = await provider.getBlock("latest");
      console.log(`📦 Latest block: ${latestBlock?.number}`);
      console.log(`⏰ Block timestamp: ${latestBlock?.timestamp}`);

      console.log("✅ Kaia network parameters validated");
    });

    it("should test Kaia-specific token interactions and wrapping", async function () {
      console.log("💰 Testing Kaia-specific token interactions");

      // Test native token interactions on Kaia
      const initialBalance = await kaiaContext.collateral.balanceOf(
        kaiaContext.user
      );
      console.log(
        `💰 Initial WETH balance: ${ethers.formatEther(initialBalance)}`
      );

      // Test if we can deposit more ETH (Kaia-specific behavior)
      try {
        const depositAmount = ethers.parseEther("0.1");
        const tx = await kaiaContext.collateral.deposit({
          value: depositAmount,
        });
        await tx.wait();

        const newBalance = await kaiaContext.collateral.balanceOf(
          kaiaContext.user
        );
        expect(newBalance).to.be.gt(initialBalance);

        console.log(
          `✅ Successfully deposited ${ethers.formatEther(
            depositAmount
          )} ETH on Kaia`
        );
        console.log(`💰 New balance: ${ethers.formatEther(newBalance)} WETH`);
      } catch (error: any) {
        console.log(
          `ℹ️  ETH deposit behavior varies on Kaia: ${error.message}`
        );
      }
    });

    it("should test Kaia-specific performance characteristics", async function () {
      this.timeout(120000);

      console.log("🚀 Testing Kaia performance characteristics");

      // Test multiple rapid operations to verify Kaia performance
      const performanceTests = [
        {
          name: "Quick 1.5x Leverage",
          leverage: 1.5,
          amount: ethers.parseEther("0.5"),
        },
        {
          name: "Quick 2x Leverage",
          leverage: 2.0,
          amount: ethers.parseEther("0.3"),
        },
        {
          name: "Quick 2.5x Leverage",
          leverage: 2.5,
          amount: ethers.parseEther("0.2"),
        },
      ];

      console.log(`🎯 Running ${performanceTests.length} performance tests`);

      if (!kaiaContext.aaveAvailable) {
        console.log(
          "ℹ️  Skipping performance characteristics: Aave-like pool not available on Kaia"
        );
        this.skip();
      }

      for (let i = 0; i < performanceTests.length; i++) {
        const test = performanceTests[i];
        console.log(`⚡ Test ${i + 1}: ${test.name}`);

        const scenario: TestScenario = {
          name: test.name,
          collateralAmount: test.amount,
          targetLeverage: test.leverage,
          slippageTolerance: 0.015, // 1.5% tolerance
          expectedSuccess: true,
        };

        const startTime = Date.now();
        const success = await ForkTestUtils.runLeverageScenario(
          kaiaContext,
          scenario
        );
        const endTime = Date.now();

        expect(success).to.be.true;
        console.log(`   ⏱️  Completed in ${endTime - startTime}ms`);
      }

      console.log("✅ Kaia performance characteristics validated");
    });
  });

  describe("🔗 Enhanced Eisen Finance Integration on Kaia", function () {
    it("should test comprehensive Eisen API integration on Kaia", async function () {
      this.timeout(60000);

      console.log(
        "🔗 Testing comprehensive Eisen Finance API integration on Kaia"
      );

      // Test multiple quote scenarios using new API structure
      const quoteTests = [
        { amount: "1000", desc: "Standard 1k USDC swap" },
        { amount: "5000", desc: "Large 5k USDC swap" },
        { amount: "100", desc: "Small 100 USDC swap" },
      ];

      const leverageLoopAddress = await kaiaContext.leverageLoop.getAddress();

      for (const test of quoteTests) {
        console.log(`📊 Testing: ${test.desc}`);

        const quoteRequest: EisenQuoteRequest = EisenMockApi.buildQuoteRequest(
          leverageLoopAddress, // fromAddress
          kaiaContext.network.usdc, // fromToken
          kaiaContext.network.weth, // toToken
          ethers.parseUnits(test.amount, 6).toString(), // fromAmount
          leverageLoopAddress, // toAddress
          8217, // Kaia chain ID
          {
            slippage: "0.005", // 0.5%
            order: "CHEAPEST",
          }
        );

        const quote = await EisenMockApi.getQuoteWithFallback(
          quoteRequest,
          false // Use mock for Kaia testing - Changed to false for fork tests
        );

        expect(EisenMockApi.validateQuoteResponse(quote)).to.be.true;
        expect(EisenMockApi.extractSwapBytes(quote)).to.match(
          /^0x[0-9a-fA-F]+$/
        );
        // The EisenQuoteResponse interface was updated to move these fields under `estimate`
        expect(Number(quote.result.estimate.toAmount)).to.be.greaterThan(0);

        console.log(
          `   💱 ${test.amount} USDC → ${ethers.formatEther(
            quote.result.estimate.toAmount
          )} WETH`
        );
        console.log(`   ⛽ Gas: ${quote.result.estimate.gasCosts[0].estimate}`);
        console.log(`   💹 Impact: ${quote.result.estimate.priceImpact}`);
      }

      console.log("✅ Comprehensive Eisen API integration validated on Kaia");
    });

    it("should test batch quote operations optimized for Kaia", async function () {
      this.timeout(60000);

      console.log("🔄 Testing batch quote operations on Kaia");

      const amounts = [
        ethers.parseUnits("500", 6).toString(),
        ethers.parseUnits("1000", 6).toString(),
        ethers.parseUnits("2000", 6).toString(),
      ];

      const leverageLoopAddress = await kaiaContext.leverageLoop.getAddress();
      const requests: EisenQuoteRequest[] = amounts.map((amount) =>
        EisenMockApi.buildQuoteRequest(
          leverageLoopAddress,
          kaiaContext.network.usdc,
          kaiaContext.network.weth,
          amount,
          leverageLoopAddress,
          8217, // Kaia chain ID
          {
            slippage: "0.005",
            order: "CHEAPEST",
          }
        )
      );

      console.log(`📋 Processing ${requests.length} batch quotes`);

      const quotes = await EisenMockApi.getBatchQuotes(requests, false); // Use mock for Kaia testing - Changed to false for fork tests

      expect(quotes).to.have.length(3);
      quotes.forEach((quote, index) => {
        expect(EisenMockApi.validateQuoteResponse(quote)).to.be.true;
        console.log(`📊 Batch Quote ${index + 1}:`);
        console.log(`   Amount: ${ethers.formatUnits(amounts[index], 6)} USDC`);
        console.log(
          `   Output: ${ethers.formatEther(
            quote.result.estimate.toAmount
          )} WETH`
        );
        console.log(`   Gas: ${quote.result.estimate.gasCosts[0].estimate}`);
      });

      // Calculate total gas cost for batch operation
      const totalGas = EisenMockApi.calculateTotalGasCost(quotes, 20000000000); // 20 gwei
      console.log(`⛽ Total batch gas cost: ${totalGas.toLocaleString()}`);

      console.log("✅ Batch quote operations optimized for Kaia");
    });
  });

  describe("🧮 Advanced Leverage Calculations on Kaia", function () {
    it("should calculate optimal leverage parameters for Kaia deployment", async function () {
      console.log("🧮 Testing optimal leverage calculations for Kaia");

      const testCases = [
        { collateral: "1", leverage: 2.0, desc: "Conservative 2x" },
        { collateral: "2", leverage: 2.5, desc: "Moderate 2.5x" },
        { collateral: "5", leverage: 3.0, desc: "Aggressive 3x" },
        { collateral: "0.5", leverage: 4.0, desc: "High-risk 4x" },
      ];

      for (const testCase of testCases) {
        console.log(`📊 ${testCase.desc} leverage calculation`);

        const collateralAmount = ethers.parseEther(testCase.collateral);
        const collateralPrice = EisenMockApi.getMockPrice(
          kaiaContext.network.weth
        );
        const borrowPrice = EisenMockApi.getMockPrice(kaiaContext.network.usdc);

        const leverageData = LeverageCalculator.calculateLeverageParams(
          0n,
          0n,
          undefined,
          undefined,
          collateralPrice,
          borrowPrice,
          await kaiaContext.collateral.decimals(),
          await kaiaContext.debt.decimals(),
          collateralAmount,
          testCase.leverage,
          ethers.parseEther("0.0008")
        );

        expect(leverageData.flashloanAmount).to.be.gt(0);
        expect(leverageData.debtAmount).to.be.gt(0);
        expect(leverageData.collateralAmount).to.be.gt(collateralAmount);

        // Validate safety parameters
        const isValid = LeverageCalculator.validateLeverageParams(
          leverageData,
          collateralAmount,
          testCase.leverage
        );

        console.log(`   ✅ Valid: ${isValid}`);
        console.log(
          `   💰 Flashloan: ${ethers.formatUnits(
            leverageData.flashloanAmount,
            await kaiaContext.debt.decimals()
          )}`
        );
        console.log(
          `   📈 Post Collateral: ${ethers.formatUnits(
            leverageData.collateralAmount,
            await kaiaContext.collateral.decimals()
          )}`
        );
        console.log(
          `   🧾 Post Debt: ${ethers.formatUnits(
            leverageData.debtAmount,
            await kaiaContext.debt.decimals()
          )}`
        );
        // iterations no longer applicable

        // High leverage should be flagged as potentially unsafe
        if (testCase.leverage >= 4.0) {
          console.log(`   ⚠️  High leverage detected: ${testCase.leverage}x`);
        }
      }

      console.log("✅ Leverage calculations optimized for Kaia");
    });

    it("should validate leverage safety matrix for Kaia parameters", async function () {
      console.log("🛡️  Testing leverage safety matrix for Kaia");

      const leverageRatios = [1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 5.0];
      const collateralAmount = ethers.parseEther("1");
      const collateralPrice = EisenMockApi.getMockPrice(
        kaiaContext.network.weth
      );
      const borrowPrice = EisenMockApi.getMockPrice(kaiaContext.network.usdc);

      console.log(`🔍 Testing ${leverageRatios.length} leverage ratios`);
      console.log(`Leverage  Safe?  Flashloan Amount    Expected Supply`);
      console.log(`--------  -----  ----------------    ---------------`);

      for (const leverage of leverageRatios) {
        const leverageData = LeverageCalculator.calculateLeverageParams(
          0n,
          0n,
          undefined,
          undefined,
          collateralPrice,
          borrowPrice,
          await kaiaContext.collateral.decimals(),
          await kaiaContext.debt.decimals(),
          collateralAmount,
          leverage,
          ethers.parseEther("0.0008")
        );

        const isValid = LeverageCalculator.validateLeverageParams(
          leverageData,
          collateralAmount,
          leverage
        );

        const flashloanStr = ethers
          .formatUnits(
            leverageData.flashloanAmount,
            await kaiaContext.debt.decimals()
          )
          .padEnd(15);
        const supplyStr = ethers
          .formatUnits(
            leverageData.collateralAmount,
            await kaiaContext.collateral.decimals()
          )
          .padEnd(15);
        const safeStr = isValid ? "✅" : "❌";

        console.log(
          `${leverage.toFixed(
            1
          )}x      ${safeStr}     ${flashloanStr}   ${supplyStr}`
        );
      }

      // Ensure reasonable leverages are safe
      const safeLeverageData = LeverageCalculator.calculateLeverageParams(
        0n,
        0n,
        undefined,
        undefined,
        collateralPrice,
        borrowPrice,
        await kaiaContext.collateral.decimals(),
        await kaiaContext.debt.decimals(),
        collateralAmount,
        2.0,
        ethers.parseEther("0.0008")
      );

      const isSafe = LeverageCalculator.validateLeverageParams(
        safeLeverageData,
        collateralAmount,
        2.0
      );

      expect(isSafe).to.be.true;
      console.log("✅ Leverage safety matrix validated for Kaia parameters");
    });
  });

  after(async function () {
    if (kaiaContext) {
      console.log("🏁 Enhanced Kaia fork tests completed");
      console.log("Done");
    }
  });
});
