// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20Token} from "./interfaces/IERC20Token.sol";

contract ERC20Token is IERC20Token, Ownable, ERC20 {
    event ERC20TokenMinted(address, uint256);
    event ERC20TokenBurned(address, uint256);

    constructor(
        string memory _name,
        string memory _symbol,
        address _owner
    ) ERC20(_name, _symbol) {
        transferOwnership(_owner);
        // _mint(owner(), 1000 * 10 ** 18);
    }

    function mint(address to, uint amount) external onlyOwner {
        _mint(to, amount);
        emit ERC20TokenMinted(to, amount);
    }

    function burn(address to, uint amount) external onlyOwner {
        _burn(to, amount);
        emit ERC20TokenBurned(to, amount);
    }
}
