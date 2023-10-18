// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

interface IBridge {
    function lock(
        address _token,
        uint256 _amount,
        uint256 deadline,
        bytes calldata _signature
    ) external payable;

    function release(
        address _token,
        address _to,
        uint256 _amount,
        uint256 _nonce,
        bytes calldata _signature
    ) external;

    function burn(address _token, uint256 _amount, uint _nonce) external;

    function claim(
        address _token,
        string calldata _name,
        string calldata _symbol,
        address _from,
        address _to,
        uint _amount,
        uint _nonce,
        bytes calldata _signature
    ) external;
}
