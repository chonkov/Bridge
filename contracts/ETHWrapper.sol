// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/IETHWrapper.sol";
import "./ERC20Token.sol";

contract ETHWrapper is Ownable, IETHWrapper {
    mapping(address => ERC20Token) public wrappedTokenContracts;
    // mapping(address => address) public savedTokens;
    address[] public createdWrappedTokens;

    event ETHApproved(address spender, uint256 amount);
    event ETHRegistered(
        address sourceTokenAddress,
        address currentTokenAddress
    );
    event ETHTokenCreated(
        address indexed contractAddr,
        string name,
        string symbol
    );

    function initiateToken(
        string memory _name,
        string memory _symbol
    ) external override onlyOwner returns (ERC20Token wrappedToken) {
        ERC20Token ercToken = new ERC20Token(_name, _symbol, msg.sender);
        wrappedTokenContracts[address(ercToken)] = ercToken;
        createdWrappedTokens.push(address(ercToken));
        emit ETHTokenCreated(address(ercToken), _name, _symbol);
        return ercToken;
    }

    function approve(
        address tokenAddress,
        address spender,
        uint256 amount
    ) public override {
        wrappedTokenContracts[tokenAddress].approve(spender, amount);
        emit ETHApproved(spender, amount);
    }

    function registerToken(
        address sourceTokenAddress,
        address currentTokenAddress
    ) external override {
        // savedTokens[sourceTokenAddress] = currentTokenAddress;
        emit ETHRegistered(sourceTokenAddress, currentTokenAddress);
    }

    function increaseAllowance(
        address tokenAddress,
        address spender,
        uint256 addedValue
    ) public {
        wrappedTokenContracts[tokenAddress].increaseAllowance(
            spender,
            addedValue
        );
    }

    function balanceOf(
        address tokenAddress,
        address owner
    ) public view returns (uint256) {
        return wrappedTokenContracts[tokenAddress].balanceOf(owner);
    }

    function getTokens() public view returns (address[] memory) {
        return createdWrappedTokens;
    }
}
