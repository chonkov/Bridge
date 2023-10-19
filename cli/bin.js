#! /usr/bin/env node
require("dotenv").config();
const { ethers } = require("ethers");
const yargs = require("yargs");
const fs = require("fs");
const bridgeAbi = require("../artifacts/contracts/Bridge.sol/Bridge.json").abi;
const permitTokenAbi =
  require("../artifacts/contracts/ERC20PermitToken.sol/ERC20PermitToken.json").abi;

const SEPOLIA_RPC_URL = process.env.SEPOLIA_RPC_URL || "";
const MUMBAI_RPC_URL = process.env.MUMBAI_RPC_URL || "";
const PRIVATE_KEY = process.env.PRIVATE_KEY || "0x";
const PERMIT_TOKEN = process.env.PERMIT_TOKEN || "0x";
const BRIDGE_SEPOLIA = process.env.BRIDGE_SEPOLIA || "0x";
const BRIDGE_MUMBAI = process.env.BRIDGE_MUMBAI || "0x";

// const sepoliaForkProvider = new ethers.JsonRpcProvider(
//   "http://127.0.0.1:8545/"
// );
// const mumbaiForkProvider = new ethers.JsonRpcProvider("http://127.0.0.1:8546/");

// Redundant
// const sepoliaWallet = new ethers.Wallet(
//   "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80", // first key of the provided by hardhat
//   sepoliaForkProvider
// );
// const mumbaiWallet = new ethers.Wallet(
//   "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80", // first key of the provided by hardhat
//   mumbaiForkProvider
// );

// let sourceSigner = new ethers.Wallet(USER_KEY, sourceProvider);
// let destinationSigner = new ethers.Wallet(USER_KEY, destinationProvider);

// 1. npx hardhat run scripts/deployERC20PermitToken.js --network localhost_<SOURCE_CHAIN>
// 2. npx hardhat run scripts/deployBridge.js --network localhost_<SOURCE_CHAIN>
// 3. npx hardhat run scripts/deployBridge.js --network localhost_<DESTINATION_CHAIN>

// 4. npx hardhat permit-signature --from <SIGNER_ADDRESS> --to <SOURCE_BRIDGE_STEP_2> --token <SOURCE_TOKEN_STEP_1> --amount <TOKENS_AMOUNT> --deadline <DEADLINE> --network localhost_<SOURCE_CHAIN>
// 5. npx hardhat lock --bridge <SOURCE_BRIDGE_STEP_2> --token <SOURCE_TOKEN_STEP_1> --amount <TOKENS_AMOUNT> --deadline <DEADLINE> --fee 1000000000000000000 --signature <SIGNATURE_COMPUTED_STEP_4> --network localhost_<SOURCE_CHAIN>

// 6. npx hardhat signature --from <SIGNER_ADDRESS> --to <RECEIVER_ADDRESS> --amount <TOKENS_AMOUNT> --deadline <DEADLINE> --nonce <NONCE_NOT_ALREADY_PROCESSED> --network localhost_<DESTINATION_CHAIN>
// 7. npx hardhat claim --from <SIGNER_ADDRESS> --to <RECEIVER_ADDRESS> --bridge <DESTINATION_BRIDGE_STEP_3> --token <SOURCE_TOKEN_STEP_1> --name <NAME> --symbol <SYMBOL> --amount <TOKENS_AMOUNT> --deadline <DEADLINE> --nonce <NONCE_NOT_ALREADY_PROCESSED> --signature <SIGNATURE_COMPUTED_STEP_6> --network localhost_<DESTINATION_CHAIN>

// 8. npx hardhat burn --bridge <DESTINATION_BRIDGE_STEP_3> --token <INDEX_OF_TOKEN> --amount <TOKENS_AMOUNT> --nonce <NONCE_NOT_ALREADY_PROCESSED> --network localhost_<DESTINATION_CHAIN>
// 9. npx hardhat release --to <RECEIVER_ADDRESS> --bridge <SOURCE_BRIDGE_STEP_2> --token <SOURCE_TOKEN_STEP_1> --amount <TOKENS_AMOUNT> --network localhost_<SOURCE_CHAIN>

