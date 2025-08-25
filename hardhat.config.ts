import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";
import {
  networkConfigs,
  baseConfig,
  soneiumConfig,
  ethereumConfig,
} from "./hh/config/networks";

dotenv.config();

const ALCHEMY_MAINNET_URL = process.env.ALCHEMY_MAINNET_URL || "";
const ETHEREUM_MAINNET_FORK_BLOCK = process.env.ETHEREUM_MAINNET_FORK_BLOCK
  ? parseInt(process.env.ETHEREUM_MAINNET_FORK_BLOCK)
  : undefined;
const FORK_NETWORK = process.env.FORK_NETWORK || ""; // e.g., "base", "soneium", "ethereum"

let forkingUrl: string | undefined;
let forkingBlockNumber: number | undefined;
let hardhatChainId: number | undefined;

if (FORK_NETWORK) {
  const config = networkConfigs[FORK_NETWORK.toLowerCase()];
  if (config) {
    forkingUrl = config.rpcUrl;
    forkingBlockNumber = config.blockNumber;
    hardhatChainId = config.chainId; // Align chainId with forked network (e.g., Kaia 8217)
  } else {
    console.warn(
      `Warning: FORK_NETWORK '${FORK_NETWORK}' not found in networkConfigs.`
    );
  }
} else if (ALCHEMY_MAINNET_URL) {
  // Fallback to ALCHEMY_MAINNET_URL if FORK_NETWORK is not set
  forkingUrl = ALCHEMY_MAINNET_URL;
  forkingBlockNumber = ETHEREUM_MAINNET_FORK_BLOCK;
}

const hardhatForkingConfig = forkingUrl
  ? {
      url: forkingUrl,
      blockNumber: forkingBlockNumber,
    }
  : undefined;

const config: HardhatUserConfig = {
  solidity: {
    compilers: [
      {
        version: "0.8.29",
        settings: {
          optimizer: { enabled: true, runs: 200 },
          viaIR: true,
        },
      },
      {
        version: "0.8.20",
        settings: {
          optimizer: { enabled: true, runs: 200 },
        },
      },
      {
        version: "0.8.13",
        settings: {
          optimizer: { enabled: true, runs: 200 },
        },
      },
    ],
  },
  paths: {
    sources: "src",
    tests: "hh/test",
  },
  networks: {
    hardhat: {
      chainId: 1,
      hardfork: "shanghai",
      forking: hardhatForkingConfig,
    },
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 8217,
    },
  },
  mocha: { timeout: 120000 },
};

export default config;
