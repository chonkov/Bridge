const { ethers } = require("hardhat");
const { getPermitSignature } = require("../utils/getPermitSignature");

console.log("______________________________");

async function main() {
  const [signer, ...other] = await ethers.getSigners();

  const permitToken = await ethers.deployContract("ERC20PermitToken", [
    "USD Coin",
    "USDC",
  ]);
  await permitToken.waitForDeployment();

  const name = await permitToken.name();
  const symbol = await permitToken.symbol();
  const wName = "Wrapped " + name;
  const wSymbol = "W" + symbol;
  const amount = ethers.parseEther("1");
  const fee = ethers.parseEther("0.01");
  const nonce = 0;

  await permitToken.mint(signer.address, amount);
  await permitToken.connect(signer).mint(other[0].address, amount);

  console.log(`✅ ERC20PermitToken deployed to ${permitToken.target}`);

  const bridge = await ethers.deployContract("Bridge");
  await bridge.waitForDeployment();

  console.log(`✅ Bridge deployed to ${bridge.target}`);

  await bridge.registerToken(permitToken.target);
  console.log(`✅ Token(${permitToken.target}) successfully registered`);
  await bridge.deployWrappedToken(permitToken.target, wName, wSymbol);
  console.log(
    `✅ Wrapper of Token(${permitToken.target}) successfully deployed`
  );

  const Wrapper = await ethers.getContractFactory("ERC20Token");
  const wrapper = Wrapper.attach(await bridge.createdWrappedTokens(0));

  const blockTimestamp = (await ethers.provider.getBlock("latest")).timestamp;
  const deadline = blockTimestamp + 3600;

  const bytes = ethers.solidityPacked(
    ["address", "address", "uint256", "uint256", "uint256"],
    [signer.address, signer.address, amount, deadline, nonce]
  );
  const hash = ethers.keccak256(bytes);
  const sig = await signer.signMessage(ethers.toBeArray(hash));

  const signature = await getPermitSignature(
    signer,
    permitToken,
    bridge.target,
    amount,
    deadline
  );

  await bridge.lockToken(permitToken.target, amount, deadline, signature, {
    value: fee,
  });
  console.log(`✅ Tokens are locked`);
  await bridge.approveAmount(signer.address, amount);
  console.log(`✅ Wrapped tokens can be claimed`);

  await bridge.claim(
    wrapper.target,
    signer.address,
    signer.address,
    amount,
    deadline,
    nonce,
    sig
  );
  console.log(`✅ Wrapped token are claimed`);
  await bridge.burn(wrapper.target, amount, nonce + 1);
  console.log(`✅ Wrapped token are burnt`);
  await bridge.release(permitToken.target, signer.address, amount);
  console.log(`✅ Tokens are released back to owner`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
