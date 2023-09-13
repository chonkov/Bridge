const {
  loadFixture,
} = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Bridge", function () {
  async function deployERC20() {
    const [signer, ...other] = await ethers.getSigners();

    const usdc = await ethers.deployContract("ERC20Token", [
      "USD Coin",
      "USDC",
      signer.address,
    ]);
    await usdc.waitForDeployment();

    return { usdc, signer, other };
  }

  async function deployBridge() {
    const bridge = await ethers.deployContract("Bridge");
    await bridge.waitForDeployment();

    return { bridge };
  }

  describe("Deployment", function () {
    it("Should deploy successfully & set constants", async function () {
      const { bridge } = await loadFixture(deployBridge);

      const fee = ethers.parseEther("0.01");
      const sourceChainId = 11155111;
      const targetChainId = 80001;

      expect(await bridge.SERVICE_FEE()).to.equal(fee);
      expect(await bridge.SOURCE_CHAIN_ID()).to.equal(sourceChainId);
      expect(await bridge.TARGET_CHAIN_ID()).to.equal(targetChainId);
    });
  });

  describe("Registering", function () {
    it("Should not revert", async function () {
      const { bridge } = await loadFixture(deployBridge);
      const { usdc } = await loadFixture(deployERC20);

      expect(await bridge.registerToken(usdc.target)).to.not.be.reverted;
    });

    it("Should emit an event", async function () {
      const { bridge } = await loadFixture(deployBridge);
      const { usdc, signer } = await loadFixture(deployERC20);

      expect(await bridge.registerToken(usdc.target))
        .to.emit("RegisterToken")
        .withArgs([usdc.target, usdc.name(), usdc.symbol(), signer.address]);
    });
  });

  describe("Token Deploying", function () {
    it("Should not revert and deploy a wrapped token", async function () {
      const { bridge } = await loadFixture(deployBridge);
      const { usdc } = await loadFixture(deployERC20);

      const name = await usdc.name();
      const symbol = await usdc.symbol();

      expect(await bridge.deployWrappedToken(usdc.target, name, symbol)).to.not
        .be.reverted;

      expect(await bridge.createdWrappedTokens(0)).to.not.be.reverted;
      const wrappedToken = await bridge.createdWrappedTokens(0);
      expect(await bridge.wrappedTokenContracts(usdc.target)).to.equal(
        wrappedToken
      );
    });

    it("Should emit an event", async function () {
      const { bridge } = await loadFixture(deployBridge);
      const { usdc } = await loadFixture(deployERC20);

      const name = await usdc.name();
      const symbol = await usdc.symbol();

      expect(await bridge.deployWrappedToken(usdc.target, name, symbol))
        .to.emit("DeployToken")
        .withArgs([usdc.target, await bridge.createdWrappedTokens(0)]);
    });

    it("Should throw an error when token redeployment is tried", async function () {
      const { bridge } = await loadFixture(deployBridge);
      const { usdc } = await loadFixture(deployERC20);

      const name = await usdc.name();
      const symbol = await usdc.symbol();

      await bridge.deployWrappedToken(usdc.target, name, symbol);
      await expect(
        bridge.deployWrappedToken(usdc.target, name, symbol)
      ).to.be.revertedWith("Contract has an already deployed wrapper");
    });

    it("Should throw an error when not called by the owner", async function () {
      const { bridge } = await loadFixture(deployBridge);
      const { usdc, other } = await loadFixture(deployERC20);

      const name = await usdc.name();
      const symbol = await usdc.symbol();

      await expect(
        bridge.connect(other[0]).deployWrappedToken(usdc.target, name, symbol)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });

  describe("Token Locking", function () {
    it("Should not revert and lock tokens", async function () {
      const { bridge } = await loadFixture(deployBridge);
      const { usdc, signer, other } = await loadFixture(deployERC20);

      const Usdc = await ethers.getContractFactory("ERC20Token");
      const name = "Wrapped " + (await usdc.name());
      const symbol = "W" + (await usdc.symbol());
      const amount = ethers.parseEther("1");

      await usdc.mint(other[0].address, amount);
      await bridge.deployWrappedToken(usdc.target, name, symbol);
      const usdcWrapper = Usdc.attach(await bridge.createdWrappedTokens(0));

      expect(await usdcWrapper.owner()).to.equal(bridge.target);
      expect(await usdcWrapper.name()).to.equal(name);
      expect(await usdcWrapper.symbol()).to.equal(symbol);

      await usdc.connect(other[0]).approve(bridge.target, amount);

      expect(await usdc.balanceOf(other[0].address)).to.equal(amount);
      expect(await usdc.balanceOf(bridge.target)).to.equal(0);
      expect(await usdc.allowance(other[0].address, bridge.target)).to.equal(
        amount
      );

      expect(
        await bridge
          .connect(other[0])
          .lockToken(usdc.target, amount, "0x", { value: amount })
      ).to.not.be.reverted;

      expect(await usdc.balanceOf(other[0].address)).to.equal(0);
      expect(await usdc.balanceOf(bridge.target)).to.equal(amount);
      expect(await usdc.allowance(other[0].address, bridge.target)).to.equal(0);
    });

    it("Should emit an event", async function () {
      const { bridge } = await loadFixture(deployBridge);
      const { usdc, signer, other } = await loadFixture(deployERC20);

      const Usdc = await ethers.getContractFactory("ERC20Token");
      const name = "Wrapped " + (await usdc.name());
      const symbol = "W" + (await usdc.symbol());
      const amount = ethers.parseEther("1");

      await usdc.mint(other[0].address, amount);
      await bridge.deployWrappedToken(usdc.target, name, symbol);
      const usdcWrapper = Usdc.attach(await bridge.createdWrappedTokens(0));

      await usdc.connect(other[0]).approve(bridge.target, amount);
      expect(
        await bridge
          .connect(other[0])
          .lockToken(usdc.target, amount, "0x", { value: amount })
      )
        .to.emit("LockToken")
        .withArgs([usdc.target, other[0].address, 31337, amount, "0x"]);
    });

    it("Should throw an error if no wrapped is deployed", async function () {
      const { bridge } = await loadFixture(deployBridge);
      const { usdc, signer, other } = await loadFixture(deployERC20);
      const amount = ethers.parseEther("1");

      await usdc.mint(other[0].address, amount);
      await expect(
        bridge
          .connect(other[0])
          .lockToken(usdc.target, amount, "0x", { value: amount })
      ).to.be.revertedWith("Register the token before bridging it");
    });

    it("Should throw an error when bridged tokens are zero", async function () {
      const { bridge } = await loadFixture(deployBridge);
      const { usdc, signer, other } = await loadFixture(deployERC20);

      const Usdc = await ethers.getContractFactory("ERC20Token");
      const name = "Wrapped " + (await usdc.name());
      const symbol = "W" + (await usdc.symbol());
      const amount = ethers.parseEther("1");

      await usdc.mint(other[0].address, amount);
      await bridge.deployWrappedToken(usdc.target, name, symbol);
      const usdcWrapper = Usdc.attach(await bridge.createdWrappedTokens(0));

      await usdc.connect(other[0]).approve(bridge.target, amount);
      await expect(
        bridge
          .connect(other[0])
          .lockToken(usdc.target, 0, "0x", { value: amount })
      ).to.be.revertedWith("Bridged amount is required");
    });

    it("Should throw an error when sent value is less than fee", async function () {
      const { bridge } = await loadFixture(deployBridge);
      const { usdc, signer, other } = await loadFixture(deployERC20);

      const Usdc = await ethers.getContractFactory("ERC20Token");
      const name = "Wrapped " + (await usdc.name());
      const symbol = "W" + (await usdc.symbol());
      const amount = ethers.parseEther("1");

      await usdc.mint(other[0].address, amount);
      await bridge.deployWrappedToken(usdc.target, name, symbol);
      const usdcWrapper = Usdc.attach(await bridge.createdWrappedTokens(0));

      await usdc.connect(other[0]).approve(bridge.target, amount);
      await expect(
        bridge
          .connect(other[0])
          .lockToken(usdc.target, amount, "0x", { value: 0 })
      ).to.be.revertedWith("Not enough service fee");
    });
  });

  describe("Token Claiming", function () {
    it("Should allow users that have locked tokens to claim the wrapped equivalent", async function () {
      const { bridge } = await loadFixture(deployBridge);
      const { usdc, signer } = await loadFixture(deployERC20);

      const name = "Wrapped " + (await usdc.name());
      const symbol = "W" + (await usdc.symbol());
      const amount = ethers.parseEther("1");
      const nonce = 0;
      const Usdc = await ethers.getContractFactory("ERC20Token");
      const bytes = ethers.solidityPacked(
        ["address", "address", "uint256", "uint256"],
        [signer.address, signer.address, amount, nonce]
      );
      const hash = ethers.keccak256(bytes);

      const signature = await signer.signMessage(ethers.toBeArray(hash));

      await usdc.mint(signer.address, amount);
      await bridge.deployWrappedToken(usdc.target, name, symbol);
      await usdc.approve(bridge.target, amount);
      await bridge.lockToken(usdc.target, amount, signature, { value: amount });
      const usdcWrapper = Usdc.attach(await bridge.createdWrappedTokens(0));

      expect(await usdc.balanceOf(signer.address)).to.equal(0);
      expect(await usdc.balanceOf(bridge.target)).to.equal(amount);
      expect(await usdc.allowance(signer.address, bridge.target)).to.equal(0);

      expect(
        await bridge.claim(
          usdcWrapper.target,
          signer.address,
          signer.address,
          amount,
          nonce,
          signature
        )
      ).to.not.be.reverted;

      expect(await usdcWrapper.balanceOf(signer.address)).to.equal(amount);
      expect(await bridge.processedNonces(signer.address, nonce)).to.equal(
        true
      );
    });

    it("Should emit an event", async function () {
      const { bridge } = await loadFixture(deployBridge);
      const { usdc, signer } = await loadFixture(deployERC20);

      const name = "Wrapped " + (await usdc.name());
      const symbol = "W" + (await usdc.symbol());
      const amount = ethers.parseEther("1");
      const nonce = 0;
      const Usdc = await ethers.getContractFactory("ERC20Token");
      const bytes = ethers.solidityPacked(
        ["address", "address", "uint256", "uint256"],
        [signer.address, signer.address, amount, nonce]
      );
      const hash = ethers.keccak256(bytes);

      const signature = await signer.signMessage(ethers.toBeArray(hash));

      await usdc.mint(signer.address, amount);
      await bridge.deployWrappedToken(usdc.target, name, symbol);
      await usdc.approve(bridge.target, amount);
      await bridge.lockToken(usdc.target, amount, signature, { value: amount });
      const usdcWrapper = Usdc.attach(await bridge.createdWrappedTokens(0));
      const blockTimestamp = (await ethers.provider.getBlock("latest"))
        .timestamp;

      expect(
        await bridge.claim(
          usdcWrapper.target,
          signer.address,
          signer.address,
          amount,
          nonce,
          signature
        )
      )
        .to.emit("ClaimToken")
        .withArgs([
          usdcWrapper.target,
          signer.address,
          signer.address,
          31337,
          amount,
          blockTimestamp,
          nonce,
          signature,
        ]);
    });

    it("Should revert, if nonce has been processed", async function () {
      const { bridge } = await loadFixture(deployBridge);
      const { usdc, signer } = await loadFixture(deployERC20);

      const name = "Wrapped " + (await usdc.name());
      const symbol = "W" + (await usdc.symbol());
      const amount = ethers.parseEther("1");
      const nonce = 0;
      const Usdc = await ethers.getContractFactory("ERC20Token");
      const bytes = ethers.solidityPacked(
        ["address", "address", "uint256", "uint256"],
        [signer.address, signer.address, amount, nonce]
      );
      const hash = ethers.keccak256(bytes);
      const signature = await signer.signMessage(ethers.toBeArray(hash));

      await usdc.mint(signer.address, amount);
      await bridge.deployWrappedToken(usdc.target, name, symbol);
      await usdc.approve(bridge.target, amount);
      await bridge.lockToken(usdc.target, amount, signature, { value: amount });
      const usdcWrapper = Usdc.attach(await bridge.createdWrappedTokens(0));
      await bridge.claim(
        usdcWrapper.target,
        signer.address,
        signer.address,
        amount,
        nonce,
        signature
      );

      await expect(
        bridge.claim(
          usdcWrapper.target,
          signer.address,
          signer.address,
          amount,
          nonce,
          signature
        )
      ).to.be.revertedWith("transfer already processed");
    });

    it("Should revert, if signature is invalid", async function () {
      const { bridge } = await loadFixture(deployBridge);
      const { usdc, signer } = await loadFixture(deployERC20);

      const name = "Wrapped " + (await usdc.name());
      const symbol = "W" + (await usdc.symbol());
      const amount = ethers.parseEther("1");
      const nonce = 0;
      const Usdc = await ethers.getContractFactory("ERC20Token");
      const bytes = ethers.solidityPacked(
        ["address", "address", "uint256", "uint256"],
        [signer.address, signer.address, amount, nonce]
      );
      const hash = ethers.keccak256(bytes);
      const signature = await signer.signMessage(ethers.toBeArray(hash));

      await usdc.mint(signer.address, amount);
      await bridge.deployWrappedToken(usdc.target, name, symbol);
      await usdc.approve(bridge.target, amount);
      await bridge.lockToken(usdc.target, amount, signature, { value: amount });
      const usdcWrapper = Usdc.attach(await bridge.createdWrappedTokens(0));
      await bridge.claim(
        usdcWrapper.target,
        signer.address,
        signer.address,
        amount,
        nonce,
        signature
      );

      await expect(
        bridge.claim(
          usdcWrapper.target,
          signer.address,
          signer.address,
          amount,
          nonce + 1,
          signature
        )
      ).to.be.revertedWith("wrong signature");
    });
  });
});
