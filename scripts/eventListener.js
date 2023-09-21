const { ethers } = require("hardhat");
const Bridge = require("../artifacts/contracts/Bridge.sol/Bridge.json");
const PermitToken = require("../artifacts/contracts/ERC20PermitToken.sol/ERC20PermitToken.json");
const Token = require("../artifacts/contracts/ERC20Token.sol/ERC20Token.json");

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

  const permitTokenAddr = "0x3700C29CC19e333CB5C8CBC26e8aeAE9cBD40564";
  const bridgeSepoliaAddr = "0xF841B769Be22a1c2E607230e94Be66dc631Bc371";
  const bridgeMumbaiAddr = "0xcebD232459F9BB789EF49757f354D5629C01F236";

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

    // const tx = await bridgeMumbai
    //   .connect(signer)
    //   .deployWrappedToken(_token, wName, wSymbol);
    // await tx.wait();
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

  // await new Promise(async (resolve) => {
  //   bridgeSepolia.on("RegisterToken", (_token, _name, _symbol, _from) => {
  //     console.log("###########");
  //     console.log(_token, _name, _symbol, _from);
  //     resolve(true);
  //   });

  //   bridgeMumbai.on("DeployToken", (_token, _wrapper) => {
  //     console.log("###########");
  //     console.log(_token, _wrapper);
  //     resolve(true);
  //   });

  //   // const tx = await bridgeSepolia
  //   //   .connect(signer)
  //   //   .deployWrappedToken(permitTokenAddr, wName, wSymbol);
  //   // const receipt = await tx.wait();

  //   // for (const event of contractReceipt.logs!) {
  //   //   console.log(event.fragment.name, event.args[0].toString()); // TokensMinted 123
  //   // }

  //   // Works
  //   //  contractA.emit("TokensMinted", 123);
  // });

  // bridgeSepolia.on("RegisterToken", (_token, _name, _symbol, _from) => {
  //   console.log(_token, _name, _symbol, _from);

  //   // const tx = await bridgeMumbai
  //   //   .connect(signer)
  //   //   .deployWrappedToken(_token, wName, wSymbol);
  //   // const receipt = await tx.wait();
  //   // console.log(receipt);
  // });

  // bridgeMumbai.on("DeployToken", async (_token, _wrapper) => {
  //   console.log(_token, _wrapper);
  // });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
