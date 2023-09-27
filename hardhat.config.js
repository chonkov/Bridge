require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();
const { getPermitSignature } = require("./utils/getPermitSignature");

const SEPOLIA_RPC_URL = process.env.SEPOLIA_RPC_URL || "";
const MUMBAI_RPC_URL = process.env.MUMBAI_RPC_URL || "";
const PRIVATE_KEY = process.env.PRIVATE_KEY || "0x";

// task(
//   "register",
//   "Registers a toke by taking a token's and a bridge's addresses"
// )
//   .addParam("token")
//   .addParam("bridge")
//   .setAction(async (taskArgs, hre) => {
//     const tokenAddr = taskArgs["token"];
//     const bridgeAddr = taskArgs["bridge"];

//     const PermitToken = await hre.ethers.getContractFactory("ERC20PermitToken");
//     const permitToken = PermitToken.attach(tokenAddr);

//     const Bridge = await hre.ethers.getContractFactory("Bridge");
//     const bridge = Bridge.attach(bridgeAddr);

//     const tx = await bridge.registerToken(permitToken.target);
//     await tx.wait();
//     console.log(`✅ Token(${permitToken.target}) successfully registered`);
//   });

// task("deploy", "Deploys a wrapper of an already registered token")
//   .addParam("token")
//   .addParam("bridge")
//   .addParam("name")
//   .addParam("symbol")
//   .setAction(async (taskArgs, hre) => {
//     const tokenAddr = taskArgs["token"];
//     const bridgeAddr = taskArgs["bridge"];
//     const name = taskArgs["name"];
//     const symbol = taskArgs["symbol"];

//     // const PermitToken = await hre.ethers.getContractFactory("ERC20PermitToken");
//     // const permitToken = PermitToken.attach(tokenAddr);

//     const Bridge = await hre.ethers.getContractFactory("Bridge");
//     const bridge = Bridge.attach(bridgeAddr);

//     await bridge.deployWrappedToken(tokenAddr, name, symbol);
//     const Wrapper = await hre.ethers.getContractFactory("ERC20Token");
//     const wrapperAddr = await bridge.createdWrappedTokens(0);
//     const wrapper = Wrapper.attach(wrapperAddr);
//     console.log(
//       `✅ Wrapper of Token(${tokenAddr}) successfully deployed to: ${
//         wrapper.target
//       } with name: ${await wrapper.name()} and symbol: ${await wrapper.symbol()}`
//     );
//   });

task("signature", "Returns a signature based on the passed inputs")
  .addParam("from")
  .addParam("to")
  .addParam("amount")
  .addParam("deadline")
  .addParam("nonce")
  .setAction(async (taskArgs, hre) => {
    const [signer] = await hre.ethers.getSigners(1);
    const from = taskArgs["from"];
    const to = taskArgs["to"];
    const amount = taskArgs["amount"];
    const nonce = taskArgs["nonce"];

    const bytes = hre.ethers.solidityPacked(
      ["address", "address", "uint256", "uint256"],
      [from, to, amount, nonce]
    );
    const hash = hre.ethers.keccak256(bytes);
    const sig = await signer.signMessage(hre.ethers.toBeArray(hash));
    console.log(`✅ Computed signature: ${sig}`);
  });

task(
  "permit-signature",
  "Returns a signature compatible with EIP-712 based on the passed inputs"
)
  .addParam("from")
  .addParam("to")
  .addParam("token")
  .addParam("amount")
  .addParam("deadline")
  .setAction(async (taskArgs, hre) => {
    const from = taskArgs["from"];
    const signer = await hre.ethers.getSigner(from);
    const to = taskArgs["to"];
    const token = taskArgs["token"];
    const amount = taskArgs["amount"];
    const deadline = taskArgs["deadline"];
    const Permit = await hre.ethers.getContractFactory("ERC20PermitToken");
    const permit = Permit.attach(token);

    const signature = await getPermitSignature(
      signer,
      permit,
      to,
      amount,
      deadline
    );
    console.log(`✅ Computed permit-signature: ${signature}`);
  });

task("lock", "Locks an amount of tokens into a bridge using permit signatures")
  .addParam("bridge")
  .addParam("token")
  .addParam("amount")
  .addParam("deadline")
  .addParam("fee")
  .addParam("signature")
  .setAction(async (taskArgs, hre) => {
    const Bridge = await hre.ethers.getContractFactory("Bridge");
    const bridge = Bridge.attach(taskArgs["bridge"]);
    const token = taskArgs["token"];
    const amount = taskArgs["amount"];
    const fee = taskArgs["fee"];
    const deadline = taskArgs["deadline"];
    const signature = taskArgs["signature"];

    await bridge.lockToken(token, amount, deadline, signature, {
      value: fee,
    });
    console.log(`✅ Tokens are locked`);
  });

