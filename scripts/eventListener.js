const { ethers } = require("hardhat");
const Bridge = require("../artifacts/contracts/Bridge.sol/Bridge.json");
const PermitToken = require("../artifacts/contracts/ERC20PermitToken.sol/ERC20PermitToken.json");
const db = require("./index.js");

const { collection, addDoc, onSnapshot } = require("firebase/firestore");

async function main() {
  const name = "USD Coin";
  const symbol = "USDC";

  const [signer] = await ethers.getSigners();
  const sepoliaForkProvider = new ethers.JsonRpcProvider();
  const mumbaiForkProvider = new ethers.JsonRpcProvider(
    "http://localhost:8546"
  );

  const permitTokenAddr = "0xBb854b6BFC670069034cF51010bb9899AE6eDDA7";
  const bridgeSepoliaAddr = "0xa62Ea43b255eb458b61855816311D91d1075bFe9";
  const bridgeMumbaiAddr = "0x01A5e7675e5f86c31217DE32F444BA384bE94ff5";

  const colRef = collection(db, "events");
  onSnapshot(colRef, (snapshot) => {
    const events = [];
    snapshot.docs.forEach((doc) => {
      events.push({ ...doc.data(), id: doc.id });
    });
    console.log(events);
  });

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

      const data = {
        eventType: "Lock",
        token: _token,
        from: _from,
        chainId: `${_chainId}`,
        amount: `${_amount}`,
        deadline: `${_deadline}`,
        signature: _signature,
      };

      addDoc(colRef, data).then(() => {});
    }
  );

  bridgeSepolia.on("ReleaseToken", (_token, _to, _amount) => {
    console.log("###########");
    console.log(_token, _to, _amount);

    const data = {
      eventType: "Release",
      token: _token,
      to: _to,
      amount: `${_amount}`,
    };

    addDoc(colRef, data).then(() => {});
  });

  bridgeMumbai.on("DeployToken", (_token, _wrapper, _name, _symbol) => {
    console.log("###########");
    console.log(_token, _wrapper, _name, _symbol);

    const data = {
      eventType: "Deploy",
      token: _token,
      wrapper: _wrapper,
      name: _name,
      symbol: _symbol,
    };

    addDoc(colRef, data).then(() => {});
  });

  bridgeMumbai.on(
    "ClaimToken",
    (_token, _from, _to, _chainId, _amount, _nonce, _signature) => {
      console.log("###########");
      console.log(_token, _from, _to, _chainId, _amount, _nonce, _signature);

      const data = {
        eventType: "Claim",
        token: _token,
        from: _from,
        to: _to,
        chainId: `${_chainId}`,
        amount: `${_amount}`,
        nonce: `${_nonce}`,
        signature: _signature,
      };

      addDoc(colRef, data).then(() => {});
    }
  );

  bridgeMumbai.on("BurnToken", (_token, _sender, _chainId, _amount, _nonce) => {
    console.log("###########");
    console.log(_token, _sender, _chainId, _amount, _nonce);

    const data = {
      eventType: "Burn",
      token: _token,
      sender: _sender,
      chainId: `${_chainId}`,
      amount: `${_amount}`,
      nonce: `${_nonce}`,
    };

    addDoc(colRef, data).then(() => {});
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
