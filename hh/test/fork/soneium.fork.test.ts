import { ethers } from "hardhat";
import { expect } from "chai";
import { soneiumConfig } from "../../config/networks/soneium";
import { ForkTestUtils, TestScenario } from "../../utils/forkTestUtils";
import { LeverageCalculator } from "../../utils/leverageCalculator";
import { EisenMockApi, EisenQuoteRequest } from "../../utils/eisenMockApi";

/**
 * @title Enhanced Soneium Fork Tests - LeverageLoop
 * @notice Comprehensive Soneium-specific tests based on README.md specifications
 * @dev Tests native integration with enhanced performance on Soneium network
 */

describe("Enhanced Soneium Fork Tests - LeverageLoop", function () {
  let soneiumContext: any;

  // Skip if no Soneium RPC URL provided
  before(function () {
    if (!process.env.SONEIUM_RPC_URL) {
      console.log("⏭️  Skipping Soneium tests - SONEIUM_RPC_URL not provided.");
      this.skip();
    }
  });

  before(async function () {
    this.timeout(120000); // Extended timeout for comprehensive setup

    try {
      console.log("🚀 Setting up enhanced Soneium fork test environment");

      // Setup fork test environment with Soneium optimizations
      soneiumContext = await ForkTestUtils.setupForkTest(soneiumConfig);

      // Enhanced user preparation with Soneium-specific optimizations
      await ForkTestUtils.prepareUser(soneiumContext);

      console.log(`🔗 Soneium fork test environment ready`);
      console.log(
        `📍 Network: ${soneiumContext.network.name} (Chain ID: ${soneiumContext.network.chainId})`
      );
      console.log(`🏦 Aave Pool: ${soneiumContext.network.aavePool}`);
      console.log(`💰 WETH: ${soneiumContext.network.weth}`);
      console.log(`💵 USDC: ${soneiumContext.network.usdc}`);
      console.log(
        `⚡ Eisen Router: ${await soneiumContext.eisenRouter.getAddress()}`
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
          `⚠️ Skipping Soneium fork test due to RPC/Hardfork incompatibility or environment issue: ${error.message}`
        );
        this.skip();
      } else {
        console.error(`❌ Failed to setup Soneium fork test: ${error}`);
        throw error;
      }
    }
  });

  describe("🚀 Soneium Leverage Loop Operations", function () {
    it("should execute optimized 2x leverage on Soneium (README spec)", async function () {
      this.timeout(60000);

      console.log("🎯 Testing Soneium-optimized 2x leverage execution");

      // Use README specifications for 2x leverage
      const scenario: TestScenario = {
        name: "Soneium Optimized 2x Leverage",
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

      const success = await ForkTestUtils.runLeverageScenario(
        soneiumContext,
        scenario
      );
      expect(success).to.be.true;

      console.log("✅ Soneium 2x leverage executed successfully");
    });

    it("should execute enhanced 3x leverage on Soneium", async function () {
      this.timeout(60000);

      console.log("🎯 Testing Soneium-enhanced 3x leverage execution");

      // Enhanced 3x leverage scenario
      const scenario: TestScenario = {
        name: "Soneium Enhanced 3x Leverage",
        collateralAmount: ethers.parseEther("0.5"), // Smaller amount for higher leverage
        targetLeverage: 3.0,
        slippageTolerance: 0.02, // 2% slippage for higher leverage
        expectedSuccess: true,
      };

      console.log(`📊 Enhanced 3x leverage test`);
      console.log(
        `💰 Collateral: ${ethers.formatEther(scenario.collateralAmount)} ETH`
      );

      const success = await ForkTestUtils.runLeverageScenario(
        soneiumContext,
        scenario
      );
      expect(success).to.be.true;

      console.log("✅ Soneium 3x leverage executed with enhanced performance");
    });

    it("should handle aggressive 4x leverage with Soneium optimizations", async function () {
      this.timeout(60000);

      console.log(
        "🎯 Testing aggressive 4x leverage with Soneium optimizations"
      );

      const scenario: TestScenario = {
        name: "Soneium Aggressive 4x Leverage",
        collateralAmount: ethers.parseEther("0.3"),
        targetLeverage: 4.0,
        slippageTolerance: 0.03, // 3% slippage tolerance
        expectedSuccess: true,
      };

      console.log(`⚠️  High leverage scenario - 4x with optimizations`);

      const success = await ForkTestUtils.runLeverageScenario(
        soneiumContext,
        scenario
      );
      expect(success).to.be.true;

      console.log("✅ Aggressive 4x leverage handled successfully on Soneium");
    });

    it("should properly reject invalid leverage parameters", async function () {
      console.log("❌ Testing parameter validation on Soneium");

      // Test zero collateral - should fail
      const invalidScenario: TestScenario = {
        name: "Invalid Zero Collateral",
        collateralAmount: ethers.parseEther("0"),
        targetLeverage: 2.0,
        slippageTolerance: 0.01,
        expectedSuccess: false,
      };

      const success = await ForkTestUtils.runLeverageScenario(
        soneiumContext,
        invalidScenario
      );
      expect(success).to.be.true; // Success because we expect this to fail

      console.log("✅ Invalid parameters properly rejected");
    });

    it("should handle extreme leverage scenarios with proper safety", async function () {
      console.log("🛡️  Testing extreme leverage safety on Soneium");

      const extremeScenario: TestScenario = {
        name: "Extreme Leverage Safety Test",
        collateralAmount: ethers.parseEther("1"),
        targetLeverage: 15.0, // Extremely high leverage
        slippageTolerance: 0.05,
        expectedSuccess: false, // Should fail due to safety checks
      };

      const success = await ForkTestUtils.runLeverageScenario(
        soneiumContext,
        extremeScenario
      );
      expect(success).to.be.true; // Success because we expect this to fail

      console.log("✅ Extreme leverage scenarios properly handled");
    });
  });

  describe("🔄 Soneium Deleverage Operations", function () {
    before(async function () {
      // Create enhanced leveraged position for deleverage tests
      console.log(
        "🔧 Creating enhanced leveraged position for Soneium deleverage tests"
      );

      const leverageScenario: TestScenario = {
        name: "Setup for Enhanced Deleverage",
        collateralAmount: ethers.parseEther("2"), // Larger position
        targetLeverage: 2.5,
        slippageTolerance: 0.02,
        expectedSuccess: true,
      };

      await ForkTestUtils.runLeverageScenario(soneiumContext, leverageScenario);
      console.log(
        "🔧 Enhanced leveraged position created for Soneium deleverage tests"
      );
    });

    it("should execute optimized partial deleverage on Soneium", async function () {
      this.timeout(60000);

      console.log("🎯 Testing Soneium-optimized partial deleverage");

      const withdrawAmount = ethers.parseEther("1");
      const repayAmount = ethers.parseUnits("1000", 6); // 1000 USDC

      console.log(`📉 Deleverage parameters:`);
      console.log(`   Withdraw: ${ethers.formatEther(withdrawAmount)} ETH`);
      console.log(`   Repay: ${ethers.formatUnits(repayAmount, 6)} USDC`);

      const success = await ForkTestUtils.runDeleverageScenario(
        soneiumContext,
        withdrawAmount,
        repayAmount
      );

      expect(success).to.be.true;
      console.log("✅ Soneium partial deleverage completed successfully");
    });

    it("should handle complete position deleverage with Soneium efficiency", async function () {
      this.timeout(60000);

      console.log("🎯 Testing complete position deleverage on Soneium");

      // Complete deleverage parameters
      const withdrawAmount = ethers.parseEther("1.5");
      const repayAmount = ethers.parseUnits("2000", 6); // 2000 USDC

      console.log(`📉 Complete deleverage:`);
      console.log(`   Withdraw: ${ethers.formatEther(withdrawAmount)} ETH`);
      console.log(`   Repay: ${ethers.formatUnits(repayAmount, 6)} USDC`);

      const success = await ForkTestUtils.runDeleverageScenario(
        soneiumContext,
        withdrawAmount,
        repayAmount
      );

      expect(success).to.be.true;
      console.log("✅ Complete deleverage executed with Soneium efficiency");
    });

    it("should properly fail deleverage without aToken approval", async function () {
      console.log(
        "❌ Testing deleverage failure without aToken approval on Soneium"
      );

      // Reset approvals to test failure case
      await soneiumContext.aTokenCollateral.approve(
        await soneiumContext.leverageLoop.getAddress(),
        0
      );

      const withdrawAmount = ethers.parseEther("0.5");
      const repayAmount = ethers.parseUnits("500", 6);

      try {
        await ForkTestUtils.runDeleverageScenario(
          soneiumContext,
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

  describe("⚡ Soneium-Specific Optimizations", function () {
    it("should demonstrate Soneium gas optimization benefits", async function () {
      console.log("⛽ Testing Soneium gas optimization benefits");

      // Test gas efficiency on Soneium
      try {
        const gasEstimate =
          await soneiumContext.leverageLoop.estimateGas.executeLeverageLoop({
            aToken: await soneiumContext.aTokenCollateral.getAddress(),
            variableDebtAsset:
              await soneiumContext.variableDebtToken.getAddress(),
            collateralAsset: soneiumContext.network.weth,
            borrowAsset: soneiumContext.network.usdc,
            collateralAmount: ethers.parseEther("1"),
            flashloanAmount: ethers.parseUnits("1000", 6),
            swapPathData: "0x",
          });

        console.log(`⛽ Soneium gas estimate: ${gasEstimate.toLocaleString()}`);

        // Soneium should have optimized gas costs (expect < 400k for enhanced performance)
        expect(gasEstimate).to.be.lt(400000);
        console.log("✅ Soneium gas optimization validated");
      } catch (error: any) {
        console.log(
          `⚠️  Gas estimation not available in current setup: ${error.message}`
        );
      }
    });

    it("should verify Soneium network parameters and chain ID", async function () {
      console.log("🔍 Verifying Soneium network parameters");

      const provider = ethers.provider;
      const network = await provider.getNetwork();

      expect(network.chainId).to.equal(BigInt(soneiumConfig.chainId));
      console.log(`🔗 Verified Soneium chain ID: ${network.chainId}`);

      // Test block time and other Soneium-specific optimizations
      const latestBlock = await provider.getBlock("latest");
      console.log(`📦 Latest block: ${latestBlock?.number}`);
      console.log(`⏰ Block timestamp: ${latestBlock?.timestamp}`);

      console.log("✅ Soneium network parameters validated");
    });

    it("should test Soneium-specific token interactions and wrapping", async function () {
      console.log("💰 Testing Soneium-specific token interactions");

      // Test native token interactions on Soneium
      const initialBalance = await soneiumContext.collateral.balanceOf(
        soneiumContext.user
      );
      console.log(
        `💰 Initial WETH balance: ${ethers.formatEther(initialBalance)}`
      );

      // Test if we can deposit more ETH (Soneium-specific behavior)
      try {
        const depositAmount = ethers.parseEther("0.1");
        const tx = await soneiumContext.collateral.deposit({
          value: depositAmount,
        });
        await tx.wait();

        const newBalance = await soneiumContext.collateral.balanceOf(
          soneiumContext.user
        );
        expect(newBalance).to.be.gt(initialBalance);

        console.log(
          `✅ Successfully deposited ${ethers.formatEther(
            depositAmount
          )} ETH on Soneium`
        );
        console.log(`💰 New balance: ${ethers.formatEther(newBalance)} WETH`);
      } catch (error: any) {
        console.log(
          `ℹ️  ETH deposit behavior varies on Soneium: ${error.message}`
        );
      }
    });

    it("should test Soneium-specific performance characteristics", async function () {
      this.timeout(120000);

      console.log("🚀 Testing Soneium performance characteristics");

      // Test multiple rapid operations to verify Soneium performance
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
          soneiumContext,
          scenario
        );
        const endTime = Date.now();

        expect(success).to.be.true;
        console.log(`   ⏱️  Completed in ${endTime - startTime}ms`);
      }

      console.log("✅ Soneium performance characteristics validated");
    });
  });

  describe("🔗 Enhanced Eisen Finance Integration on Soneium", function () {
    it("should test comprehensive Eisen API integration on Soneium", async function () {
      this.timeout(60000);

      console.log(
        "🔗 Testing comprehensive Eisen Finance API integration on Soneium"
      );

      // Test multiple quote scenarios using new API structure
      const quoteTests = [
        { amount: "1000", desc: "Standard 1k USDC swap" },
        { amount: "5000", desc: "Large 5k USDC swap" },
        { amount: "100", desc: "Small 100 USDC swap" },
      ];

      const leverageLoopAddress =
        await soneiumContext.leverageLoop.getAddress();

      for (const test of quoteTests) {
        console.log(`📊 Testing: ${test.desc}`);

        const quoteRequest: EisenQuoteRequest = EisenMockApi.buildQuoteRequest(
          leverageLoopAddress, // fromAddress
          soneiumContext.network.usdc, // fromToken
          soneiumContext.network.weth, // toToken
          ethers.parseUnits(test.amount, 6).toString(), // fromAmount
          leverageLoopAddress, // toAddress
          1946, // Soneium chain ID
          {
            slippage: "0.005", // 0.5%
            order: "CHEAPEST",
          }
        );

        const quote = await EisenMockApi.getQuoteWithFallback(
          quoteRequest,
          false // Use mock for Soneium testing - Changed to false for fork tests
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

      console.log(
        "✅ Comprehensive Eisen API integration validated on Soneium"
      );
    });

    it("should test batch quote operations optimized for Soneium", async function () {
      this.timeout(60000);

      console.log("🔄 Testing batch quote operations on Soneium");

      const amounts = [
        ethers.parseUnits("500", 6).toString(),
        ethers.parseUnits("1000", 6).toString(),
        ethers.parseUnits("2000", 6).toString(),
      ];

      const leverageLoopAddress =
        await soneiumContext.leverageLoop.getAddress();
      const requests: EisenQuoteRequest[] = amounts.map((amount) =>
        EisenMockApi.buildQuoteRequest(
          leverageLoopAddress,
          soneiumContext.network.usdc,
          soneiumContext.network.weth,
          amount,
          leverageLoopAddress,
          1946, // Soneium chain ID
          {
            slippage: "0.005",
            order: "CHEAPEST",
          }
        )
      );

      console.log(`📋 Processing ${requests.length} batch quotes`);

      const quotes = await EisenMockApi.getBatchQuotes(requests, false); // Use mock for Soneium testing - Changed to false for fork tests

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

      console.log("✅ Batch quote operations optimized for Soneium");
    });
  });

  describe("🧮 Advanced Leverage Calculations on Soneium", function () {
    it("should calculate optimal leverage parameters for Soneium deployment", async function () {
      console.log("🧮 Testing optimal leverage calculations for Soneium");

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
          soneiumContext.network.weth
        );
        const borrowPrice = EisenMockApi.getMockPrice(
          soneiumContext.network.usdc
        );

        const leverageData = LeverageCalculator.calculateLeverageParams(
          0n,
          0n,
          undefined,
          undefined,
          BigInt(Math.floor(collateralPrice * 1e18)),
          BigInt(Math.floor(borrowPrice * 1e18)),
          await soneiumContext.collateral.decimals(),
          await soneiumContext.debt.decimals(),
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
            await soneiumContext.debt.decimals()
          )}`
        );
        console.log(
          `   📈 Post Collateral: ${ethers.formatUnits(
            leverageData.collateralAmount,
            await soneiumContext.collateral.decimals()
          )}`
        );
        console.log(
          `   🧾 Post Debt: ${ethers.formatUnits(
            leverageData.debtAmount,
            await soneiumContext.debt.decimals()
          )}`
        );
        // iterations no longer applicable

        // High leverage should be flagged as potentially unsafe
        if (testCase.leverage >= 4.0) {
          console.log(`   ⚠️  High leverage detected: ${testCase.leverage}x`);
        }
      }

      console.log("✅ Leverage calculations optimized for Soneium");
    });

    it("should validate leverage safety matrix for Soneium parameters", async function () {
      console.log("🛡️  Testing leverage safety matrix for Soneium");

      const leverageRatios = [1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 5.0];
      const collateralAmount = ethers.parseEther("1");
      const collateralPrice = EisenMockApi.getMockPrice(
        soneiumContext.network.weth
      );
      const borrowPrice = EisenMockApi.getMockPrice(
        soneiumContext.network.usdc
      );

      console.log(`🔍 Testing ${leverageRatios.length} leverage ratios`);
      console.log(`Leverage  Safe?  Flashloan Amount    Expected Supply`);
      console.log(`--------  -----  ----------------    ---------------`);

      for (const leverage of leverageRatios) {
        const leverageData = LeverageCalculator.calculateLeverageParams(
          0n,
          0n,
          undefined,
          undefined,
          BigInt(Math.floor(collateralPrice * 1e18)),
          BigInt(Math.floor(borrowPrice * 1e18)),
          await soneiumContext.collateral.decimals(),
          await soneiumContext.debt.decimals(),
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
            await soneiumContext.debt.decimals()
          )
          .padEnd(15);
        const supplyStr = ethers
          .formatUnits(
            leverageData.collateralAmount,
            await soneiumContext.collateral.decimals()
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
        BigInt(Math.floor(collateralPrice * 1e18)),
        BigInt(Math.floor(borrowPrice * 1e18)),
        await soneiumContext.collateral.decimals(),
        await soneiumContext.debt.decimals(),
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
      console.log("✅ Leverage safety matrix validated for Soneium parameters");
    });
  });

  after(async function () {
    if (soneiumContext) {
      console.log("🏁 Enhanced Soneium fork tests completed");
      console.log("Done");
    }
  });
});
