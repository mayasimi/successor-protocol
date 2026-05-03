require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config({ path: "../.env" });

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    compilers: [
      {
        version: "0.8.19",
        settings: { optimizer: { enabled: true, runs: 200 } },
      },
    ],
  },
  networks: {
    // Local Hardhat network (default for tests)
    hardhat: {},

    // 0G Chain testnet
    "0g-testnet": {
      url: "https://rpc.0g.ai",
      chainId: 16600,
      accounts: process.env.DEPLOYER_PRIVATE_KEY
        ? [process.env.DEPLOYER_PRIVATE_KEY]
        : [],
    },
  },
  paths: {
    // Only compile .sol files in the contracts root (not node_modules).
    // Hardhat automatically excludes node_modules when sources points here.
    sources:   "./src",
    tests:     "./test",
    cache:     "./cache",
    artifacts: "./artifacts",
  },
  mocha: {
    timeout: 60000,
  },
};
