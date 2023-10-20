#! /usr/bin/env node
require("dotenv").config();
const { ethers } = require("hardhat");
const yargs = require("yargs");
const bridgeAbi = require("../artifacts/contracts/Bridge.sol/Bridge.json");
const permitTokenAbi = require("../artifacts/contracts/ERC20PermitToken.sol/ERC20PermitToken.json");
const { getPermitSignature } = require("../utils/getPermitSignature");

const options = yargs
  .usage("Select action to perform on the bridge.")
  .command(
    "lock bridge_address token_address amount deadline fee signature chain",
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
    "claim from to bridge_address token_address name symbol amount deadline nonce signature chain",
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
    "burn bridge_address token amount nonce chain",
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
    "release to bridge_address token_address amount chain",
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
    "permit-signature from to token amount deadline chain",
    "Compute permit signature.",
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
    "signature from to amount deadline nonce chain",
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

  console.log(`${JSON.stringify(provider)}`);
  const provider = new ethers.JsonRpcProvider(url);

  const permitToken = new ethers.Contract(
    tokenAddress,
    permitTokenAbi.abi,
    provider
  );

  const bridge = new ethers.Contract(bridgeAddress, bridgeAbi.abi, provider);

  switch (command) {
    case "lock":
      await bridge
        .connect(signer)
        .lock(tokenAddress, amount, deadline, signature, {
          value: fee,
        });
      console.log(`✅ Tokens are locked`);
      break;
    case "claim":
      await bridge
        .connect(signer)
        .claim(tokenAddress, name, symbol, from, to, amount, nonce, signature);
      console.log(`✅ Wrapped token are claimed`);
      break;
    case "burn":
      await bridge.connect(signer).burn(tokenIndex, amount, nonce);
      console.log(`✅ Wrapped token are burnt`);
      break;
    case "release":
      await bridge
        .connect(signer)
        .release(permitToken.target, signer.address, amount);
      console.log(`✅ Tokens are released back to owner`);
      break;
    case "permit-signature":
      const permitSignature = await getPermitSignature(
        signer,
        permitToken,
        to,
        amount,
        deadline
      );
      console.log(permitSignature);
      break;
    case "signature":
      const bytes = ethers.solidityPacked(
        ["address", "address", "uint256", "uint256"],
        [from, to, amount, nonce]
      );
      const hash = ethers.keccak256(bytes);
      const signature = await signer.signMessage(ethers.toBeArray(hash));
      console.log(signature);
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
