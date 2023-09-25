const { ethers } = require("hardhat");
const Bridge = require("../artifacts/contracts/Bridge.sol/Bridge.json");
const PermitToken = require("../artifacts/contracts/ERC20PermitToken.sol/ERC20PermitToken.json");
const Token = require("../artifacts/contracts/ERC20Token.sol/ERC20Token.json");

async function main() {
  const name = "USD Coin";
  const symbol = "USDC";
  const wName = "Wrapped " + name;
  const wSymbol = "W" + symbol;

  const [signer, ...other] = await ethers.getSigners();
  const sepoliaForkProvider = new ethers.JsonRpcProvider();
  const mumbaiForkProvider = new ethers.JsonRpcProvider(
    "http://localhost:8546"
  );

  const permitTokenAddr = "0xe70fc4dbE4b655DD80FE6C02e0E9C5d3215420Ef";
  const bridgeSepoliaAddr = "0xA172158Bc63C8037f5eA9f6373f18d2d42A8B9b4";
  const bridgeMumbaiAddr = "0x951Aa87F2241ccfF4e9e4505eeEdD21C8005Ff48";

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

  bridgeSepolia.on("RegisterToken", async (_token, _name, _symbol, _from) => {
    console.log("###########");
    console.log(_token, _name, _symbol, _from);
  });

  bridgeSepolia.on(
    "LockToken",
    async (_token, _amount, _deadline, _signature) => {
      console.log("###########");
      console.log(_token, _amount, _deadline, _signature);
    }
  );

  bridgeSepolia.on("ReleaseToken", async (_token, _to, _amount) => {
    console.log("###########");
    console.log(_token, _to, _amount);
  });

  bridgeMumbai.on("DeployToken", async (_token, _wrapper) => {
    console.log("###########");
    console.log(_token, _wrapper);
  });

  bridgeMumbai.on(
    "ClaimToken",
    async (
      _token,
      _from,
      _to,
      _chainId,
      _amount,
      _timestamp,
      _deadline,
      _nonce,
      _signature
    ) => {
      console.log("###########");
      console.log(
        _token,
        _from,
        _to,
        _chainId,
        _amount,
        _timestamp,
        _deadline,
        _nonce,
        _signature
      );
    }
  );

  bridgeMumbai.on(
    "BurnToken",
    async (_token, _sender, _chainId, _amount, _timestamp, _nonce) => {
      console.log("###########");
      console.log(_token, _sender, _chainId, _amount, _timestamp, _nonce);
    }
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
