# LeverageLoop Multi-Network Fork Tests

This directory contains comprehensive fork tests for the LeverageLoop contract across multiple networks, with integrated support for Eisen Finance API and advanced leverage calculations.

## 🏗️ Structure

```
hh/
├── config/
│   └── networks/           # Network-specific configurations
│       ├── base.ts         # Base network config
│       ├── soneium.ts      # Soneium network config
│       ├── ethereum.ts     # Ethereum network config
│       └── index.ts        # Network registry
├── utils/
│   ├── leverageCalculator.ts  # Leverage parameter calculations
│   ├── eisenMockApi.ts       # Eisen Finance API mock/integration
│   └── forkTestUtils.ts      # Fork test utilities
├── test/
│   ├── fork/
│   │   ├── soneium.fork.test.ts      # Soneium-specific tests
│   │   └── multi-network.fork.test.ts # Cross-network tests
│   └── leverage.deleverage.fork.ts   # Original fork tests
├── scripts/
│   └── run-fork-tests.ts    # Test runner script
└── README.md
```

## 🚀 Quick Start

### Prerequisites

1. **RPC URLs**: Set environment variables for the networks you want to test:

   ```bash
   export BASE_RPC_URL="https://mainnet.base.org"
   export SONEIUM_RPC_URL="https://rpc.soneium.org"
   export ETHEREUM_RPC_URL="https://eth.llamarpc.com"
   ```

2. **Test Configuration**:
   ```bash
   export TEST_NETWORKS="base,soneium"  # Comma-separated list
   export USE_MOCK_EISEN_API="true"     # Use mock API for testing
   ```

### Running Tests

#### Single Network Tests

```bash
# Run Soneium-specific tests
npx hardhat test hh/test/fork/soneium.fork.test.ts --network hardhat

# Run with specific fork
npx hardhat test hh/test/fork/soneium.fork.test.ts --network hardhat --fork $SONEIUM_RPC_URL --fork-block-number 1000000
```

#### Multi-Network Tests

```bash
# Run cross-network comparison tests
TEST_NETWORKS="base,soneium" npx hardhat test hh/test/fork/multi-network.fork.test.ts

# Run all tests using the script
npx ts-node hh/scripts/run-fork-tests.ts
```

#### Original Tests

```bash
# Run original leverage/deleverage tests
npx hardhat test hh/test/leverage.deleverage.fork.ts
```

## 🔧 Configuration

### Network Configuration

Each network has its own configuration file in `hh/config/networks/`. Example:

```typescript
// hh/config/networks/soneium.ts
export const soneiumConfig: NetworkConfig = {
  name: "Soneium",
  chainId: 1946,
  rpcUrl: process.env.SONEIUM_RPC_URL || "https://rpc.soneium.org",
  aavePool: "0x...", // Aave V3 Pool address
  protocolDataProvider: "0x...", // Protocol Data Provider
  weth: "0x...", // WETH token address
  usdc: "0x...", // USDC token address
  blockNumber: 1000000, // Fork block number
  eisenRouter: "0x...", // Eisen router address
};
```

### Test Scenarios

The test suite includes various leverage scenarios:

```typescript
const testScenarios = [
  {
    name: "Conservative 2x Leverage",
    collateralAmount: ethers.parseEther("1"),
    targetLeverage: 2.0,
    slippageTolerance: 0.01,
    expectedSuccess: true,
  },
  {
    name: "Aggressive 4x Leverage",
    collateralAmount: ethers.parseEther("1"),
    targetLeverage: 4.0,
    slippageTolerance: 0.03,
    expectedSuccess: true,
  },
  // ... more scenarios
];
```

## 🎯 Features

### 1. Eisen Finance API Integration

The `eisenMockApi.ts` utility provides both mock and real API integration:

```typescript
// Get a quote from Eisen Finance API
const quote = await EisenMockApi.getLeverageQuote(
  fromToken,
  toToken,
  amount,
  slippageTolerance,
  recipient,
  useMock // true for testing, false for production
);

// Build swap data for leverage operations
const swapData = await EisenMockApi.buildLeverageSwapDataFromQuote(
  fromToken,
  toToken,
  amount,
  slippageTolerance,
  recipient
);
```

### 2. Leverage Calculations

Advanced leverage parameter calculations:

```typescript
// Calculate optimal leverage parameters
const leverageData = LeverageCalculator.calculateLeverageParams(
  collateralAmount,
  targetLeverage,
  collateralPrice,
  borrowPrice
);

// Validate safety
const isValid = LeverageCalculator.validateLeverageParams(
  leverageData,
  collateralAmount,
  targetLeverage
);
```

### 3. Multi-Network Testing

Cross-network comparisons and validations:

- Gas cost comparisons
- Swap quote consistency
- Leverage safety matrix
- Batch operations

## 📊 Test Types

### 1. **Soneium Fork Tests** (`soneium.fork.test.ts`)

