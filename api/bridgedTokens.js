const { ethers } = require("hardhat");
const Bridge = require("../artifacts/contracts/Bridge.sol/Bridge.json");
require("dotenv").config();

const BRIDGE_SEPOLIA = process.env.BRIDGE_SEPOLIA || "0x";

async function getBridgedTokens() {
  const sepoliaForkProvider = new ethers.JsonRpcProvider(
    "http://127.0.0.1:8545/"
  );

  const bridgeSepolia = new ethers.Contract(
    BRIDGE_SEPOLIA,
    Bridge.abi,
    sepoliaForkProvider
  );

  const events = await bridgeSepolia.queryFilter("DeployToken", 0, "latest");

  return events;
}

module.exports = { getBridgedTokens };
