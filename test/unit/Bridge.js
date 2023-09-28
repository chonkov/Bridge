const {
  loadFixture,
} = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { expect } = require("chai");
const { ethers } = require("hardhat");
const { getPermitSignature } = require("../../utils/getPermitSignature");

describe("Bridge", function () {
  const name = "USD Coin";
  const symbol = "USDC";
  const amount = ethers.parseEther("1");

  async function deployERC20() {
    const [signer, ...other] = await ethers.getSigners();

    const usdc = await ethers.deployContract("ERC20PermitToken", [
      name,
      symbol,
      //   signer.address,
    ]);
    await usdc.waitForDeployment();
    await usdc.mint(signer.address, amount);

    return { usdc, signer, other };
  }

  async function deployBridge() {
    const bridge = await ethers.deployContract("Bridge");
    await bridge.waitForDeployment();

    return { bridge };
  }

  async function computeDeadline() {
    const blockTimestamp = (await ethers.provider.getBlock("latest")).timestamp;
    const deadline = blockTimestamp + 3600;

    return { deadline };
  }

  async function computePermitSignature() {
    const { bridge } = await loadFixture(deployBridge);
    const { usdc } = await loadFixture(deployERC20);
    const { deadline } = await loadFixture(computeDeadline);
    const [signer] = await ethers.getSigners();

    const signature = await getPermitSignature(
      signer,
      usdc,
      bridge.target,
      amount,
      deadline
    );

    return { signature };
  }

  describe("Deployment", function () {
    it("Should deploy successfully & set constants", async function () {
      const { bridge } = await loadFixture(deployBridge);

      const fee = ethers.parseEther("0.01");
      const sourceChainId = 31337;

      expect(await bridge.SERVICE_FEE()).to.equal(fee);
      expect(await bridge.SOURCE_CHAIN_ID()).to.equal(sourceChainId);
    });
  });

  describe("Token Locking", function () {
    const wName = "Wrapped " + name;
    const wSymbol = "W" + symbol;

    it("Should not revert and lock tokens", async function () {
      const { bridge } = await loadFixture(deployBridge);
      const { usdc, signer } = await loadFixture(deployERC20);
      const { deadline } = await loadFixture(computeDeadline);
      const { signature } = await loadFixture(computePermitSignature);

      expect(await usdc.balanceOf(signer.address)).to.equal(amount);
      expect(await usdc.balanceOf(bridge.target)).to.equal(0);

      expect(
        await bridge.lockToken(usdc.target, amount, deadline, signature, {
          value: amount,
        })
      ).to.not.be.reverted;

      expect(await usdc.balanceOf(signer.address)).to.equal(0);
      expect(await usdc.balanceOf(bridge.target)).to.equal(amount);
      expect(await usdc.allowance(signer.address, bridge.target)).to.equal(0);
    });

    it("Should emit a 'LockToken' event", async function () {
      const { bridge } = await loadFixture(deployBridge);
      const { usdc, signer } = await loadFixture(deployERC20);
      const { deadline } = await loadFixture(computeDeadline);
      const { signature } = await loadFixture(computePermitSignature);

      expect(
        await bridge.lockToken(usdc.target, amount, deadline, signature, {
          value: amount,
        })
      )
        .to.emit("LockToken")
        .withArgs([
          usdc.target,
          signer.address,
          31337,
          amount,
          deadline,
          signature,
        ]);
    });

    it("Should throw an error when bridged tokens are zero", async function () {
      const { bridge } = await loadFixture(deployBridge);
      const { usdc } = await loadFixture(deployERC20);
      const { deadline } = await loadFixture(computeDeadline);
      const { signature } = await loadFixture(computePermitSignature);

      await expect(
        bridge.lockToken(usdc.target, 0, deadline, signature, { value: amount })
      ).to.be.revertedWith("Bridged amount is required");
    });

    it("Should throw an error when sent value is less than fee", async function () {
      const { bridge } = await loadFixture(deployBridge);
      const { usdc } = await loadFixture(deployERC20);
      const { deadline } = await loadFixture(computeDeadline);
      const { signature } = await loadFixture(computePermitSignature);

      await expect(
        bridge.lockToken(usdc.target, amount, deadline, signature, { value: 0 })
      ).to.be.revertedWith("Not enough service fee");
    });
  });

  describe("Token Claiming", function () {
    const wName = "Wrapped " + name;
    const wSymbol = "W" + symbol;
    const nonce = 0;

    it("Should allow users that have locked tokens to claim the wrapped equivalent", async function () {
      const { bridge } = await loadFixture(deployBridge);
      const { usdc, signer, other } = await loadFixture(deployERC20);
      const { deadline } = await loadFixture(computeDeadline);
      const { signature } = await loadFixture(computePermitSignature);
      const Usdc = await ethers.getContractFactory("ERC20Token");

      const bytes = ethers.solidityPacked(
        ["address", "address", "uint256", "uint256"],
        [signer.address, signer.address, amount, nonce]
      );
      const hash = ethers.keccak256(bytes);
      const sig = await signer.signMessage(ethers.toBeArray(hash));

      await bridge.lockToken(usdc.target, amount, deadline, signature, {
        value: amount,
      });

      expect(await usdc.balanceOf(signer.address)).to.equal(0);
      expect(await usdc.balanceOf(bridge.target)).to.equal(amount);
      expect(await usdc.allowance(signer.address, bridge.target)).to.equal(0);

      expect(
        await bridge.claim(
          usdc.target,
          wName,
          wSymbol,
          signer.address,
          signer.address,
          amount,
          nonce,
          sig
        )
      ).to.not.be.reverted;

      const usdcWrapper = Usdc.attach(await bridge.createdWrappedTokens(0));

      expect(await usdcWrapper.balanceOf(signer.address)).to.equal(amount);
      expect(await bridge.processedNonces(signer.address, nonce)).to.equal(
        true
      );
    });

    it("Should emit a 'ClaimToken' event", async function () {
      const { bridge } = await loadFixture(deployBridge);
      const { usdc, signer } = await loadFixture(deployERC20);

      const bytes = ethers.solidityPacked(
        ["address", "address", "uint256", "uint256"],
        [signer.address, signer.address, amount, nonce]
      );
      const hash = ethers.keccak256(bytes);
      const sig = await signer.signMessage(ethers.toBeArray(hash));

      await expect(
        bridge.claim(
          usdc.target,
          wName,
          wSymbol,
          signer.address,
          signer.address,
          amount,
          nonce,
          sig
        )
      )
        .to.emit(bridge, "ClaimToken")
        .withArgs(
          usdc.target,
          signer.address,
          signer.address,
          31337,
          amount,
          nonce,
          sig
        );
    });

    it("Should emit a 'DeployToken' event", async function () {
      const { bridge } = await loadFixture(deployBridge);
      const { usdc, signer } = await loadFixture(deployERC20);

      const bytes = ethers.solidityPacked(
        ["address", "address", "uint256", "uint256"],
        [signer.address, signer.address, amount, nonce]
      );
      const hash = ethers.keccak256(bytes);
      const sig = await signer.signMessage(ethers.toBeArray(hash));

      await expect(
        bridge.claim(
          usdc.target,
          wName,
          wSymbol,
          signer.address,
          signer.address,
          amount,
          nonce,
          sig
        )
      )
        .to.emit(bridge, "DeployToken")
        .withArgs(
          signer.address,
          usdc.target,
          "0xa16E02E87b7454126E5E10d957A927A7F5B5d2be",
          wName,
          wSymbol
        );
    });

    it("Should not revert if an EOA sends a valid signature", async function () {
      const { bridge } = await loadFixture(deployBridge);
      const { usdc, signer, other } = await loadFixture(deployERC20);

      const bytes = ethers.solidityPacked(
        ["address", "address", "uint256", "uint256"],
        [signer.address, signer.address, amount, nonce]
      );
      const hash = ethers.keccak256(bytes);
      const sig = await signer.signMessage(ethers.toBeArray(hash));

      await expect(
        bridge
          .connect(other[0])
          .claim(
            usdc.target,
            wName,
            wSymbol,
            signer.address,
            signer.address,
            amount,
            nonce,
            sig
          )
      ).not.to.be.reverted;
    });

    it("Should revert, if nonce has been processed", async function () {
      const { bridge } = await loadFixture(deployBridge);
      const { usdc, signer } = await loadFixture(deployERC20);

      const bytes = ethers.solidityPacked(
        ["address", "address", "uint256", "uint256"],
        [signer.address, signer.address, amount, nonce]
      );
      const hash = ethers.keccak256(bytes);
      const sig = await signer.signMessage(ethers.toBeArray(hash));

      await bridge.claim(
        usdc.target,
        wName,
        wSymbol,
        signer.address,
        signer.address,
        amount,
        nonce,
        sig
      );

      await expect(
        bridge.claim(
          usdc.target,
          wName,
          wSymbol,
          signer.address,
          signer.address,
          amount,
          nonce,
          sig
        )
      ).to.be.revertedWith("transfer already processed");
    });

    it("Should revert, if signature is invalid", async function () {
      const { bridge } = await loadFixture(deployBridge);
      const { usdc, signer } = await loadFixture(deployERC20);

      const bytes = ethers.solidityPacked(
        ["address", "address", "uint256", "uint256"],
        [signer.address, signer.address, amount, nonce]
      );
      const hash = ethers.keccak256(bytes);
      const sig = await signer.signMessage(ethers.toBeArray(hash));

      await bridge.claim(
        usdc.target,
        wName,
        wSymbol,
        signer.address,
        signer.address,
        amount,
        nonce,
        sig
      );

      await expect(
        bridge.claim(
          usdc.target,
          wName,
          wSymbol,
          signer.address,
          signer.address,
          amount,
          nonce + 1,
          sig
        )
      ).to.be.revertedWith("wrong signature");
    });

    it("Should revert, if signature has invalid length", async function () {
      const { bridge } = await loadFixture(deployBridge);
      const { usdc, signer } = await loadFixture(deployERC20);

      const bytes = ethers.solidityPacked(
        ["address", "address", "uint256", "uint256"],
        [signer.address, signer.address, amount, nonce]
      );
      const hash = ethers.keccak256(bytes);
      const sig = (await signer.signMessage(ethers.toBeArray(hash))) + "00";

      await expect(
        bridge.claim(
          usdc.target,
          wName,
          wSymbol,
          signer.address,
          signer.address,
          amount,
          nonce,
          sig
        )
      ).to.be.revertedWith("invalid signature length");
    });
  });

  describe("Token Burning", function () {
    const wName = "Wrapped " + name;
    const wSymbol = "W" + symbol;
    const nonce = 0;

    it("Should allow users to burn their wrapped tokens", async function () {
      const { bridge } = await loadFixture(deployBridge);
      const { usdc, signer } = await loadFixture(deployERC20);
      const Usdc = await ethers.getContractFactory("ERC20Token");

      const bytes = ethers.solidityPacked(
        ["address", "address", "uint256", "uint256"],
        [signer.address, signer.address, amount, nonce]
      );
      const hash = ethers.keccak256(bytes);
      const sig = await signer.signMessage(ethers.toBeArray(hash));

      await bridge.claim(
        usdc.target,
        wName,
        wSymbol,
        signer.address,
        signer.address,
        amount,
        nonce,
        sig
      );

      const usdcWrapper = Usdc.attach(await bridge.createdWrappedTokens(0));

      expect(await bridge.burn(usdcWrapper.target, amount, nonce + 1)).to.not.be
        .reverted;

      expect(await usdcWrapper.balanceOf(signer.address)).to.equal(0);
      expect(await bridge.processedNonces(signer.address, nonce + 1)).to.equal(
        true
      );
    });

    it("Should emit an event", async function () {
      const { bridge } = await loadFixture(deployBridge);
      const { usdc, signer } = await loadFixture(deployERC20);
      const Usdc = await ethers.getContractFactory("ERC20Token");

      const bytes = ethers.solidityPacked(
        ["address", "address", "uint256", "uint256"],
        [signer.address, signer.address, amount, nonce]
      );
      const hash = ethers.keccak256(bytes);
      const sig = await signer.signMessage(ethers.toBeArray(hash));

      await bridge.claim(
        usdc.target,
        wName,
        wSymbol,
        signer.address,
        signer.address,
        amount,
        nonce,
        sig
      );

      const usdcWrapper = Usdc.attach(await bridge.createdWrappedTokens(0));

      await expect(bridge.burn(usdcWrapper.target, amount, nonce + 1))
        .to.emit(bridge, "BurnToken")
        .withArgs(usdcWrapper.target, signer.address, 31337, amount, nonce + 1);
    });

    it("Should revert, if nonce has been processed", async function () {
      const { bridge } = await loadFixture(deployBridge);
      const { usdc, signer } = await loadFixture(deployERC20);
      const Usdc = await ethers.getContractFactory("ERC20Token");

      const bytes = ethers.solidityPacked(
        ["address", "address", "uint256", "uint256"],
        [signer.address, signer.address, amount, nonce]
      );
      const hash = ethers.keccak256(bytes);
      const sig = await signer.signMessage(ethers.toBeArray(hash));

      await bridge.claim(
        usdc.target,
        wName,
        wSymbol,
        signer.address,
        signer.address,
        amount,
        nonce,
        sig
      );

      const usdcWrapper = Usdc.attach(await bridge.createdWrappedTokens(0));

      await expect(
        bridge.burn(usdcWrapper.target, amount, nonce)
      ).to.be.revertedWith("transfer already processed");
    });
  });

  describe("Token Releasing", function () {
    it("Should return the originally locked tokens to the user", async function () {
      const { bridge } = await loadFixture(deployBridge);
      const { usdc, signer } = await loadFixture(deployERC20);
      const { deadline } = await loadFixture(computeDeadline);
      const { signature } = await loadFixture(computePermitSignature);
      await bridge.lockToken(usdc.target, amount, deadline, signature, {
        value: amount,
      });

      expect(await bridge.release(usdc.target, signer.address, amount)).to.not
        .be.reverted;

      expect(await usdc.balanceOf(signer.address)).to.equal(amount);
      expect(await usdc.balanceOf(bridge.target)).to.equal(0);
    });

    it("Should emit an event", async function () {
      const { bridge } = await loadFixture(deployBridge);
      const { usdc, signer } = await loadFixture(deployERC20);
      const { deadline } = await loadFixture(computeDeadline);
      const { signature } = await loadFixture(computePermitSignature);
      await bridge.lockToken(usdc.target, amount, deadline, signature, {
        value: amount,
      });

      await expect(bridge.release(usdc.target, signer.address, amount))
        .to.emit(bridge, "ReleaseToken")
        .withArgs(usdc.target, signer.address, amount);
    });

    it("Should revert, if not owner calls it", async function () {
      const { bridge } = await loadFixture(deployBridge);
      const { usdc, signer, other } = await loadFixture(deployERC20);
      const { deadline } = await loadFixture(computeDeadline);
      const { signature } = await loadFixture(computePermitSignature);
      await bridge.lockToken(usdc.target, amount, deadline, signature, {
        value: amount,
      });

      await expect(
        bridge.connect(other[0]).release(usdc.target, signer.address, amount)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });
});
