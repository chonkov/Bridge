// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "../ERC20Token.sol";

interface IETHWrapper {
    function initiateToken(
        string memory,
        string memory
    ) external returns (ERC20Token);

    function approve(address, address, uint256) external;

    function registerToken(
        address sourceTokenAddress,
        address currentTokenAddress
    ) external;
}
