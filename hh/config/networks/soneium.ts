import { NetworkConfig } from "./base";

export const soneiumConfig: NetworkConfig = {
  name: "Soneium",
  chainId: 1868, // Soneium Mainnet chain ID
  rpcUrl: process.env.SONEIUM_RPC_URL || "https://rpc.soneium.org",
  aavePool: "0x3C3987A310ee13F7B8cBBe21D97D4436ba5E4B5f",
  protocolDataProvider: "0x2BECa16DAa6Decf9C6F85eBA8F0B35696A3200b3",
  weth: "0x4200000000000000000000000000000000000006",
  usdc: "0xba9986d2381edf1da03b0b9c1f8b00dc4aacc369",
  eisenRouter: "0x43d2B5A2D0fb68c9CcE455bB5dA770542F655Cf7",
};
