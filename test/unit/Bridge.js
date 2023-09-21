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
        .withArgs([usdc.target, name, symbol, signer.address]);
    });
  });

  describe("Token Deploying", function () {
    const wName = "Wrapped " + name;
    const wSymbol = "W" + symbol;
    it("Should not revert and deploy a wrapped token", async function () {
      const { bridge } = await loadFixture(deployBridge);
      const { usdc } = await loadFixture(deployERC20);

      expect(await bridge.deployWrappedToken(usdc.target, wName, wSymbol)).to
        .not.be.reverted;

      expect(await bridge.createdWrappedTokens(0)).to.not.be.reverted;

      const Usdc = await ethers.getContractFactory("ERC20PermitToken");
      const usdcWrapper = Usdc.attach(await bridge.createdWrappedTokens(0));

      expect(await bridge.wrappedTokenContracts(usdc.target)).to.equal(
        usdcWrapper.target
      );
      expect(await usdcWrapper.owner()).to.equal(bridge.target);
      expect(await usdcWrapper.name()).to.equal(wName);
      expect(await usdcWrapper.symbol()).to.equal(wSymbol);
    });

    it("Should emit an event", async function () {
      const { bridge } = await loadFixture(deployBridge);
      const { usdc } = await loadFixture(deployERC20);

      expect(await bridge.deployWrappedToken(usdc.target, wName, wSymbol))
        .to.emit("DeployToken")
        .withArgs([usdc.target, await bridge.createdWrappedTokens(0)]);
    });

    it("Should throw an error when token redeployment is tried", async function () {
      const { bridge } = await loadFixture(deployBridge);
      const { usdc } = await loadFixture(deployERC20);

      await bridge.deployWrappedToken(usdc.target, wName, wSymbol);
      await expect(
        bridge.deployWrappedToken(usdc.target, wName, wSymbol)
      ).to.be.revertedWith("Contract has an already deployed wrapper");
    });

    it("Should throw an error when not called by the owner", async function () {
      const { bridge } = await loadFixture(deployBridge);
      const { usdc, other } = await loadFixture(deployERC20);

      await expect(
        bridge.connect(other[0]).deployWrappedToken(usdc.target, wName, wSymbol)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });

  describe("Token Locking", function () {
    const wName = "Wrapped " + name;
    const wSymbol = "W" + symbol;
    // const amount = ethers.parseEther("1");
    it("Should not revert and lock tokens", async function () {
      const { bridge } = await loadFixture(deployBridge);
      const { usdc, signer } = await loadFixture(deployERC20);
      const { deadline } = await loadFixture(computeDeadline);
      const { signature } = await loadFixture(computePermitSignature);

      await bridge.deployWrappedToken(usdc.target, wName, wSymbol);

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

    it("Should emit an event", async function () {
      const { bridge } = await loadFixture(deployBridge);
      const { usdc, signer } = await loadFixture(deployERC20);
      const { deadline } = await loadFixture(computeDeadline);
      const { signature } = await loadFixture(computePermitSignature);

      await bridge.deployWrappedToken(usdc.target, wName, wSymbol);

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

    it("Should throw an error if no wrapped is deployed", async function () {
      const { bridge } = await loadFixture(deployBridge);
      const { usdc } = await loadFixture(deployERC20);
      const { deadline } = await loadFixture(computeDeadline);
      const { signature } = await loadFixture(computePermitSignature);

      await expect(
        bridge.lockToken(usdc.target, amount, deadline, signature, {
          value: amount,
        })
      ).to.be.revertedWith("Register the token before bridging it");
    });

    it("Should throw an error when bridged tokens are zero", async function () {
      const { bridge } = await loadFixture(deployBridge);
      const { usdc } = await loadFixture(deployERC20);
      const { deadline } = await loadFixture(computeDeadline);
      const { signature } = await loadFixture(computePermitSignature);

      await bridge.deployWrappedToken(usdc.target, wName, wSymbol);

      await expect(
        bridge.lockToken(usdc.target, 0, deadline, signature, { value: amount })
      ).to.be.revertedWith("Bridged amount is required");
    });

    it("Should throw an error when sent value is less than fee", async function () {
      const { bridge } = await loadFixture(deployBridge);
      const { usdc } = await loadFixture(deployERC20);
      const { deadline } = await loadFixture(computeDeadline);
      const { signature } = await loadFixture(computePermitSignature);

      await bridge.deployWrappedToken(usdc.target, wName, wSymbol);

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
      const { usdc, signer } = await loadFixture(deployERC20);
      const { deadline } = await loadFixture(computeDeadline);
      const { signature } = await loadFixture(computePermitSignature);
      const Usdc = await ethers.getContractFactory("ERC20Token");

      const bytes = ethers.solidityPacked(
        ["address", "address", "uint256", "uint256", "uint256"],
        [signer.address, signer.address, amount, deadline, nonce]
      );
      const hash = ethers.keccak256(bytes);
      const sig = await signer.signMessage(ethers.toBeArray(hash));

      await bridge.deployWrappedToken(usdc.target, wName, wSymbol);
      await bridge.lockToken(usdc.target, amount, deadline, signature, {
        value: amount,
      });
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
          deadline,
          nonce,
          sig
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
      const { deadline } = await loadFixture(computeDeadline);
      const { signature } = await loadFixture(computePermitSignature);
      const Usdc = await ethers.getContractFactory("ERC20Token");

      const bytes = ethers.solidityPacked(
        ["address", "address", "uint256", "uint256", "uint256"],
        [signer.address, signer.address, amount, deadline, nonce]
      );
      const hash = ethers.keccak256(bytes);
      const sig = await signer.signMessage(ethers.toBeArray(hash));

      await bridge.deployWrappedToken(usdc.target, wName, wSymbol);
      await bridge.lockToken(usdc.target, amount, deadline, signature, {
        value: amount,
      });
      const usdcWrapper = Usdc.attach(await bridge.createdWrappedTokens(0));

      expect(
        await bridge.claim(
          usdcWrapper.target,
          signer.address,
          signer.address,
          amount,
          deadline,
          nonce,
          sig
        )
      )
        .to.emit("ClaimToken")
        .withArgs([
          usdcWrapper.target,
          signer.address,
          signer.address,
          31337,
          amount,
          deadline,
          nonce,
          signature,
        ]);
    });

    it("Should not revert if an EOA sends a valid signature", async function () {
      const { bridge } = await loadFixture(deployBridge);
      const { usdc, signer, other } = await loadFixture(deployERC20);
      const { deadline } = await loadFixture(computeDeadline);
      const { signature } = await loadFixture(computePermitSignature);
      const Usdc = await ethers.getContractFactory("ERC20Token");

      const bytes = ethers.solidityPacked(
        ["address", "address", "uint256", "uint256", "uint256"],
        [signer.address, signer.address, amount, deadline, nonce]
      );
      const hash = ethers.keccak256(bytes);
      const sig = await signer.signMessage(ethers.toBeArray(hash));
      // const invalidSig = await other[0].signMessage(ethers.toBeArray(hash));

      await bridge.deployWrappedToken(usdc.target, wName, wSymbol);
      await bridge.lockToken(usdc.target, amount, deadline, signature, {
        value: amount,
      });
      const usdcWrapper = Usdc.attach(await bridge.createdWrappedTokens(0));

      await expect(
        bridge
          .connect(other[0])
          .claim(
            usdcWrapper.target,
            signer.address,
            signer.address,
            amount,
            deadline,
            nonce,
            sig
          )
      ).not.to.be.reverted;
    });

    it("Should revert, if nonce has been processed", async function () {
      const { bridge } = await loadFixture(deployBridge);
      const { usdc, signer } = await loadFixture(deployERC20);
      const { deadline } = await loadFixture(computeDeadline);
      const { signature } = await loadFixture(computePermitSignature);
      const Usdc = await ethers.getContractFactory("ERC20Token");

      const bytes = ethers.solidityPacked(
        ["address", "address", "uint256", "uint256", "uint256"],
        [signer.address, signer.address, amount, deadline, nonce]
      );
      const hash = ethers.keccak256(bytes);
      const sig = await signer.signMessage(ethers.toBeArray(hash));

      await bridge.deployWrappedToken(usdc.target, wName, wSymbol);
      await bridge.lockToken(usdc.target, amount, deadline, signature, {
        value: amount,
      });
      const usdcWrapper = Usdc.attach(await bridge.createdWrappedTokens(0));

      await bridge.claim(
        usdcWrapper.target,
        signer.address,
        signer.address,
        amount,
        deadline,
        nonce,
        sig
      );

      await expect(
        bridge.claim(
          usdcWrapper.target,
          signer.address,
          signer.address,
          amount,
          deadline,
          nonce,
          sig
        )
      ).to.be.revertedWith("transfer already processed");
    });

    it("Should revert, if signature is invalid", async function () {
      const { bridge } = await loadFixture(deployBridge);
      const { usdc, signer } = await loadFixture(deployERC20);
      const { deadline } = await loadFixture(computeDeadline);
      const { signature } = await loadFixture(computePermitSignature);
      const Usdc = await ethers.getContractFactory("ERC20Token");

      const bytes = ethers.solidityPacked(
        ["address", "address", "uint256", "uint256", "uint256"],
        [signer.address, signer.address, amount, deadline, nonce]
      );
      const hash = ethers.keccak256(bytes);
      const sig = await signer.signMessage(ethers.toBeArray(hash));

      await bridge.deployWrappedToken(usdc.target, wName, wSymbol);
      await bridge.lockToken(usdc.target, amount, deadline, signature, {
        value: amount,
      });
      const usdcWrapper = Usdc.attach(await bridge.createdWrappedTokens(0));

      await bridge.claim(
        usdcWrapper.target,
        signer.address,
        signer.address,
        amount,
        deadline,
        nonce,
        sig
      );

      await expect(
        bridge.claim(
          usdcWrapper.target,
          signer.address,
          signer.address,
          amount,
          deadline,
          nonce + 1,
          sig
        )
      ).to.be.revertedWith("wrong signature");
    });

    it("Should revert, if claimed amount is more than the approved", async function () {
      const { bridge } = await loadFixture(deployBridge);
      const { usdc, signer } = await loadFixture(deployERC20);
      const { deadline } = await loadFixture(computeDeadline);
      const { signature } = await loadFixture(computePermitSignature);
      const Usdc = await ethers.getContractFactory("ERC20Token");
      const extra = ethers.formatUnits(1, "wei");

      const bytes = ethers.solidityPacked(
        ["address", "address", "uint256", "uint256", "uint256"],
        [signer.address, signer.address, amount + extra, deadline, nonce]
      );
      const hash = ethers.keccak256(bytes);
      const sig = await signer.signMessage(ethers.toBeArray(hash));

      await bridge.deployWrappedToken(usdc.target, wName, wSymbol);
      await bridge.lockToken(usdc.target, amount, deadline, signature, {
        value: amount,
      });
      const usdcWrapper = Usdc.attach(await bridge.createdWrappedTokens(0));

      expect(
        await bridge.claim(
          usdcWrapper.target,
          signer.address,
          signer.address,
          amount + extra,
          deadline,
          nonce,
          sig
        )
      ).to.be.revertedWith("wrong signature");
    });

    it("Should revert, if signature has invalid length", async function () {
      const { bridge } = await loadFixture(deployBridge);
      const { usdc, signer } = await loadFixture(deployERC20);
      const { deadline } = await loadFixture(computeDeadline);
      const { signature } = await loadFixture(computePermitSignature);
      const Usdc = await ethers.getContractFactory("ERC20Token");

      const bytes = ethers.solidityPacked(
        ["address", "address", "uint256", "uint256", "uint256"],
        [signer.address, signer.address, amount, deadline, nonce]
      );
      const hash = ethers.keccak256(bytes);
      const sig = (await signer.signMessage(ethers.toBeArray(hash))) + "1c";

      await bridge.deployWrappedToken(usdc.target, wName, wSymbol);
      await bridge.lockToken(usdc.target, amount, deadline, signature, {
        value: amount,
      });
      const usdcWrapper = Usdc.attach(await bridge.createdWrappedTokens(0));

      await expect(
        bridge.claim(
          usdcWrapper.target,
          signer.address,
          signer.address,
          amount,
          deadline,
          nonce,
          sig
        )
      ).to.be.reverted;
    });
  });

  describe("Token Burning", function () {
    const wName = "Wrapped " + name;
    const wSymbol = "W" + symbol;
    const nonce = 0;

    it("Should allow users to burn their wrapped tokens", async function () {
      const { bridge } = await loadFixture(deployBridge);
      const { usdc, signer } = await loadFixture(deployERC20);
      const { deadline } = await loadFixture(computeDeadline);
      const { signature } = await loadFixture(computePermitSignature);
      const Usdc = await ethers.getContractFactory("ERC20Token");

      const bytes = ethers.solidityPacked(
        ["address", "address", "uint256", "uint256", "uint256"],
        [signer.address, signer.address, amount, deadline, nonce]
      );
      const hash = ethers.keccak256(bytes);
      const sig = await signer.signMessage(ethers.toBeArray(hash));

      await bridge.deployWrappedToken(usdc.target, wName, wSymbol);
      await bridge.lockToken(usdc.target, amount, deadline, signature, {
        value: amount,
      });
      const usdcWrapper = Usdc.attach(await bridge.createdWrappedTokens(0));

      await bridge.claim(
        usdcWrapper.target,
        signer.address,
        signer.address,
        amount,
        deadline,
        nonce,
        sig
      );

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
      const { deadline } = await loadFixture(computeDeadline);
      const { signature } = await loadFixture(computePermitSignature);
      const Usdc = await ethers.getContractFactory("ERC20Token");

      const bytes = ethers.solidityPacked(
        ["address", "address", "uint256", "uint256", "uint256"],
        [signer.address, signer.address, amount, deadline, nonce]
      );
      const hash = ethers.keccak256(bytes);
      const sig = await signer.signMessage(ethers.toBeArray(hash));

      await bridge.deployWrappedToken(usdc.target, wName, wSymbol);
      await bridge.lockToken(usdc.target, amount, deadline, signature, {
        value: amount,
      });
      const usdcWrapper = Usdc.attach(await bridge.createdWrappedTokens(0));

      await bridge.claim(
        usdcWrapper.target,
        signer.address,
        signer.address,
        amount,
        deadline,
        nonce,
        sig
      );

      const blockTimestamp = (await ethers.provider.getBlock("latest"))
        .timestamp;

      expect(await bridge.burn(usdcWrapper.target, amount, nonce + 1))
        .to.emit("BurnToken")
        .withArgs([
          usdcWrapper.target,
          signer.address,
          31337,
          amount,
          blockTimestamp,
          nonce + 1,
        ]);
    });

    it("Should revert, if nonce has been processed", async function () {
      const { bridge } = await loadFixture(deployBridge);
      const { usdc, signer } = await loadFixture(deployERC20);
      const { deadline } = await loadFixture(computeDeadline);
      const { signature } = await loadFixture(computePermitSignature);
      const Usdc = await ethers.getContractFactory("ERC20Token");

      const bytes = ethers.solidityPacked(
        ["address", "address", "uint256", "uint256", "uint256"],
        [signer.address, signer.address, amount, deadline, nonce]
      );
      const hash = ethers.keccak256(bytes);
      const sig = await signer.signMessage(ethers.toBeArray(hash));

      await bridge.deployWrappedToken(usdc.target, wName, wSymbol);
      await bridge.lockToken(usdc.target, amount, deadline, signature, {
        value: amount,
      });
      const usdcWrapper = Usdc.attach(await bridge.createdWrappedTokens(0));

      await bridge.claim(
        usdcWrapper.target,
        signer.address,
        signer.address,
        amount,
        deadline,
        nonce,
        sig
      );

      await expect(
        bridge.burn(usdcWrapper.target, amount, nonce)
      ).to.be.revertedWith("transfer already processed");
    });
  });

  describe("Token Releasing", function () {
    const wName = "Wrapped " + name;
    const wSymbol = "W" + symbol;
    const nonce = 0;

    it("Should return the originally locked tokens to the user", async function () {
      const { bridge } = await loadFixture(deployBridge);
      const { usdc, signer } = await loadFixture(deployERC20);
      const { deadline } = await loadFixture(computeDeadline);
      const { signature } = await loadFixture(computePermitSignature);
      const Usdc = await ethers.getContractFactory("ERC20Token");

      const bytes = ethers.solidityPacked(
        ["address", "address", "uint256", "uint256", "uint256"],
        [signer.address, signer.address, amount, deadline, nonce]
      );
      const hash = ethers.keccak256(bytes);
      const sig = await signer.signMessage(ethers.toBeArray(hash));

      await bridge.deployWrappedToken(usdc.target, wName, wSymbol);
      await bridge.lockToken(usdc.target, amount, deadline, signature, {
        value: amount,
      });
      const usdcWrapper = Usdc.attach(await bridge.createdWrappedTokens(0));

      await bridge.claim(
        usdcWrapper.target,
        signer.address,
        signer.address,
        amount,
        deadline,
        nonce,
        sig
      );
      await bridge.burn(usdcWrapper.target, amount, nonce + 1);

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
      const Usdc = await ethers.getContractFactory("ERC20Token");

      const bytes = ethers.solidityPacked(
        ["address", "address", "uint256", "uint256", "uint256"],
        [signer.address, signer.address, amount, deadline, nonce]
      );
      const hash = ethers.keccak256(bytes);
      const sig = await signer.signMessage(ethers.toBeArray(hash));

      await bridge.deployWrappedToken(usdc.target, wName, wSymbol);
      await bridge.lockToken(usdc.target, amount, deadline, signature, {
        value: amount,
      });
      const usdcWrapper = Usdc.attach(await bridge.createdWrappedTokens(0));

      await bridge.claim(
        usdcWrapper.target,
        signer.address,
        signer.address,
        amount,
        deadline,
        nonce,
        sig
      );
      await bridge.burn(usdcWrapper.target, amount, nonce + 1);

      expect(await bridge.release(usdc.target, signer.address, amount))
        .to.emit("ReleaseToken")
        .withArgs([usdc.target, signer.address, amount]);
    });

    it("Should revert, if not owner calls it", async function () {
      const { bridge } = await loadFixture(deployBridge);
      const { usdc, signer, other } = await loadFixture(deployERC20);
      const { deadline } = await loadFixture(computeDeadline);
      const { signature } = await loadFixture(computePermitSignature);
      const Usdc = await ethers.getContractFactory("ERC20Token");

      const bytes = ethers.solidityPacked(
        ["address", "address", "uint256", "uint256", "uint256"],
        [signer.address, signer.address, amount, deadline, nonce]
      );
      const hash = ethers.keccak256(bytes);
      const sig = await signer.signMessage(ethers.toBeArray(hash));

      await bridge.deployWrappedToken(usdc.target, wName, wSymbol);
      await bridge.lockToken(usdc.target, amount, deadline, signature, {
        value: amount,
      });
      const usdcWrapper = Usdc.attach(await bridge.createdWrappedTokens(0));

      await bridge.claim(
        usdcWrapper.target,
        signer.address,
        signer.address,
        amount,
        deadline,
        nonce,
        sig
      );
      await bridge.burn(usdcWrapper.target, amount, nonce + 1);

      await expect(
        bridge.connect(other[0]).release(usdc.target, signer.address, amount)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });
});
