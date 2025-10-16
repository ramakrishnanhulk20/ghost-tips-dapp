require("@nomicfoundation/hardhat-toolbox");
require("hardhat-deploy");
const { vars } = require("hardhat/config");

const MNEMONIC = vars.get("MNEMONIC", "test test test test test test test test test test test junk");
const ALCHEMY_API_KEY = vars.get("ALCHEMY_API_KEY", "");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: {
        enabled: true,
        runs: 1000,
      },
    },
  },
  networks: {
    hardhat: {
      chainId: 31337,
    },
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 31337,
    },
    sepolia: {
      url: `https://eth-sepolia.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
      chainId: 11155111,
      accounts: {
        mnemonic: MNEMONIC,
      },
      gasPrice: 20000000000,
    },
  },
  namedAccounts: {
    deployer: 0,
  },
};
