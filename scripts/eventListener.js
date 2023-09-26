const { ethers } = require("hardhat");
const Bridge = require("../artifacts/contracts/Bridge.sol/Bridge.json");
const PermitToken = require("../artifacts/contracts/ERC20PermitToken.sol/ERC20PermitToken.json");
// const Token = require("../artifacts/contracts/ERC20Token.sol/ERC20Token.json");

async function main() {
  const name = "USD Coin";
  const symbol = "USDC";
  // const wName = "Wrapped " + name;
  // const wSymbol = "W" + symbol;

  const [signer, ...other] = await ethers.getSigners();
  const sepoliaForkProvider = new ethers.JsonRpcProvider();
  const mumbaiForkProvider = new ethers.JsonRpcProvider(
    "http://localhost:8546"
  );

  const permitTokenAddr = "";
  const bridgeSepoliaAddr = "";
  const bridgeMumbaiAddr = "";

  const permitToken = new ethers.Contract(
    permitTokenAddr,
    PermitToken.abi,
    sepoliaForkProvider
  );
  console.log(`✅ Successfully connected to permitToken`);

  const bridgeSepolia = new ethers.Contract(
    bridgeSepoliaAddr,
    Bridge.abi,
    sepoliaForkProvider
  );
  console.log(`✅ Successfully connected to bridge on Sepolia`);

  const bridgeMumbai = new ethers.Contract(
    bridgeMumbaiAddr,
    Bridge.abi,
    mumbaiForkProvider
  );
  console.log(`✅ Successfully connected to bridge on Mumbai`);

  console.log(`✅ PermitToken address: ${permitToken.target}`);
  console.log(`✅ Bridge on  Sepolia address: ${bridgeSepolia.target}`);
  console.log(`✅ Bridge on  Mumbai address: ${bridgeMumbai.target}`);
  console.log(`✅ PermitToken name: ${await permitToken.name()}`);
  console.log(`✅ PermitToken symbol: ${await permitToken.symbol()}`);
  console.log(
    `✅ Balance of signer: ${ethers.formatEther(
      await permitToken.balanceOf(signer.address)
    )} tokens`
  );

  bridgeSepolia.on(
    "LockToken",
    (_token, _from, _chainId, _amount, _deadline, _signature) => {
      console.log("###########");
      console.log(_token, _from, _chainId, _amount, _deadline, _signature);
    }
  );

  bridgeSepolia.on("ReleaseToken", (_token, _to, _amount) => {
    console.log("###########");
    console.log(_token, _to, _amount);
  });

  bridgeMumbai.on("DeployToken", (_token, _wrapper, _name, _symbol) => {
    console.log("###########");
    console.log(_token, _wrapper, _name, _symbol);
  });

  bridgeMumbai.on(
    "ClaimToken",
    (_token, _from, _to, _chainId, _amount, _nonce, _signature) => {
      console.log("###########");
      console.log(_token, _from, _to, _chainId, _amount, _nonce, _signature);
    }
  );

  bridgeMumbai.on("BurnToken", (_token, _sender, _chainId, _amount, _nonce) => {
    console.log("###########");
    console.log(_token, _sender, _chainId, _amount, _nonce);
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