- Soneium-specific leverage operations
- Network parameter validation
- Gas optimization tests
- Token interaction tests

### 2. **Multi-Network Tests** (`multi-network.fork.test.ts`)

- Cross-network leverage comparisons
- Gas cost analysis
- Swap quote consistency
- Safety parameter validation
- Batch operations

### 3. **Original Fork Tests** (`leverage.deleverage.fork.ts`)

- Basic leverage/deleverage functionality
- Error handling
- Owner functions

## 🛠️ API Reference

### EisenMockApi

```typescript
// Main quote function (matches Eisen Finance v1/quote)
static async getMockQuote(request: EisenQuoteRequest): Promise<EisenQuoteResponse>

// Real API integration (for production)
static async getQuote(request: EisenQuoteRequest): Promise<EisenQuoteResponse>

// Automatic fallback (real API first, then mock)
static async getQuoteWithFallback(request: EisenQuoteRequest, useMock?: boolean): Promise<EisenQuoteResponse>

// Convenience functions
static async buildLeverageSwapDataFromQuote(...): Promise<string>
static async getLeverageQuote(...): Promise<EisenQuoteResponse>
static async getBatchQuotes(requests: EisenQuoteRequest[]): Promise<EisenQuoteResponse[]>
```

### LeverageCalculator

```typescript
// Calculate leverage parameters
static calculateLeverageParams(collateralAmount, targetLeverage, collateralPrice, borrowPrice): CalculatedLeverageData

// Calculate deleverage parameters
static calculateDeleverageParams(currentCollateral, currentDebt, targetReduction, collateralPrice, borrowPrice): CalculatedLeverageData

// Safety validation
static validateLeverageParams(leverageParams, collateralAmount, targetLeverage): boolean

// Slippage calculations
static calculateMinAmountOut(amountIn, inputPrice, outputPrice, slippageTolerance): bigint
```

### ForkTestUtils

```typescript
// Setup fork test environment
static async setupForkTest(networkConfig: NetworkConfig): Promise<ForkTestContext>

// Prepare user for testing
static async prepareUser(context: ForkTestContext): Promise<void>

// Run test scenarios
static async runLeverageScenario(context: ForkTestContext, scenario: TestScenario): Promise<boolean>
static async runDeleverageScenario(context: ForkTestContext, withdrawAmount: bigint, repayAmount: bigint): Promise<boolean>

// Get predefined scenarios
static getTestScenarios(): TestScenario[]
```

## 🔍 Environment Variables

```bash
# Network RPC URLs
BASE_RPC_URL="https://mainnet.base.org"
SONEIUM_RPC_URL="https://rpc.soneium.org"
ETHEREUM_RPC_URL="https://eth.llamarpc.com"

# Test Configuration
TEST_NETWORKS="base,soneium,ethereum"  # Networks to test
USE_MOCK_EISEN_API="true"             # Use mock API for testing

# Aave Protocol Addresses (if different from defaults)
AAVE_POOL="0x..."
AAVE_DATA_PROVIDER="0x..."

# Token Addresses (if different from defaults)
COLLATERAL_ASSET="0x..."  # WETH address
BORROW_ASSET="0x..."      # USDC address
```

## 🚨 Important Notes

1. **RPC Rate Limits**: Be mindful of RPC provider rate limits when running extensive tests
2. **Fork Block Numbers**: Use recent block numbers for accurate testing
3. **Gas Costs**: Actual gas costs may vary significantly from estimates
4. **Slippage**: Real market conditions may require higher slippage tolerances
5. **API Keys**: Some RPC providers require API keys for higher rate limits

## 🤝 Contributing

When adding new networks or test scenarios:

1. Create network config in `hh/config/networks/`
2. Add network to supported list in `index.ts`
3. Update test scripts and documentation
4. Ensure proper error handling for network failures

## 📈 Example Output

```
🌐 Setting up multi-network tests for: base, soneium
🔧 Using Mock Eisen API
🔗 Setting up Base (Chain ID: 8453)
✅ Base setup complete
🔗 Setting up Soneium (Chain ID: 1946)
✅ Soneium setup complete
🎯 Successfully set up 2 networks: base, soneium

⛽ Gas Comparison Across Networks:
   base: 245,123 gas
   soneium: 198,756 gas

📈 Swap Quote Comparison (1000 USDC → WETH):
   base:
     Output: 0.485234 WETH
     Gas: 150000
     Impact: 0.12%
     Routes: 1
   soneium:
     Output: 0.487123 WETH
     Gas: 145000
     Impact: 0.08%
     Routes: 1

🛡️ Leverage Safety Matrix:
Network\Leverage  1.5x  2.0x  3.0x  4.0x  5.0x
base         ✅   ✅   ✅   ✅   ❌
soneium      ✅   ✅   ✅   ✅   ❌

🏁 All fork tests completed!
```

This comprehensive test suite ensures robust validation of the LeverageLoop contract across multiple networks with real-world swap data and safety validations! 🎉