// task("approve", "Approves a user to claim a certain amount of wrapped tokens")
//   .addParam("claimer")
//   .addParam("bridge")
//   .addParam("amount")
//   .setAction(async (taskArgs, hre) => {
//     const claimer = taskArgs["claimer"];
//     const Bridge = await hre.ethers.getContractFactory("Bridge");
//     const bridge = Bridge.attach(taskArgs["bridge"]);
//     const amount = taskArgs["amount"];

//     await bridge.approveAmount(claimer, amount);
//     console.log(`✅ Wrapped tokens can be claimed`);
//   });

task(
  "claim",
  "Allows users to claim their wrapped tokens using singatures for verification"
)
  .addParam("from")
  .addParam("to")
  .addParam("bridge")
  .addParam("token")
  .addParam("name")
  .addParam("symbol")
  .addParam("amount")
  .addParam("deadline")
  .addParam("nonce")
  .addParam("signature")
  .setAction(async (taskArgs, hre) => {
    const from = taskArgs["from"];
    const to = taskArgs["to"];
    const Bridge = await hre.ethers.getContractFactory("Bridge");
    const bridge = Bridge.attach(taskArgs["bridge"]);
    const token = taskArgs["token"];
    const amount = taskArgs["amount"];
    const name = taskArgs["name"];
    const symbol = taskArgs["symbol"];
    const nonce = taskArgs["nonce"];
    const signature = taskArgs["signature"];

    await bridge.claim(token, name, symbol, from, to, amount, nonce, signature);
    console.log(`✅ Wrapped token are claimed`);
  });

task("burn", "Allows users to burn their wrapped tokens")
  .addParam("bridge")
  .addParam("token")
  .addParam("amount")
  .addParam("nonce")
  .setAction(async (taskArgs, hre) => {
    const Bridge = await hre.ethers.getContractFactory("Bridge");
    const bridge = Bridge.attach(taskArgs["bridge"]);
    const token = await bridge.createdWrappedTokens(taskArgs["token"]);
    const amount = taskArgs["amount"];
    const nonce = taskArgs["nonce"];

    await bridge.burn(token, amount, nonce);
    console.log(`✅ Wrapped token are burnt`);
  });

task("release", "Returns the initial locked amount to the user")
  .addParam("to")
  .addParam("bridge")
  .addParam("token")
  .addParam("amount")
  .setAction(async (taskArgs, hre) => {
    const signer = await hre.ethers.getSigner(taskArgs["to"]);
    const Bridge = await hre.ethers.getContractFactory("Bridge");
    const bridge = Bridge.attach(taskArgs["bridge"]);
    const Permit = await hre.ethers.getContractFactory("ERC20PermitToken");
    const permit = await Permit.attach(taskArgs["token"]);
    const amount = taskArgs["amount"];

    await bridge.release(permit.target, signer.address, amount);
    console.log(`✅ Tokens are released back to owner`);
  });

// task("event-listener", "Starts an event listener")
//   .addParam("to")
//   .addParam("bridge")
//   .addParam("token")
//   .addParam("amount")
//   .setAction(async (taskArgs, hre) => {
//     const signer = await hre.ethers.getSigner(taskArgs["to"]);
//     const Bridge = await hre.ethers.getContractFactory("Bridge");
//     const bridge = Bridge.attach(taskArgs["bridge"]);
//     const Permit = await hre.ethers.getContractFactory("ERC20PermitToken");
//     const permit = await Permit.attach(taskArgs["token"]);
//     const amount = taskArgs["amount"];

//     await bridge.release(permit.target, signer.address, amount);
//     console.log(`✅ Tokens are released back to owner`);
//   });

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.19",
  networks: {
    hardhat: {
      chainId: 31337,
    },
    localhost_sepolia: {
      chainId: 31337,
      url: "http://127.0.0.1:8545/",
    },
    localhost_mumbai: {
      chainId: 31337,
      url: "http://127.0.0.1:8546/",
    },
    sepolia: {
      chainId: 11155111,
      url: SEPOLIA_RPC_URL,
      accounts: PRIVATE_KEY !== undefined ? [PRIVATE_KEY] : [],
    },
    mumbai: {
      chainId: 80001,
      url: MUMBAI_RPC_URL,
      accounts: PRIVATE_KEY !== undefined ? [PRIVATE_KEY] : [],
    },
  },
  mocha: {
    timeout: 100000,
  },
};