const options = yargs
  .usage("Select action to perform on the bridge.")
  .command(
    "lock <bridge_address> <token_address> <amount> <deadline> <fee> <signature> <chain>",
    "Lock amount of funds in bridge.",
    (yargs) => {
      yargs.positional("bridge_address", {
        describe: "The address of the bridge",
        type: "string",
      });
      yargs.positional("token_address", {
        describe: "The address of the ERC20 token",
        type: "string",
      });
      yargs.positional("amount", {
        describe: "The amount to lock",
        type: "string",
      });
      yargs.positional("deadline", {
        describe: "The last timestamp until the lock can be performed",
        type: "string",
      });
      yargs.positional("fee", {
        describe: "The fee which is paid to the bridge",
        type: "string",
      });
      yargs.positional("signature", {
        describe:
          "The signature which allows the transfer of the tokens to the bridge in 1 tx",
        type: "string",
      });
      yargs.positional("chain", {
        describe: "The chain on which the tx is performed",
        type: "string",
      });
    }
  )
  .command(
    "claim <from> <to> <bridge_address> <token_address> <name> <symbol> <amount> <deadline> <nonce> <signature> <chain>",
    "Claim amount of funds",
    (yargs) => {
      yargs.positional("from", {
        describe: "The address which starts the tx",
        type: "string",
      });
      yargs.positional("to", {
        describe: "The address to receive wrapped tokens",
        type: "string",
      });
      yargs.positional("bridge_address", {
        describe: "The address of the bridge",
        type: "string",
      });
      yargs.positional("token_address", {
        describe: "The address of the source ERC20 token",
        type: "string",
      });
      yargs.positional("name", {
        describe: "The name of the wrapped ERC20 token",
        type: "string",
      });
      yargs.positional("symbol", {
        describe: "The symbol of the wrapped ERC20 token",
        type: "string",
      });
      yargs.positional("amount", {
        describe: "The amount to claim",
        type: "string",
      });
      yargs.positional("deadline", {
        describe: "The last timestamp until the lock can be performed",
        type: "string",
      });
      yargs.positional("nonce", {
        describe: "The nonce to pass for validation against replay attacks",
        type: "string",
      });
      yargs.positional("signature", {
        describe:
          "The signature signed by externally by the bridge with which claims can be made",
        type: "string",
      });
      yargs.positional("chain", {
        describe: "The chain on which the tx is performed",
        type: "string",
      });
    }
  )
  .command(
    "burn <bridge_address> <token> <amount> <nonce> <chain>",
    "Burn funds",
    (yargs) => {
      yargs.positional("bridge_address", {
        describe: "The address of the bridge",
        type: "string",
      });
      yargs.positional("token", {
        describe:
          "The index of the wrapped ERC20 token stored in `createdWrappedTokens` array",
        type: "string",
      });
      yargs.positional("amount", {
        describe: "The amount to burn",
        type: "string",
      });
      yargs.positional("nonce", {
        describe: "The nonce to pass for validation against replay attacks",
        type: "string",
      });
      yargs.positional("chain", {
        describe: "The chain on which the tx is performed",
        type: "string",
      });
    }
  )
  .command(
    "release <to> <bridge_address> <token_address> <amount> <chain>",
    "Release locked funds on source chain.",
    (yargs) => {
      yargs.positional("to", {
        describe: "The address to receive the released original tokens",
        type: "string",
      });
      yargs.positional("bridge_address", {
        describe: "The address of the bridge",
        type: "string",
      });
      yargs.positional("token_address", {
        describe: "The address of the ERC20 token",
        type: "string",
      });
      yargs.positional("amount", {
        describe: "The amount to claim back",
        type: "string",
      });
      yargs.positional("chain", {
        describe: "The chain on which the tx is performed",
        type: "string",
      });
    }
  )
  .command(
    "permit-signature <from> <to> <token> <amount> <deadline> <chain>",
    "Compute signature.",
    (yargs) => {
      yargs.positional("from", {
        describe: "The address wbich initiated the tx",
        type: "string",
      });
      yargs.positional("to", {
        describe: "The address to receive an approval to transfer the tokens",
        type: "string",
      });
      yargs.positional("amount", {
        describe: "The amount to tokens",
        type: "string",
      });
      yargs.positional("deadline", {
        describe: "The last timestamp until the operation is valid",
        type: "string",
      });
      yargs.positional("chain", {
        describe: "The chain on which the tx is performed",
        type: "string",
      });
    }
  )
  .command(
    "signature <from> <to> <amount> <deadline> <nonce> <chain>",
    "Compute signature.",
    (yargs) => {
      yargs.positional("from", {
        describe: "The address wbich initiated the tx",
        type: "string",
      });
      yargs.positional("to", {
        describe: "The address to receive the wrapped tokens",
        type: "string",
      });
      yargs.positional("amount", {
        describe: "The amount to tokens",
        type: "string",
      });
      yargs.positional("deadline", {
        describe: "The last timestamp until the operation is valid",
        type: "string",
      });
      yargs.positional("nonce", {
        describe: "The nonce used for verification",
        type: "string",
      });
      yargs.positional("chain", {
        describe: "The chain on which the tx is performed",
        type: "string",
      });
    }
  )
  .help().argv;

