const { ethers } = require("hardhat");

console.log("______________________________");

async function main() {
  const [signer] = await ethers.getSigners();
  const amount = ethers.parseEther("1");

  const permitToken = await ethers.deployContract("ERC20PermitToken", [
    "USD Coin",
    "USDC",
  ]);
  await permitToken.waitForDeployment();
  console.log(`✅ ERC20PermitToken deployed to ${permitToken.target}`);

  await permitToken.mint(signer.address, amount);
  console.log(
    `✅ ERC20PermitToken minted ${ethers.formatEther(amount)} to ${
      signer.address
    }`
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
