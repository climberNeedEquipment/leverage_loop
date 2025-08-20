export interface NetworkConfig {
  name: string;
  chainId: number;
  rpcUrl: string;
  aavePool: string;
  protocolDataProvider: string;
  weth: string;
  usdc: string;
  blockNumber?: number;
  eisenRouter?: string;
  flashloanPremium?: bigint; // Flashloan premium in WAD (1e18)
}

export const baseConfig: NetworkConfig = {
  name: "Base",
  chainId: 8453,
  rpcUrl: process.env.BASE_RPC_URL || "https://mainnet.base.org",
  aavePool: "0xA238Dd80C259a72e81d7e4664a9801593F98d1c5", // Aave V3 Pool on Base
  protocolDataProvider: "0x2d8A3C5677189723C4cB8873CfC9C8976FDF38Ac", // Aave V3 Protocol Data Provider on Base
  weth: "0x4200000000000000000000000000000000000006", // WETH on Base
  usdc: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // USDC on Base
  eisenRouter: "0x14C3B68e5855B60263b10eC0fCE54DE3e28AD880", // To be updated with actual Eisen router
  flashloanPremium: 900000000000000n, // 0.09% or 9 bps = 0.0009 * 1e18
};
