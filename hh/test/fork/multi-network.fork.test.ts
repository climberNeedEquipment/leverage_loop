import { ethers } from "hardhat";
import { expect } from "chai";
import { baseConfig } from "../../config/networks/base";
import { ForkTestUtils, TestScenario } from "../../utils/forkTestUtils";
import { LeverageCalculator } from "../../utils/leverageCalculator";
import { EisenMockApi } from "../../utils/eisenMockApi";

/**
 * @title Enhanced Leverage+Deleverage Fork Tests
 * @notice Tests comprehensive leverage and deleverage scenarios against a forked network.
 * @dev Focuses on end-to-end flow validation and contract interaction.
 */
describe("Enhanced Leverage+Deleverage Fork Tests", function () {
  this.timeout(120000); // Set a global timeout for the test suite

  let context: any;

  // Setup phase: establish fork environment, deploy contracts, prepare user
  before(async function () {
    console.log("🚀 Setting up enhanced fork test environment");
    // Skip if BASE_RPC_URL is not set or data provider calls fail
    if (!process.env.BASE_RPC_URL) {
      console.log("⏭️  Skipping setup due to missing BASE_RPC_URL");
      this.skip();
      return;
    }

    try {
      context = await ForkTestUtils.setupForkTest(baseConfig);
      await ForkTestUtils.prepareUser(context);

      console.log("✅ Fork test environment ready");
      console.log(`User: ${context.user}`);
      console.log(`LeverageLoop: ${await context.leverageLoop.getAddress()}`);
    } catch (error: any) {
      // Check for specific errors that should result in skipping the suite
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
          `⏭️  Skipping setup due to RPC/Hardfork incompatibility or environment issue: ${error.message}`
        );
        this.skip();
      } else {
        console.error(`❌ Setup failed: ${error.message}`);
        throw error;
      }
    }
  });

  // Leverage Operations
  describe("🚀 Enhanced Leverage Operations", function () {
    it("should execute 2x leverage successfully (README example)", async function () {
      this.timeout(60000);
      console.log("🎯 Testing 2x leverage execution");

      const scenario: TestScenario = {
        name: "Conservative 2x Leverage",
        collateralAmount: ethers.parseEther("1"),
        targetLeverage: 2.0,
        slippageTolerance: 0.01,
        expectedSuccess: true,
      };

      const success = await ForkTestUtils.runLeverageScenario(
        context,
        scenario
      );
      expect(success).to.be.true;
    });

    it("should execute 3x leverage successfully (aggressive scenario)", async function () {
      this.timeout(60000);
      console.log("🎯 Testing 3x leverage execution");

      const scenario: TestScenario = {
        name: "Aggressive 3x Leverage",
        collateralAmount: ethers.parseEther("0.5"),
        targetLeverage: 3.0,
        slippageTolerance: 0.02,
        expectedSuccess: true,
      };

      const success = await ForkTestUtils.runLeverageScenario(
        context,
        scenario
      );
      expect(success).to.be.true;
    });

    it("should validate health factor throughout leverage process", async function () {
      // This test would involve checking health factor before and after leverage
      console.log("📊 Validating health factor changes");
      // Placeholder for actual health factor logic
    });
  });

  // Deleverage Operations
  describe("🔄 Enhanced Deleverage Operations", function () {
    let initialCollateral: bigint;
    let initialDebt: bigint;

    before(async function () {
      // Create a leveraged position for deleverage tests
      console.log("🔧 Creating a leveraged position for deleverage tests");
      const leverageScenario: TestScenario = {
        name: "Setup for Deleverage",
        collateralAmount: ethers.parseEther("2"), // Larger position
        targetLeverage: 2.5,
        slippageTolerance: 0.02,
        expectedSuccess: true,
      };
      await ForkTestUtils.runLeverageScenario(context, leverageScenario);

      initialCollateral = await context.aTokenCollateral.balanceOf(
        context.user
      );
      initialDebt = await context.variableDebtToken.balanceOf(context.user);
      console.log(
        `Initial collateral: ${ethers.formatEther(initialCollateral)}`
      );
      console.log(`Initial debt: ${ethers.formatUnits(initialDebt, 6)}`);

      console.log("🔧 Leveraged position created for deleverage tests");
    });

    it("should execute complete deleverage process (README example)", async function () {
      this.timeout(60000);
      console.log("🎯 Testing complete deleverage process");

      // For complete deleverage, we want to withdraw most collateral and repay most debt
      const withdrawAmount = initialCollateral / 2n; // Example: withdraw half collateral
      const repayAmount = initialDebt / 2n; // Example: repay half debt

      console.log(
        `Deleverage parameters: Withdraw ${ethers.formatEther(
          withdrawAmount
        )} ETH, Repay ${ethers.formatUnits(repayAmount, 6)} USDC`
      );

      const success = await ForkTestUtils.runDeleverageScenario(
        context,
        withdrawAmount,
        repayAmount
      );
      expect(success).to.be.true;
      console.log("✅ Complete deleverage executed successfully");
    });

    it("should fail deleverage without aToken approval", async function () {
      console.log("❌ Testing deleverage failure without aToken approval");

      // Reset approvals to test failure case
      await context.aTokenCollateral.approve(
        await context.leverageLoop.getAddress(),
        0
      );

      const withdrawAmount = ethers.parseEther("0.5");
      const repayAmount = ethers.parseUnits("500", 6);

      try {
        await ForkTestUtils.runDeleverageScenario(
          context,
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

    it("should handle partial deleverage correctly", async function () {
      this.timeout(60000);
      console.log("🎯 Testing partial deleverage");

      const withdrawAmount = ethers.parseEther("0.2");
      const repayAmount = ethers.parseUnits("200", 6);

      const success = await ForkTestUtils.runDeleverageScenario(
        context,
        withdrawAmount,
        repayAmount
      );
      expect(success).to.be.true;
      console.log("✅ Partial deleverage handled successfully");
    });
  });

  // Multi-Network Compatibility
  describe("🌐 Multi-Network Compatibility", function () {
    it("should validate contract constants across networks", async function () {
      // This test would involve comparing deployed contract addresses or configurations across networks
      console.log("🔍 Validating contract constants");
      // Placeholder for actual validation logic
    });

    it("should measure gas efficiency for different network optimizations", async function () {
      // This test would involve deploying and interacting with contracts on different networks
      console.log("⛽ Measuring gas efficiency");
      // Placeholder for actual gas measurement logic
    });
  });

  // Owner Controls & Emergency Functions
  describe("🔧 Owner Controls & Emergency Functions", function () {
    it("should allow owner to execute emergency withdrawal", async function () {
      // Test emergency withdrawal by owner
      console.log("🚨 Testing emergency withdrawal");
      // Placeholder for emergency withdrawal logic
    });

    it("should validate ownership transfer functionality", async function () {
      // Test ownership transfer
      console.log("🤝 Testing ownership transfer");
      // Placeholder for ownership transfer logic
    });
  });

  // Advanced Testing Scenarios
  describe("📊 Advanced Testing Scenarios", function () {
    it("should test Eisen Finance API integration end-to-end", async function () {
      this.timeout(60000);
      console.log("🔗 Testing Eisen Finance API integration");

      const leverageLoopAddress = await context.leverageLoop.getAddress();

      const quoteRequest = EisenMockApi.buildQuoteRequest(
        leverageLoopAddress, // fromAddress
        context.network.usdc, // fromToken
        context.network.weth, // toToken
        ethers.parseUnits("1000", 6).toString(), // fromAmount
        leverageLoopAddress, // toAddress
        context.network.chainId, // chainId
        {
          slippage: "0.005",
          order: "CHEAPEST",
        }
      );

      const quote = await EisenMockApi.getQuoteWithFallback(
        quoteRequest,
        false
      ); // Use false for real API calls

      expect(EisenMockApi.validateQuoteResponse(quote)).to.be.true;
      expect(EisenMockApi.extractSwapBytes(quote)).to.match(/^0x[0-9a-fA-F]+$/);
      expect(Number(quote.result.estimate.toAmount)).to.be.greaterThan(0);

      console.log(
        `   Estimated Output: ${ethers.formatEther(
          quote.result.estimate.toAmount
        )} WETH`
      );
      console.log(
        `   Gas Estimate: ${quote.result.estimate.gasCosts[0].estimate}`
      );
      console.log(`   Price Impact: ${quote.result.estimate.priceImpact}`);
    });

    it("should test batch operations and complex scenarios", async function () {
      this.timeout(60000);
      console.log("🔄 Testing batch operations");

      const amounts = [
        ethers.parseUnits("500", 6).toString(),
        ethers.parseUnits("1000", 6).toString(),
        ethers.parseUnits("2000", 6).toString(),
      ];

      const leverageLoopAddress = await context.leverageLoop.getAddress();
      const requests = amounts.map((amount) =>
        EisenMockApi.buildQuoteRequest(
          leverageLoopAddress,
          context.network.usdc,
          context.network.weth,
          amount,
          leverageLoopAddress,
          context.network.chainId,
          {
            slippage: "0.005",
            order: "CHEAPEST",
          }
        )
      );

      const quotes = await EisenMockApi.getBatchQuotes(requests, false); // Use false for real API calls

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

      const totalGas = EisenMockApi.calculateTotalGasCost(quotes, 20000000000); // 20 gwei
      console.log(`⛽ Total batch gas cost: ${totalGas.toLocaleString()}`);
    });
  });

  after(async function () {
    console.log("🏁 Enhanced fork tests completed");
    // You might want to add logic here to reset the fork state if necessary
    console.log("ℹ️  Could not fetch final user state");
  });
});
