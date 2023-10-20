const { ethers } = require("hardhat");
const Bridge = require("../artifacts/contracts/Bridge.sol/Bridge.json");
require("dotenv").config();

const BRIDGE_MUMBAI = process.env.BRIDGE_MUMBAI || "0x";

async function filter(deployer) {
  const mumbaiForkProvider = new ethers.JsonRpcProvider(
    "http://127.0.0.1:8546/"
  );

  const bridgeMumbai = new ethers.Contract(
    BRIDGE_MUMBAI,
    Bridge.abi,
    mumbaiForkProvider
  );

  const filterAddressTo = bridgeMumbai.filters.DeployToken(deployer);
  const events = await bridgeMumbai.queryFilter(filterAddressTo, 0, "latest");

  return events;
}

module.exports = { filter };
