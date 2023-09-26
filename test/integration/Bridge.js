const {
  loadFixture,
} = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { expect } = require("chai");
const { ethers } = require("hardhat");
const { getPermitSignature } = require("../../utils/getPermitSignature");
const Bridge = require("../../artifacts/contracts/Bridge.sol/Bridge.json");
const PermitToken = require("../../artifacts/contracts/ERC20PermitToken.sol/ERC20PermitToken.json");
const Token = require("../../artifacts/contracts/ERC20Token.sol/ERC20Token.json");

describe("Bridge", function () {
  const name = "USD Coin";
  const symbol = "USDC";
  const amount = ethers.parseEther("1");
  const wName = "Wrapped " + name;
  const wSymbol = "W" + symbol;
  const fee = ethers.parseEther("0.01");

  describe("Bridge workflow", function () {
    it("Should not revert - the whole bridge workflow should work properly", async function () {
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

      expect(await permitToken.owner()).to.be.equal(signer.address);
      expect(await permitToken.balanceOf(signer.address)).to.be.equal(amount);
      expect(await permitToken.balanceOf(other[0].address)).to.be.equal(amount);
      expect(await permitToken.balanceOf(other[1].address)).to.be.equal(0);

      const bridgeSepolia = await BridgeFactorySepolia.deploy();
      await bridgeSepolia.waitForDeployment();

      const bridgeMumbai = await BridgeFactoryMumbai.deploy();
      await bridgeMumbai.waitForDeployment();

      // tx = await bridgeSepolia.registerToken(permitToken.target);
      // await tx.wait();

      // tx = await bridgeMumbai.deployWrappedToken(
      //   permitToken.target,
      //   wName,
      //   wSymbol
      // );
      // await tx.wait();

      const TokenFactory = new ethers.ContractFactory(
        Token.abi,
        Token.bytecode,
        mumbaiWallet
      );
      // const wrapperAddr = await bridgeMumbai.createdWrappedTokens(0);
      // const wrapper = TokenFactory.attach(wrapperAddr);

      const blockTimestamp = (await sepoliaForkProvider.getBlock("latest"))
        .timestamp;
      const deadline = blockTimestamp + 3600;

      const signature = await getPermitSignature(
        signer,
        permitToken,
        bridgeSepolia.target,
        amount,
        deadline
      );

      expect(
        await bridgeSepolia.lockToken(
          permitToken.target,
          amount,
          deadline,
          signature,
          {
            value: fee,
          }
        )
      ).to.not.be.reverted;

      expect(await permitToken.balanceOf(signer.address)).to.be.equal(0);
      expect(await permitToken.balanceOf(bridgeSepolia.target)).to.be.equal(
        amount
      );

      let nonce = await mumbaiForkProvider.getTransactionCount(signer.address);

      const bytes = ethers.solidityPacked(
        ["address", "address", "uint256", "uint256"],
        [signer.address, signer.address, amount, nonce]
      );
      const hash = ethers.keccak256(bytes);
      const sig = await signer.signMessage(ethers.toBeArray(hash));

      tx = await bridgeMumbai.claim(
        permitToken.target,
        wName,
        wSymbol,
        signer.address,
        signer.address,
        amount,
        nonce,
        sig
      );
      await tx.wait();

      const wrapperAddr = await bridgeMumbai.createdWrappedTokens(0);
      const wrapper = TokenFactory.attach(wrapperAddr);

      tx = await bridgeMumbai.burn(wrapper.target, amount, nonce + 1);
      await tx.wait();

      tx = await bridgeSepolia.release(
        permitToken.target,
        signer.address,
        amount
      );
      await tx.wait();
    });
  });
});
