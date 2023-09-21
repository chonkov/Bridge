const { ethers } = require("hardhat");
const { getPermitSignature } = require("../utils/getPermitSignature");
const Bridge = require("../artifacts/contracts/Bridge.sol/Bridge.json");
const PermitToken = require("../artifacts/contracts/ERC20PermitToken.sol/ERC20PermitToken.json");
const Token = require("../artifacts/contracts/ERC20Token.sol/ERC20Token.json");

console.log("______________________________");

async function main() {
  const name = "USD Coin";
  const symbol = "USDC";
  const amount = ethers.parseEther("1");
  const wName = "Wrapped " + name;
  const wSymbol = "W" + symbol;
  const fee = ethers.parseEther("0.01");

  const [signer, ...other] = await ethers.getSigners();
  const sepoliaForkProvider = new ethers.JsonRpcProvider();
  const mumbaiForkProvider = new ethers.JsonRpcProvider(
    "http://localhost:8546"
  );

  const sepoliaWallet = new ethers.Wallet(
    "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80", // first key of the provided by hardhat
    sepoliaForkProvider
  );
  const mumbaiWallet = new ethers.Wallet(
    "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80", // first key of the provided by hardhat
    mumbaiForkProvider
  );

  const PermitTokenFactory = new ethers.ContractFactory(
    PermitToken.abi,
    PermitToken.bytecode,
    sepoliaWallet
  );

  const BridgeFactorySepolia = new ethers.ContractFactory(
    Bridge.abi,
    Bridge.bytecode,
    sepoliaWallet
  );

  const BridgeFactoryMumbai = new ethers.ContractFactory(
    Bridge.abi,
    Bridge.bytecode,
    mumbaiWallet
  );

  const permitToken = await PermitTokenFactory.deploy(name, symbol);
  await permitToken.waitForDeployment();

  let tx = await permitToken.mint(signer.address, amount);
  await tx.wait();
  tx = await permitToken.mint(other[0].address, amount);
  await tx.wait();

  console.log(`✅ ERC20PermitToken deployed to ${permitToken.target}`);
  console.log(`✅ ERC20PermitToken owner: to ${await permitToken.owner()}`);
  console.log(
    `✅ Balance of signer: ${await permitToken.balanceOf(signer.address)}`
  );
  console.log(
    `✅ Balance of other[0]: ${await permitToken.balanceOf(other[0].address)}`
  );
  console.log(
    `✅ Balance of other[1]: ${await permitToken.balanceOf(other[1].address)}`
  );

  const bridgeSepolia = await BridgeFactorySepolia.deploy();
  await bridgeSepolia.waitForDeployment();
  console.log(`✅ Bridge on Sepolia deployed to ${bridgeSepolia.target}`);

  const bridgeMumbai = await BridgeFactoryMumbai.deploy();
  await bridgeMumbai.waitForDeployment();
  console.log(`✅ Bridge on Mumbai deployed to ${bridgeMumbai.target}`);

  tx = await bridgeSepolia.registerToken(permitToken.target);
  await tx.wait();
  console.log(`✅ Token(${permitToken.target}) successfully registered`);

  tx = await bridgeMumbai.deployWrappedToken(
    permitToken.target,
    wName,
    wSymbol
  );
  await tx.wait();
  console.log(
    `✅ Wrapper of Token(${permitToken.target}) successfully deployed`
  );

  const TokenFactory = new ethers.ContractFactory(
    Token.abi,
    Token.bytecode,
    mumbaiWallet
  );
  const wrapperAddr = await bridgeMumbai.createdWrappedTokens(0);
  const wrapper = TokenFactory.attach(wrapperAddr);

  const blockTimestamp = (await sepoliaForkProvider.getBlock("latest"))
    .timestamp;
  const deadline = blockTimestamp + 3600;

  const nonce = await mumbaiForkProvider.getTransactionCount(signer.address);

  const bytes = ethers.solidityPacked(
    ["address", "address", "uint256", "uint256", "uint256"],
    [signer.address, signer.address, amount, deadline, nonce]
  );
  const hash = ethers.keccak256(bytes);
  const sig = await signer.signMessage(ethers.toBeArray(hash));

  const signature = await getPermitSignature(
    signer,
    permitToken,
    bridgeSepolia.target,
    amount,
    deadline
  );

  tx = await bridgeSepolia.lockToken(
    permitToken.target,
    amount,
    deadline,
    signature,
    {
      value: fee,
    }
  );
  await tx.wait();
  console.log(`✅ Tokens are locked`);
  console.log(`✅ Wrapped tokens can be claimed`);
  console.log(
    `✅ Balance of signer: ${await permitToken.balanceOf(signer.address)}`
  );
  console.log(
    `✅ Balance of bridge: ${await permitToken.balanceOf(bridgeSepolia.target)}`
  );

  tx = await bridgeMumbai.claim(
    wrapper.target,
    signer.address,
    signer.address,
    amount,
    deadline,
    nonce,
    sig
  );
  await tx.wait();
  console.log(`✅ Wrapped token are claimed`);

  tx = await bridgeMumbai.burn(wrapper.target, amount, nonce + 1);
  await tx.wait();
  console.log(`✅ Wrapped token are burnt`);

  tx = await bridgeSepolia.release(permitToken.target, signer.address, amount);
  await tx.wait();
  console.log(`✅ Tokens are released back to owner`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
