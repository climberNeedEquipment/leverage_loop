import { ethers } from "ethers";

// Eisen Finance API v1/quote request interface (based on actual API)
export interface EisenQuoteRequest {
  fromAddress: string; // Sender address
  fromChain: number; // Source chain ID (e.g., 8453 for Base)
  toChain: number; // Destination chain ID
  fromToken: string; // Token address to swap from (0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE for ETH)
  toToken: string; // Token address to swap to
  fromAmount: string; // Amount in wei as string
  toAddress: string; // Recipient address
  order?: string; // Order preference (e.g., "CHEAPEST")
  integrator?: string; // Integrator identifier
  fee?: string; // Fee percentage (e.g., "0.01" for 1%)
  slippage?: string; // Slippage tolerance (e.g., "0.005" for 0.5%)
  referrer?: string; // Referrer address
  includedDex?: string; // Comma-separated list of allowed DEXs
}

// Eisen Finance API v1/quote response interface (based on actual API structure)
export interface EisenQuoteResponse {
  result: {
    transactionRequest: {
      data: string; // This is the swapBytes we need for execution
      to: string; // Contract address to call
      value: string; // ETH value to send
      gasLimit: string; // Gas limit
      gasPrice?: string; // Gas price
    };
    estimate: {
      tool: string;
      approvalAddress: string;
      toAmountMin: string;
      toAmount: string; // The estimated output amount
      fromAmount: string;
      gasCosts: Array<{
        // Array of gas costs, typically one for the main transaction
        type: string;
        price: string;
        estimate: string; // Gas estimate for this specific cost
        limit: string;
        amount: string;
        amountUSD: string;
        token: {
          address: string;
          chainId: number;
          symbol: string;
          decimals: number;
          name: string;
          coinKey: string;
          logoURI: string;
          priceUSD: string;
        };
      }>;
      executionDuration: number;
      fromAmountUSD: string;
      toAmountUSD: string;
      priceImpact: string; // Price impact percentage
    };
    fee?: {
      amount: string;
      token: string;
    };
  };
}

/**
 * Enhanced Eisen Finance API Mock
 * Based on actual Eisen Finance API structure from hiker.hetz-01.eisenfinance.com
 * Implements real v1/quote endpoint with proper response structure
 */
export class EisenMockApi {
  private static readonly API_BASE_URL =
    "https://hiker.hetz-01.eisenfinance.com/public";
  private static readonly API_KEY =
    process.env.EISEN_API_KEY ||
    "ZWlzZW5fYmE3MGU5N2ItMDAxMy00NDE5LWJjN2MtZmU2NWIwMjFjMGVm";
  // 200 rpm

  // Chain ID mappings for multi-network support
  private static readonly CHAIN_IDS: Record<string, number> = {
    base: 8453,
    soneium: 1868,
    ethereum: 1,
    mainnet: 1,
  };

  // Mock price data for testing (in USD)
  private static readonly MOCK_PRICES: Map<string, number> = new Map([
    ["0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE".toLowerCase(), 3500], // ETH native
    ["0x4200000000000000000000000000000000000006".toLowerCase(), 3500], // WETH (Base)
    ["0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913".toLowerCase(), 1], // USDC (Base)
    ["0xA0b86a33E6441214e4b1dA6e1aF99f3e55C0E797".toLowerCase(), 1], // USDC (Soneium)
    ["0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2".toLowerCase(), 3500], // WETH (Ethereum)
    ["0x6B175474E89094C44Da98b954EedeAC495271d0F".toLowerCase(), 1], // DAI (Ethereum)
  ]);

  // This map can be used to set dynamic mock prices for tests.
  private static prices: Map<string, number> = new Map();

  public static setMockPrices(pricesMap: Map<string, number>): void {
    // Ensure all incoming keys are lowercased for consistency
    EisenMockApi.prices = new Map(
      Array.from(pricesMap.entries()).map(([key, value]) => [
        key.toLowerCase(),
        value,
      ])
    );
  }

