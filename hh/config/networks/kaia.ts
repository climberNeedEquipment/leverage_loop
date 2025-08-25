import { NetworkConfig } from "./base";

export const kaiaConfig: NetworkConfig = {
  name: "Kaia",
  chainId: 8217, // Kaia Mainnet chain ID (replace with actual if different)
  rpcUrl: process.env.KAIA_RPC_URL || "https://rpc.ankr.com/kaia",
  aavePool: "0xcf1af042f2a071df60a64ed4bdc9c7dee40780be",
  protocolDataProvider: "0xddd3d480521bc027596e078bcd1b838d50daa076",
  weth: "0x19aac5f612f524b754ca7e7c41cbfa2e981a4432",
  usdc: "0xd077a400968890eacc75cdc901f0356c943e4fdb",
  eisenRouter: "0xf2a8D8B2ED0cEc37b01dF2ba33aE87f317CffB1D",
  flashloanPremium: 500000000000000n, // 0.05% or 5 bps = 0.0005 * 1e18
};
