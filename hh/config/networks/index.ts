export { NetworkConfig } from "./base";
export { baseConfig } from "./base";
export { soneiumConfig } from "./soneium";
export { ethereumConfig } from "./ethereum";
export { kaiaConfig } from "./kaia";

import { NetworkConfig } from "./base";
import { baseConfig } from "./base";
import { soneiumConfig } from "./soneium";
import { ethereumConfig } from "./ethereum";
import { kaiaConfig } from "./kaia";

export const networkConfigs: Record<string, NetworkConfig> = {
  base: baseConfig,
  soneium: soneiumConfig,
  ethereum: ethereumConfig,
  kaia: kaiaConfig,
};

export function getNetworkConfig(networkName: string): NetworkConfig {
  const config = networkConfigs[networkName.toLowerCase()];
  if (!config) {
    throw new Error(`Network configuration not found for: ${networkName}`);
  }
  return config;
}

export const supportedNetworks = Object.keys(networkConfigs);