  /**
   * Get quote from actual Eisen Finance API
   * Based on the curl example: hiker.hetz-01.eisenfinance.com/public/v1/quote
   */
  static async getQuote(
    request: EisenQuoteRequest
  ): Promise<EisenQuoteResponse> {
    const url = new URL(`${this.API_BASE_URL}/v1/quote`);

    // Add query parameters based on the curl example
    url.searchParams.set("fromAddress", request.fromAddress);
    url.searchParams.set("fromChain", request.fromChain.toString());
    url.searchParams.set("toChain", request.toChain.toString());
    url.searchParams.set("fromToken", request.fromToken);
    url.searchParams.set("toToken", request.toToken);
    url.searchParams.set("fromAmount", request.fromAmount);
    url.searchParams.set("toAddress", request.toAddress);

    if (request.order) url.searchParams.set("order", request.order);
    if (request.integrator)
      url.searchParams.set("integrator", request.integrator);
    if (request.fee) url.searchParams.set("fee", request.fee);
    if (request.slippage) url.searchParams.set("slippage", request.slippage);
    if (request.referrer) url.searchParams.set("referrer", request.referrer);
    if (request.includedDex)
      url.searchParams.set("includedDex", request.includedDex);

    try {
      console.log(request);
      const response = await fetch(url.toString(), {
        method: "GET",
        headers: {
          "X-EISEN-KEY": this.API_KEY,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(
          `Eisen API error: ${response.status} ${response.statusText}`
        );
      }

      const data = await response.json();

      // Ensure we have the correct structure and extract swapBytes from result.transactionRequest.data
      // Nothing else to attach; tests should use result.* fields only

      return data;
    } catch (error) {
      console.error("Failed to fetch quote from Eisen API:", error);
      throw error;
    }
  }

  /**
   * Enhanced mock implementation that matches actual API response structure
   * Generates response['result']['transactionRequest']['data'] for swapBytes
   */
  static async getMockQuote(
    request: EisenQuoteRequest
  ): Promise<EisenQuoteResponse> {
    // Simulate API processing delay
    await new Promise((resolve) => setTimeout(resolve, 100));

    const amountIn = BigInt(request.fromAmount);
    const priceIn = this.getMockPrice(request.fromToken);
    const priceOut = this.getMockPrice(request.toToken);
    const slippage = parseFloat(request.slippage || "0.005"); // Default 0.5% slippage

    // Calculate estimated output amount
    const baseOutput =
      (amountIn * BigInt(Math.floor(priceIn * 1000))) /
      BigInt(Math.floor(priceOut * 1000));
    const slippageAmount =
      (baseOutput * BigInt(Math.floor(slippage * 10000))) / BigInt(10000);
    const estimatedAmount = baseOutput - slippageAmount;

    // Generate swap bytes using the appropriate method
    const swapBytes = this.buildSwapBytesFromQuote(request, estimatedAmount);

    // Calculate price impact (mock)
    const priceImpact = (
      (Number(slippageAmount) / Number(baseOutput)) *
      100
    ).toFixed(4);

    // Return response that matches actual Eisen API structure
    const gasEstimate = "200000"; // Mock gas estimate

    return {
      result: {
        transactionRequest: {
          data: swapBytes,
          to: request.toAddress,
          value:
            request.fromToken === "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE"
              ? request.fromAmount
              : "0",
          gasLimit: gasEstimate,
          gasPrice: "20000000000",
        },
        estimate: {
          tool: "Eisen Aggregator",
          approvalAddress: "0xmockApprovalAddress", // Mock value
          toAmountMin: (estimatedAmount - slippageAmount).toString(), // Mock value
          toAmount: estimatedAmount.toString(),
          fromAmount: request.fromAmount,
          gasCosts: [
            {
              type: "SEND",
              price: "6577551", // Mock value
              estimate: gasEstimate, // Use mock gasEstimate
              limit: "566558", // Mock value
              amount: "1863282069729", // Mock value
              amountUSD: "0.00479172142546425", // Mock value
              token: {
                address: request.fromToken,
                chainId: request.fromChain,
                symbol: "ETH", // Mock symbol
                decimals: 18, // Mock decimals
                name: "Ethereum", // Mock name
                coinKey: "ETH", // Mock coinKey
                logoURI: "", // Mock logoURI
                priceUSD: "2571.65", // Mock priceUSD
              },
            },
          ],
          executionDuration: 0,
          fromAmountUSD: "", // Can be derived if needed
          toAmountUSD: "", // Can be derived if needed
          priceImpact: priceImpact + "%",
        },
        fee: request.fee
          ? {
              amount: (
                (BigInt(request.fromAmount) *
                  BigInt(Math.floor(parseFloat(request.fee) * 10000))) /
                BigInt(10000)
              ).toString(),
              token: request.fromToken,
            }
          : undefined,
      },
    } as EisenQuoteResponse;
  }

  // Helpers used by tests
  static buildSwapBytesFromQuote(
    request: EisenQuoteRequest,
    estimatedAmount: bigint
  ): string {
    // Encode the actual swap parameters into bytes for the mock router.
    // The mock router expects (address tokenIn, address tokenOut, uint256 amountIn)
    const encodedData = new ethers.AbiCoder().encode(
      ["address", "address", "uint256"],
      [request.fromToken, request.toToken, BigInt(request.fromAmount)]
    );
    return encodedData;
  }

  static generateMockRoute(
    fromToken: string,
    toToken: string,
    fromAmount: string,
    toAmount: string
  ) {
    return {
      fromToken,
      toToken,
      fromAmount,
      toAmount,
      protocols: ["UniswapV2"],
      priceImpact: "0.10%",
      gasEstimate: "200000",
    };
  }

  static validateQuoteResponse(resp: EisenQuoteResponse): boolean {
    return !!(
      resp &&
      resp.result &&
      resp.result.transactionRequest &&
      typeof resp.result.transactionRequest.data === "string" &&
      resp.result.estimate &&
      typeof resp.result.estimate.toAmount === "string"
    );
  }

  static extractSwapBytes(resp: EisenQuoteResponse): string {
    return resp.result.transactionRequest.data;
  }

  static calculateTotalGasCost(
    quotes: EisenQuoteResponse[],
    gasPriceWei: number
  ): number {
    const totalGas = quotes.reduce((sum, q) => {
      const g = parseInt(q.result.estimate.gasCosts[0]?.estimate || "0");
      return sum + (isNaN(g) ? 0 : g);
    }, 0);
    return totalGas * gasPriceWei;
  }

  /**
   * Build an EisenQuoteRequest with proper format for the API
   * Based on the curl example structure
   */
  static buildQuoteRequest(
    fromAddress: string,
    fromToken: string, // Use 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE for ETH
    toToken: string,
    fromAmount: string, // Amount in wei
    toAddress: string,
    chainId: number = 8453, // Default to Base
    options: {
      order?: string; // "CHEAPEST"
      integrator?: string; // "my-dapp"
      fee?: string; // "0.01" for 1%
      slippage?: string; // "0.005" for 0.5%
      referrer?: string;
      includedDex?: string; // "WRAPPED_NATIVE,SushiswapV2,UniswapV2"
    } = {}
  ): EisenQuoteRequest {
    return {
      fromAddress,
      fromChain: chainId,
      toChain: chainId, // Same chain swap
      fromToken,
      toToken,
      fromAmount,
      toAddress,
      order: options.order || "CHEAPEST",
      integrator: options.integrator || "leverage-loop",
      fee: options.fee || "0",
      slippage: options.slippage || "0.005",
      referrer: options.referrer,
    };
  }

  /**
   * Get quote with fallback to mock (updated for new API structure)
   * Tries real API first, falls back to mock if it fails
   */
  static async getQuoteWithFallback(
    request: EisenQuoteRequest,
    useMock: boolean = false
  ): Promise<EisenQuoteResponse> {
    if (useMock || process.env.NODE_ENV === "test") {
      return this.getMockQuote(request);
    }

    try {
      return await this.getQuote(request);
    } catch (error) {
      console.warn(
        "Failed to get quote from Eisen API, falling back to mock:",
        error
      );
      return this.getMockQuote(request);
    }
  }

  /**
   * Build swap data for leverage operations (updated method)
   */
  static async buildLeverageSwapDataFromQuote(
    fromToken: string,
    toToken: string,
    fromAmount: string,
    slippage: number,
    recipient: string,
    useMock: boolean = false,
    chainId: number = 8453
  ): Promise<string> {
    const request = this.buildQuoteRequest(
      recipient, // fromAddress
      fromToken,
      toToken,
      fromAmount,
      recipient, // toAddress
      chainId,
      {
        slippage: slippage.toString(),
        order: "CHEAPEST",
      }
    );

    const response = await this.getQuoteWithFallback(request, useMock);
    return response.result.transactionRequest.data;
  }

  /**
   * Get mock price for a token (used for testing)
   */
  static getMockPrice(tokenAddress: string): number {
    // Check dynamic prices first
    const dynamicPrice = EisenMockApi.prices.get(tokenAddress.toLowerCase());
    if (dynamicPrice !== undefined) {
      return dynamicPrice;
    }

    // Fallback to static mock prices
    const staticPrice = EisenMockApi.MOCK_PRICES.get(tokenAddress.toLowerCase());
    if (staticPrice !== undefined) {
      return staticPrice;
    }

    console.warn(
      `[EisenMockApi] No specific mock price found for ${tokenAddress}. Returning default 3500.`
    );
    return 3500; // Default price (e.g., for unknown tokens)
  }

  /**
   * Get leverage quote using updated API structure
   */
  static async getLeverageQuote(
    fromToken: string,
    toToken: string,
    fromAmount: string,
    slippage: number,
    recipient: string,
    useMock: boolean = false,
    chainId: number = 8453
  ): Promise<EisenQuoteResponse> {
    const request = this.buildQuoteRequest(
      recipient,
      fromToken,
      toToken,
      fromAmount,
      recipient,
      chainId,
      {
        slippage: slippage.toString(),
        order: "CHEAPEST",
      }
    );

    return this.getQuoteWithFallback(request, useMock);
  }

  /**
   * Get batch quotes for multiple requests
   */
  static async getBatchQuotes(
    requests: EisenQuoteRequest[],
    useMock: boolean = false
  ): Promise<EisenQuoteResponse[]> {
    const promises = requests.map((request) =>
      this.getQuoteWithFallback(request, useMock)
    );
    return Promise.all(promises);
  }
}
