//SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20, IERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import {ERC20Token, IERC20Token} from "./ERC20Token.sol";
import {IBridge} from "./interfaces/IBridge.sol";

contract Bridge is IBridge, Ownable {
    uint256 public constant SERVICE_FEE = 0.01 ether;
    uint256 public constant SOURCE_CHAIN_ID = 11155111; // SEPOLIA
    uint256 public constant TARGET_CHAIN_ID = 80001; // MUMBAI

    mapping(address => mapping(uint => bool)) public processedNonces;
    mapping(address => ERC20Token) public wrappedTokenContracts;
    address[] public createdWrappedTokens;

    event RegisterToken(
        address indexed token,
        string name,
        string symbol,
        address from
    );

    event DeployToken(address indexed source, address indexed wrapper);

    event BurnToken(
        address token,
        address from,
        uint256 chainId,
        uint amount,
        uint date,
        uint nonce
    );

    event LockToken(
        address token,
        address from,
        uint256 chainId,
        uint amount,
        bytes signature
    );

    event ClaimToken(
        address token,
        address from,
        address to,
        uint chainId,
        uint amount,
        uint date,
        uint nonce,
        bytes signature
    );

    event ReleaseToken(address token, address to, uint amount);

    // Add a new token that is unknown up to this point
    function registerToken(address _token) external /* onlyOwner */ {
        // Add additional checks, if the token has already been wrapped on the other chain
        // if (block.chainid == SOURCE_CHAIN_ID) {
        string memory _name = ERC20Token(_token).name();
        string memory _symbol = ERC20Token(_token).symbol();

        emit RegisterToken(_token, _name, _symbol, msg.sender);
        // }
    }

    function deployWrappedToken(
        address _token,
        string memory _name,
        string memory _symbol
    ) external onlyOwner {
        if (
            // block.chainid == TARGET_CHAIN_ID &&
            wrappedTokenContracts[_token] != ERC20Token(address(0))
        ) {
            revert("Contract has an already deployed wrapper");
        }
        ERC20Token ercToken = new ERC20Token(_name, _symbol, address(this));
        wrappedTokenContracts[_token] = ercToken;
        createdWrappedTokens.push(address(ercToken));

        emit DeployToken(_token, address(ercToken));
    }

    // Optional - Brigde will have to pay fees and for txs to update mapping
    // function update(address sourceAddr, address targetAddr) external onlyOwner {
    //     wrappedTokenContracts[sourceAddr] = ERC20Token(targetAddr);
    // }

    function lockToken(
        address _token,
        uint256 _amount,
        bytes calldata _signature
    ) external payable {
        require(
            wrappedTokenContracts[_token] != ERC20Token(address(0)),
            "Register the token before bridging it"
        );
        require(_amount > 0, "Bridged amount is required");
        require(msg.value >= SERVICE_FEE, "Not enough service fee");
        // require(
        //     block.chainid == SOURCE_CHAIN_ID,
        //     "Can only lock token on source chain"
        // );

        // uint8 v;
        // bytes32 r;
        // bytes32 s;
        // (v, r, s) = splitSignature(_signature);

        // IERC20Permit(_token).permit(
        //     msg.sender,
        //     address(this),
        //     _amount,
        //     block.timestamp + 3600 /* 1 hour */,
        //     v,
        //     r,
        //     s
        // );
        IERC20(_token).transferFrom(msg.sender, address(this), _amount);
        emit LockToken(_token, msg.sender, block.chainid, _amount, _signature);
    }

    function release(
        address _token,
        address _to,
        uint256 _amount
    ) external onlyOwner {
        IERC20(_token).transfer(_to, _amount);
        emit ReleaseToken(_token, _to, _amount);
    }

    function burn(address _token, uint256 _amount, uint _nonce) external {
        // Burn can be called only for the wrapped tokens on Mumbai
        // require(
        //     block.chainid == TARGET_CHAIN_ID,
        //     "Can only burn wrapped tokens on target chain"
        // );
        require(
            processedNonces[msg.sender][_nonce] == false,
            "transfer already processed"
        );
        processedNonces[msg.sender][_nonce] = true;

        IERC20Token(_token).burn(msg.sender, _amount);
        emit BurnToken(
            _token,
            msg.sender,
            block.chainid,
            _amount,
            block.timestamp,
            _nonce
        );
    }

    function claim(
        address _token,
        address _from,
        address _to,
        uint _amount,
        uint _nonce,
        bytes calldata _signature
    ) external {
        // require(
        //     block.chainid == TARGET_CHAIN_ID,
        //     "Can only claim wrapped tokens on target chain"
        // );
        require(
            processedNonces[_from][_nonce] == false,
            "transfer already processed"
        );

        bytes32 message = prefixed(
            keccak256(abi.encodePacked(_from, _to, _amount, _nonce))
        );
        require(recoverSigner(message, _signature) == _from, "wrong signature");
        processedNonces[_from][_nonce] = true;
        ERC20Token(_token).mint(_to, _amount);
        emit ClaimToken(
            _token,
            _from,
            _to,
            block.chainid,
            _amount,
            block.timestamp,
            _nonce,
            _signature
        );
    }

    function prefixed(bytes32 hash) internal pure returns (bytes32) {
        return
            keccak256(
                abi.encodePacked("\x19Ethereum Signed Message:\n32", hash)
            );
    }

    function recoverSigner(
        bytes32 message,
        bytes calldata sig
    ) internal pure returns (address) {
        uint8 v;
        bytes32 r;
        bytes32 s;
        (v, r, s) = splitSignature(sig);
        return ecrecover(message, v, r, s);
    }

    function splitSignature(
        bytes memory sig
    ) internal pure returns (uint8, bytes32, bytes32) {
        require(sig.length == 65);
        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly {
            // first 32 bytes, after the length prefix
            r := mload(add(sig, 32))
            // second 32 bytes
            s := mload(add(sig, 64))
            // final byte (first byte of the next 32 bytes)
            v := byte(0, mload(add(sig, 96)))
        }
        return (v, r, s);
    }
}
