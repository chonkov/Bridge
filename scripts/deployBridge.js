const { ethers } = require("hardhat");

console.log("______________________________");

async function main() {
  const bridge = await ethers.deployContract("Bridge");
  await bridge.waitForDeployment();
  console.log(`✅ Bridge deployed to ${bridge.target}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
