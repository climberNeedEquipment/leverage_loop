import { NetworkConfig } from "./base";

export const ethereumConfig: NetworkConfig = {
  name: "Ethereum Mainnet",
  chainId: 1,
  rpcUrl:
    process.env.ETHEREUM_RPC_URL ||
    "https://mainnet.infura.io/v3/YOUR_INFURA_KEY",
  aavePool: "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2", // Aave V3 Pool
  protocolDataProvider: "0x7B4EB56E7CD4b454BA8ff71E4518426369a138a3", // Aave V3 Protocol Data Provider
  weth: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // WETH
  usdc: "0xA0b86a33E6441214e4b1dA6e1aF99f3e55C0E797", // USDC
};
