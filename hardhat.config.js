require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

const SEPOLIA_RPC_URL = process.env.SEPOLIA_RPC_URL || "";
const MUMBAI_RPC_URL = process.env.MUMBAI_RPC_URL || "";
const PRIVATE_KEY = process.env.PRIVATE_KEY || "0x";

task(
  "register",
  "Registers a toke by taking a token's and a bridge's addresses"
)
  .addParam("token")
  .addParam("bridge")
  .setAction(async (taskArgs, hre) => {
    const tokenAddr = taskArgs["token"];
    const bridgeAddr = taskArgs["bridge"];

    const PermitToken = await ethers.getContractFactory("ERC20PermitToken");
    const permitToken = PermitToken.attach(tokenAddr);

    const Bridge = await ethers.getContractFactory("Bridge");
    const bridge = Bridge.attach(bridgeAddr);

    await bridge.registerToken(permitToken.target);
    console.log(`✅ Token(${permitToken.target}) successfully registered`);
  });

task("deploy", "Deploys a wrapper of an already registered token")
  .addParam("token")
  .addParam("bridge")
  .addParam("name")
  .addParam("symbol")
  .setAction(async (taskArgs, hre) => {
    // permitToken.target, wName, wSymbol;
    const tokenAddr = taskArgs["token"];
    const bridgeAddr = taskArgs["bridge"];
    const name = taskArgs["name"];
    const symbol = taskArgs["symbol"];

    const PermitToken = await ethers.getContractFactory("ERC20PermitToken");
    const permitToken = PermitToken.attach(tokenAddr);

    const Bridge = await ethers.getContractFactory("Bridge");
    const bridge = Bridge.attach(bridgeAddr);

    await bridge.deployWrappedToken(permitToken.target, name, symbol);
    const Wrapper = await ethers.getContractFactory("ERC20Token");
    const wrapper = Wrapper.attach(await bridge.createdWrappedTokens(0));
    console.log(
      `✅ Wrapper of Token(${permitToken.target}) successfully deployed to: ${
        wrapper.target
      } with name: ${await wrapper.name()} and symbol: ${await wrapper.symbol()}`
    );
  });

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.19",
  networks: {
    hardhat: {
      chainId: 31337,
    },
    localhost_sepolia: {
      chainId: 31337,
      url: "http://127.0.0.1:8545/",
    },
    localhost_mumbai: {
      chainId: 31337,
      url: "http://127.0.0.1:8546/",
    },
    sepolia: {
      chainId: 11155111,
      url: SEPOLIA_RPC_URL,
      accounts: PRIVATE_KEY !== undefined ? [PRIVATE_KEY] : [],
    },
    mumbai: {
      chainId: 80001,
      url: MUMBAI_RPC_URL,
      accounts: PRIVATE_KEY !== undefined ? [PRIVATE_KEY] : [],
    },
  },
};
