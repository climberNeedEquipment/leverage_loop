/**
 * @title Example: Enhanced Eisen Finance API Usage
 * @notice Demonstrates how to use the updated Eisen Finance API integration
 * @dev Based on the actual API structure from hiker.hetz-01.eisenfinance.com
 */

import { ethers } from "ethers";
import {
  EisenMockApi,
  EisenQuoteRequest,
  EisenQuoteResponse,
} from "./hh/utils/eisenMockApi";

async function demonstrateEisenApiUsage() {
  console.log("🚀 Demonstrating Enhanced Eisen Finance API Usage");

  // Example 1: Build a quote request using the actual API structure
  const userAddress = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045";
  const leverageLoopAddress = "0x1234567890123456789012345678901234567890";

  // Build quote request matching the curl example
  const quoteRequest: EisenQuoteRequest = EisenMockApi.buildQuoteRequest(
    userAddress, // fromAddress
    "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE", // fromToken (ETH)
    "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // toToken (USDC on Base)
    ethers.parseEther("1").toString(), // fromAmount (1 ETH)
    leverageLoopAddress, // toAddress
    8453, // Base chain ID
    {
      order: "CHEAPEST",
      integrator: "leverage-loop-dapp",
      fee: "0.01", // 1% fee
      slippage: "0.005", // 0.5% slippage
      referrer: "0xabcdef0123456789000000000000000000000000",
      includedDex: "WRAPPED_NATIVE,SushiswapV2,UniswapV2",
    }
  );

  console.log("📋 Built quote request:", {
    fromToken: quoteRequest.fromToken,
    toToken: quoteRequest.toToken,
    fromAmount: ethers.formatEther(quoteRequest.fromAmount) + " ETH",
    chain: quoteRequest.fromChain,
    slippage: quoteRequest.slippage,
  });

  // Example 2: Get quote with fallback to mock
  let quote: EisenQuoteResponse;

  try {
    // Try real API first (will use mock in test environment)
    quote = await EisenMockApi.getQuoteWithFallback(quoteRequest, false);
    console.log("✅ Got quote from real API");
  } catch (error) {
    console.log("⚠️  Real API failed, using mock");
    quote = await EisenMockApi.getQuoteWithFallback(quoteRequest, true);
  }

  // Example 3: Extract swap bytes (the key data we need)
  const swapBytes = EisenMockApi.extractSwapBytes(quote);
  console.log("🔄 Extracted swap bytes:", swapBytes.slice(0, 50) + "...");

  // Example 4: Validate response structure
  const isValid = EisenMockApi.validateQuoteResponse(quote);
  console.log("✅ Quote validation:", isValid ? "PASSED" : "FAILED");

  // Example 5: Display quote results
  console.log("📊 Quote Results:");
  console.log(`   🔄 Swap Data: ${swapBytes.slice(0, 20)}...`);
  console.log(
    `   💰 Estimated Output: ${ethers.formatUnits(
      quote.estimatedAmount || quote.result.route.toAmount,
      6
    )} USDC`
  );
  console.log(
    `   ⛽ Gas Estimate: ${
      quote.estimatedGas || quote.result.route.gasEstimate
    }`
  );
  console.log(
    `   💹 Price Impact: ${quote.priceImpact || quote.result.route.priceImpact}`
  );
  console.log(`   🏪 Protocols: ${quote.result.route.protocols.join(", ")}`);

  // Example 6: Use in leverage loop (simplified)
  console.log("\n🔗 Using in Leverage Loop:");

  const leverageParams = {
    aToken: "0x...", // aToken address
    variableDebtAsset: "0x...", // Variable debt token address
    collateralAsset: quoteRequest.fromToken,
    borrowAsset: quoteRequest.toToken,
    collateralAmount: quoteRequest.fromAmount,
    flashloanAmount: ethers.parseUnits("2000", 6).toString(), // 2000 USDC
    swapPathData: swapBytes, // Use response['result']['transactionRequest']['data']
  };

  console.log("⚡ Ready to execute leverage loop with params:");
  console.log(
    `   Collateral: ${ethers.formatEther(leverageParams.collateralAmount)} ETH`
  );
  console.log(
    `   Flashloan: ${ethers.formatUnits(
      leverageParams.flashloanAmount,
      6
    )} USDC`
  );
  console.log(
    `   Swap Data Length: ${leverageParams.swapPathData.length} characters`
  );

  // Example 7: Batch quotes for multiple amounts
  console.log("\n📋 Demonstrating Batch Quotes:");

  const amounts = ["500", "1000", "2000"]; // Different ETH amounts
  const batchRequests = amounts.map((amount) =>
    EisenMockApi.buildQuoteRequest(
      userAddress,
      "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
      "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      ethers.parseEther(amount).toString(),
      leverageLoopAddress,
      8453,
      { slippage: "0.005", order: "CHEAPEST" }
    )
  );

  const batchQuotes = await EisenMockApi.getBatchQuotes(batchRequests, true);

  console.log(`📊 Batch Results (${batchQuotes.length} quotes):`);
  batchQuotes.forEach((batchQuote, index) => {
    console.log(
      `   ${amounts[index]} ETH → ${ethers.formatUnits(
        batchQuote.estimatedAmount || batchQuote.result.route.toAmount,
        6
      )} USDC`
    );
  });

  // Example 8: Calculate total gas costs
  const totalGas = EisenMockApi.calculateTotalGasCost(batchQuotes, 20000000000); // 20 gwei
  console.log(`⛽ Total gas cost for batch: ${totalGas.toLocaleString()} wei`);

  console.log("\n🎉 Enhanced Eisen Finance API demonstration complete!");
}

// Example usage for different networks
async function demonstrateMultiNetworkUsage() {
  console.log("\n🌐 Multi-Network Usage Examples:");

  const networks = [
    {
      name: "Base",
      chainId: 8453,
      weth: "0x4200000000000000000000000000000000000006",
    },
    { name: "Soneium", chainId: 1946, weth: "0x..." },
    {
      name: "Ethereum",
      chainId: 1,
      weth: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
    },
  ];

  const userAddress = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045";
  const amount = ethers.parseEther("1").toString();

  for (const network of networks) {
    console.log(`\n🔗 Testing ${network.name} (Chain ID: ${network.chainId})`);

    const request = EisenMockApi.buildQuoteRequest(
      userAddress,
      network.weth,
      "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // USDC (placeholder)
      amount,
      userAddress,
      network.chainId
    );

    try {
      const quote = await EisenMockApi.getQuoteWithFallback(request, true);
      console.log(
        `   ✅ ${network.name}: ${ethers.formatEther(
          amount
        )} WETH → ${ethers.formatUnits(
          quote.estimatedAmount || quote.result.route.toAmount,
          6
        )} USDC`
      );
    } catch (error) {
      console.log(`   ❌ ${network.name}: Failed - ${error}`);
    }
  }
}

// Run the demonstration
if (require.main === module) {
  demonstrateEisenApiUsage()
    .then(() => demonstrateMultiNetworkUsage())
    .then(() => console.log("🏁 All demonstrations completed"))
    .catch(console.error);
}

export { demonstrateEisenApiUsage, demonstrateMultiNetworkUsage };