// // Get the command and amount from the parsed options
const command = options._[0];

async function main() {
  // let token = options.address;
  // let amount = options.amount;
  // let wERC20;
  // let result;
  // let r = options.r;
  // let s = options.s;
  // let v = options.v;
  // <bridge_address> <token_address> <amount> <deadline> <fee> <signature> <chain>
  // <from> <to> <bridge_address> <token_address> <name> <symbol> <amount> <deadline> <nonce> <signature> <chain>
  // <bridge_address> <token_address> <amount> <nonce> <chain>
  // <to> <bridge_address> <token_address> <amount> <chain>
  // <from> <to> <token> <amount> <deadline> <chain>

  const [signer] = await ethers.getSigners();

  const bridgeAddress = options.bridge_address;
  const tokenAddress = options.token_address;
  const tokenIndex = options.token;
  const amount = options.amount;
  const deadline = options.deadline;
  const fee = options.fee;
  const signature = options.signature;
  const chain = options.chain;
  const from = options.from;
  const to = options.to;
  const name = options.name;
  const symbol = options.symbol;
  const nonce = options.nonce;

  let url;

  switch (chain) {
    case "sepolia":
      url = "http://127.0.0.1:8545/";
      break;
    case "mumbai":
      url = "http://127.0.0.1:8546/";
      break;
  }

  const provider = new ethers.JsonRpcProvider(url);

  const permitToken = new ethers.Contract(
    tokenAddress,
    permitTokenAbi,
    provider
  );

  const bridgeSepolia = new ethers.Contract(bridgeAddress, bridgeAbi, provider);

  const bridgeMumbai = new ethers.Contract(bridgeAddress, bridgeAbi, provider);

  switch (command) {
    case "lock":
      await bridgeSepolia.lockToken(tokenAddress, amount, deadline, signature, {
        value: fee,
      });
      console.log(`✅ Tokens are locked`);
      break;
    case "claim":
      // Add logic
      break;
    case "burn":
      // Add logic
      break;
    case "release":
      // Add logic
      break;
    case "permit-signature":
      console.log("Permit signature...");
      break;
    case "signature":
      console.log("Signature...");
      break;
    case "demo":
      console.log(`Demo command executed ✅`);
      break;
    default:
      // Handle invalid or unsupported commands
      console.error(
        "Invalid command. Use one of: lock, claim, burn, release, permit-signature or signature with their respective amount of params."
      );
      break;
  }
}

main();
