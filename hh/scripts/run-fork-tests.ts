import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

interface TestConfig {
  network: string;
  rpcUrl?: string;
  blockNumber?: number;
  testFiles: string[];
}

const TEST_CONFIGS: TestConfig[] = [
  {
    network: "base",
    rpcUrl: process.env.BASE_RPC_URL || "https://mainnet.base.org",
    testFiles: ["hh/test/fork/multi-network.fork.test.ts"],
  },
  {
    network: "soneium",
    rpcUrl: process.env.SONEIUM_RPC_URL || "https://rpc.soneium.org",
    testFiles: [
      "hh/test/fork/soneium.fork.test.ts",
      "hh/test/fork/multi-network.fork.test.ts",
    ],
  },
];

async function runForkTest(config: TestConfig): Promise<void> {
  console.log(`🚀 Running fork tests for ${config.network.toUpperCase()}`);

  if (!config.rpcUrl) {
    console.log(`⏭️  Skipping ${config.network} - no RPC URL provided`);
    return;
  }

  for (const testFile of config.testFiles) {
    try {
      console.log(`📋 Running test file: ${testFile}`);

      const command = [
        "npx hardhat test",
        testFile,
        `--network hardhat`,
        config.rpcUrl ? `--fork ${config.rpcUrl}` : "",
        config.blockNumber ? `--fork-block-number ${config.blockNumber}` : "",
      ]
        .filter(Boolean)
        .join(" ");

      const env = {
        ...process.env,
        TEST_NETWORKS: config.network,
        USE_MOCK_EISEN_API: "false", // Use mock for testing
      };

      const { stdout, stderr } = await execAsync(command, { env });

      if (stdout) console.log(stdout);
      if (stderr) console.error(stderr);

      console.log(`✅ Completed ${testFile} for ${config.network}`);
    } catch (error: any) {
      console.error(
        `❌ Failed ${testFile} for ${config.network}:`,
        error.message
      );
    }
  }
}

async function runAllTests(): Promise<void> {
  console.log(`🌐 Starting multi-network fork tests`);
  console.log(`📝 Test configurations:`);

  TEST_CONFIGS.forEach((config) => {
    console.log(
      `   ${config.network}: ${config.rpcUrl ? "✅" : "❌"} (${
        config.testFiles.length
      } files)`
    );
  });

  // Run tests for each network
  for (const config of TEST_CONFIGS) {
    await runForkTest(config);
    console.log(`\n${"=".repeat(60)}\n`);
  }

  console.log(`🏁 All fork tests completed!`);
}

// Run if called directly
if (require.main === module) {
  runAllTests().catch(console.error);
}

export { runAllTests, runForkTest, TEST_CONFIGS };
