// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import {ERC20Permit, ERC20} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title An ERC20Permit contract
 * @author Georgi Chonkov
 * @notice You can use this contract for basic simulations
 */
contract ERC20PermitToken is ERC20Permit, Ownable {
    event ERC20PermitTokenMinted(address, uint256);
    event ERC20PermitTokenBurned(address, uint256);

    /**
     *  @notice {EIP2612} `name` and {EIP20} `name` MUST be the same
     *  @dev Initializes the {EIP2612} `name` and {EIP20} `name` & `symbol`
     */
    constructor(
        string memory name,
        string memory symbol
    ) ERC20Permit(name) ERC20(name, symbol) {
        transferOwnership(_msgSender());
    }

    function mint(address to, uint amount) external onlyOwner {
        _mint(to, amount);
        emit ERC20PermitTokenMinted(to, amount);
    }

    function burn(address to, uint amount) external onlyOwner {
        _burn(to, amount);
        emit ERC20PermitTokenBurned(to, amount);
    }
}
