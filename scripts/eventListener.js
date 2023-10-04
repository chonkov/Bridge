const { ethers } = require("hardhat");
const Bridge = require("../artifacts/contracts/Bridge.sol/Bridge.json");
const PermitToken = require("../artifacts/contracts/ERC20PermitToken.sol/ERC20PermitToken.json");
const { db } = require("./deployDB.js");
require("dotenv").config();

const PERMIT_TOKEN = process.env.PERMIT_TOKEN || "0x";
const BRIDGE_SEPOLIA = process.env.BRIDGE_SEPOLIA || "0x";
const BRIDGE_MUMBAI = process.env.BRIDGE_MUMBAI || "0x";

const {
  collection,
  doc,
  addDoc,
  updateDoc,
  onSnapshot,
  query,
  where,
  getDocs,
} = require("firebase/firestore");

async function main() {
  const [signer] = await ethers.getSigners();
  const sepoliaForkProvider = new ethers.JsonRpcProvider(
    "http://127.0.0.1:8545/"
  );
  const mumbaiForkProvider = new ethers.JsonRpcProvider(
    "http://127.0.0.1:8546/"
  );

  const colRef = collection(db, "events");
  // console.log(colRef);
  let querySnapshot;

  onSnapshot(colRef, async (snapshot) => {
    const events = [];
    snapshot.docs.forEach((doc) => {
      events.push({ ...doc.data(), id: doc.id });
    });
    // querySnapshot = await getDocs(
    //   collection(db, "events"),
    //   where("eventType", "==", "lock"),
    //   where("isClaimed", "==", false)
    // );
    // console.log(events);
  });

  // console.log(querySnapshot);
  // querySnapshot.forEach((doc) => {
  //   // doc.data() is never undefined for query doc snapshots
  //   console.log(doc.data());
  // });
  // const q = query(collection(db, "events"), where("eventType", "==", "lock"));
  // const querySnapshot = await getDocs(q);
  // querySnapshot.forEach((doc) => {
  //   // doc.data() is never undefined for query doc snapshots
  //   console.log(doc.id, " => ", doc.data());
  // });

  const permitToken = new ethers.Contract(
    PERMIT_TOKEN,
    PermitToken.abi,
    sepoliaForkProvider
  );
  console.log(`✅ Successfully connected to permitToken`);

  const bridgeSepolia = new ethers.Contract(
    BRIDGE_SEPOLIA,
    Bridge.abi,
    sepoliaForkProvider
  );
  console.log(`✅ Successfully connected to bridge on Sepolia`);

  const bridgeMumbai = new ethers.Contract(
    BRIDGE_MUMBAI,
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
    (_token, _from, _chainId, _amount, _nonce, _deadline, _signature) => {
      console.log("###########");
      console.log(
        _token,
        _from,
        _chainId,
        _amount,
        _nonce,
        _deadline,
        _signature
      );

      const data = {
        eventType: "Lock",
        token: _token,
        from: _from,
        chainId: `${_chainId}`,
        amount: `${_amount}`,
        nonce: `${_nonce}`,
        deadline: `${_deadline}`,
        signature: _signature,
        isClaimed: false,
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

  bridgeMumbai.on(
    "DeployToken",
    (_deployer, _source, _wrapper, _name, _symbol) => {
      console.log("###########");
      console.log(_deployer, _source, _wrapper, _name, _symbol);

      const data = {
        eventType: "Deploy",
        deployer: _deployer,
        source: _source,
        wrapper: _wrapper,
        name: _name,
        symbol: _symbol,
      };

      addDoc(colRef, data).then(() => {});
    }
  );

  function update(_nonce) {
    const docRef = doc(db, "events", `${_nonce}`);

    querySnapshot.forEach((doc) => {
      if (doc.data().nonce == _nonce) {
        setDoc(docRef, { isClaimed: true }, { merge: true });
      }
      console.log(doc.id, " => ", doc.data());
    });
  }

  bridgeMumbai.on(
    "ClaimToken",
    (_token, _from, _to, _chainId, _amount, _nonce, _signature) => {
      console.log("###########");
      console.log(_token, _from, _to, _chainId, _amount, _nonce, _signature);

      update(_nonce);

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
