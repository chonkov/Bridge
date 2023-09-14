// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

interface IBridge {
    function registerToken(address _token) external;

    function deployWrappedToken(
        address _token,
        string memory _name,
        string memory _symbol
    ) external;

    function lockToken(
        address _token,
        uint256 _amount,
        uint256 deadline,
        bytes calldata _signature
    ) external payable;

    function release(address _token, address _to, uint256 _amount) external;

    function burn(address _token, uint256 _amount, uint _nonce) external;

    function claim(
        address _token,
        address from,
        address to,
        uint amount,
        uint deadline,
        uint nonce,
        bytes calldata signature
    ) external;
}
